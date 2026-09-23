import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KINGUIN_API = 'https://gateway.kinguin.net/esa/api';

function defaultInstructionsFor(platform: string): string {
  const p = platform.toLowerCase();
  if (p.includes('steam')) return 'Open Steam → Games → Activate a Product on Steam → enter the code above.';
  if (p.includes('epic')) return 'Open the Epic Games Store → click your account → Redeem Code → enter the code.';
  if (p.includes('xbox')) return 'Sign in to xbox.com/redeemcode → enter the 25-character code.';
  if (p.includes('playstation') || p.includes('psn')) return 'Sign in to your PSN account → Redeem Codes → enter the 12-digit code.';
  if (p.includes('nintendo')) return 'Open Nintendo eShop → enter your Nintendo Account → Redeem Code.';
  if (p.includes('gog')) return 'Sign in to GOG.com → click your username → Redeem Code.';
  if (p.includes('origin') || p.includes('ea')) return 'Open the EA App → click your name → Redeem Product Code.';
  if (p.includes('battle') || p.includes('blizzard')) return 'Sign in to Battle.net → click your account → Redeem a Code.';
  return 'Redeem this code on the official platform store linked to your purchase.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // Restrict to service-role callers (pg_cron / admin tooling). Prevents public
  // triggering of Kinguin purchases and prize emails.
  const authToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (authToken !== SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const KINGUIN_API_KEY = Deno.env.get('KINGUIN_API_KEY');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const results: any[] = [];

  try {
    // Find all giveaways that have ended but not yet finalized
    const { data: ended, error: endedErr } = await supabase
      .from('giveaways')
      .select('id, title, status, ends_at, winner_user_id, allowed_product_id, predetermined_winner_email, seeded_winners')
      .lte('ends_at', new Date().toISOString())
      .in('status', ['active', 'scheduled'])
      .is('winner_user_id', null);

    if (endedErr) throw endedErr;

    if (!ended || ended.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, message: 'No giveaways to finalize' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const g of ended) {
      const r: any = { giveaway_id: g.id, title: g.title };
      try {
        // 1. Pick a random winner from entries (weighted by entry_count)
        const { data: entries, error: entErr } = await supabase
          .from('giveaway_entries')
          .select('user_id, user_email, entry_count, bonus_from_orders, is_fake')
          .eq('giveaway_id', g.id);
        if (entErr) throw entErr;

        // Seed fake winners from the giveaway's seeded_winners list (email, entries, bonus)
        const seededList: any[] = Array.isArray((g as any).seeded_winners) ? (g as any).seeded_winners : [];
        for (const s of seededList) {
          const email = String(s?.email || '').toLowerCase().trim();
          if (!email) continue;
          if (entries.some((e: any) => (e.user_email || '').toLowerCase().trim() === email)) continue;
          const ins = {
            giveaway_id: g.id,
            user_id: crypto.randomUUID(),
            user_email: email,
            entry_count: Math.max(1, Number(s?.entries) || 1),
            bonus_from_orders: Math.max(0, Number(s?.bonus) || 0),
            is_fake: true,
          };
          const { error: insErr } = await supabase.from('giveaway_entries').insert(ins);
          if (!insErr) entries.push(ins as any);
        }

        if (!entries || entries.length === 0) {
          // No participants — just close it
          await supabase.from('giveaways').update({ status: 'ended', updated_at: new Date().toISOString() }).eq('id', g.id);
          r.status = 'ended_no_participants';
          results.push(r);
          continue;
        }

        // Honor predetermined winner if set and present in entries
        let winner: { user_id: string; user_email: string; is_fake?: boolean } | null = null;
        const preset = (g as any).predetermined_winner_email?.toLowerCase().trim();
        if (preset) {
          const match = entries.find((e: any) => (e.user_email || '').toLowerCase().trim() === preset);
          if (match) {
            winner = { user_id: match.user_id, user_email: match.user_email, is_fake: !!match.is_fake };
            r.predetermined = true;
          } else {
            r.predetermined_missing = preset;
          }
        }
        if (!winner) {
          // Build weighted pool
          const pool: { user_id: string; user_email: string; is_fake?: boolean }[] = [];
          for (const e of entries) {
            const weight = Math.max(1, (e.entry_count || 1) + (e.bonus_from_orders || 0));
            for (let i = 0; i < weight; i++) pool.push({ user_id: e.user_id, user_email: e.user_email, is_fake: !!e.is_fake });
          }
          winner = pool[Math.floor(Math.random() * pool.length)];
        }
        const winnerIsFake = winner.is_fake === true;

        // 2. Crown winner
        const nowIso = new Date().toISOString();
        await supabase.from('giveaways').update({
          winner_user_id: winner.user_id,
          winner_email: winner.user_email,
          winner_announced_at: nowIso,
          status: 'ended',
          updated_at: nowIso,
        }).eq('id', g.id);
        r.winner_email = winner.user_email;

        // 3. Resolve linked product info (for Kinguin purchase + email content)
        let prizeTitle = g.title;
        let prizePlatform = 'PC';
        let kinguinProductId: string | null = null;
        if (g.allowed_product_id) {
          const { data: prod } = await supabase
            .from('allowed_products')
            .select('title, platform, store')
            .eq('id', g.allowed_product_id)
            .maybeSingle();
          if (prod) {
            prizeTitle = prod.title;
            prizePlatform = `${prod.platform || ''}${prod.store ? ' • ' + prod.store : ''}`.trim();
          }
          const { data: kp } = await supabase
            .from('kinguin_products')
            .select('kinguin_product_id')
            .eq('allowed_product_id', g.allowed_product_id)
            .maybeSingle();
          if (kp) kinguinProductId = kp.kinguin_product_id;
        }

        // 4. Buy from Kinguin (if linked + key available) — skipped for seeded (fake) winners
        let gameCode = '';
        let cost: number | null = null;
        let kinguinOrderId: string | null = null;
        let purchaseError: string | null = null;

        if (winnerIsFake) {
          purchaseError = null; // seeded winner: no purchase, no email
        } else if (kinguinProductId && KINGUIN_API_KEY) {
          try {
            const priceRes = await fetch(`${KINGUIN_API}/v2/products/${kinguinProductId}`, {
              headers: { 'X-Api-Key': KINGUIN_API_KEY },
            });
            if (!priceRes.ok) throw new Error(`Kinguin product fetch [${priceRes.status}]`);
            const productData = await priceRes.json();
            const kinguinPrice = Number(productData.price ?? 0);
            const kinguinStock = productData.qty ?? productData.totalQty ?? 0;
            if (!kinguinPrice) throw new Error('No Kinguin price');
            if (kinguinStock <= 0) throw new Error('Out of stock on Kinguin');

            const orderRes = await fetch(`${KINGUIN_API}/v2/order`, {
              method: 'POST',
              headers: { 'X-Api-Key': KINGUIN_API_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                products: [{ productId: kinguinProductId, qty: 1, price: kinguinPrice, keyType: 'text' }],
              }),
            });
            if (!orderRes.ok) throw new Error(`Kinguin order failed [${orderRes.status}]`);
            const orderData = await orderRes.json();
            kinguinOrderId = orderData.orderId;
            cost = kinguinPrice;

            // Poll for keys
            for (let i = 0; i < 12; i++) {
              await new Promise((res) => setTimeout(res, 3000));
              const keysRes = await fetch(`${KINGUIN_API}/v2/order/${kinguinOrderId}/keys`, {
                headers: { 'X-Api-Key': KINGUIN_API_KEY },
              });
              if (keysRes.ok) {
                const keys = await keysRes.json();
                if (Array.isArray(keys) && keys.length > 0 && keys[0].serial) {
                  gameCode = keys[0].serial;
                  break;
                }
              }
            }
            if (!gameCode) purchaseError = `Order placed (${kinguinOrderId}) but key not yet ready`;
          } catch (e: any) {
            purchaseError = e.message;
          }
        } else if (!kinguinProductId) {
          purchaseError = 'No Kinguin product linked';
        } else {
          purchaseError = 'KINGUIN_API_KEY not configured';
        }

        // 4b. Crown every fake (seeded) entry as a prize winner — no purchase, no emails
        const seeded = entries.filter((e: any) => e.is_fake);
        if (seeded.length > 0) {
          let n = 0;
          for (const s of seeded) {
            n++;
            await supabase.from('giveaway_prizes').upsert({
              giveaway_id: g.id,
              winner_user_id: s.user_id,
              winner_email: s.user_email,
              game_code: `SEEDED-${g.id.slice(0, 8)}-${n}`,
              source: 'manual',
              email_status: 'skipped',
              notes: 'Seeded winner — no purchase, no email',
            }, { onConflict: 'giveaway_id,game_code' });
          }
          r.seeded_winners = seeded.length;
        }

        // 5. Save prize record + send winner email if we have a code
        if (winnerIsFake) {
          // Main winner is seeded — prize rows already written above; nothing to buy or send.
        } else if (gameCode) {
          await supabase.from('giveaway_prizes').insert({
            giveaway_id: g.id,
            winner_user_id: winner.user_id,
            winner_email: winner.user_email,
            game_code: gameCode,
            source: 'kinguin',
            cost,
            kinguin_order_id: kinguinOrderId,
            email_status: 'pending',
          });

          const winnerEmailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({
              templateName: 'giveaway-winner',
              recipientEmail: winner.user_email,
              idempotencyKey: `giveaway-prize-${g.id}`,
              templateData: {
                giveawayTitle: g.title,
                prizeTitle,
                platform: prizePlatform,
                gameCode,
                redeemInstructions: defaultInstructionsFor(prizePlatform),
              },
            }),
          });
          const winnerOk = winnerEmailRes.ok;
          await supabase.from('giveaway_prizes').update({
            email_status: winnerOk ? 'sent' : 'failed',
            email_sent_at: winnerOk ? new Date().toISOString() : null,
          }).eq('giveaway_id', g.id).eq('winner_user_id', winner.user_id).eq('game_code', gameCode);
          r.winner_emailed = winnerOk;
        } else {
          r.purchase_error = purchaseError;
          // Notify admin so they can deliver manually
          try {
            await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
              body: JSON.stringify({
                templateName: 'giveaway-manual-delivery',
                recipientEmail: 'admin@agevers.com',
                idempotencyKey: `giveaway-needs-manual-${g.id}`,
                templateData: {
                  giveawayId: g.id,
                  giveawayTitle: g.title,
                  winnerEmail: winner.user_email,
                  prizeTitle,
                  platform: prizePlatform,
                  reason: String(purchaseError ?? 'Automatic Kinguin purchase failed.'),
                },
              }),
            });
          } catch (_) { /* best-effort */ }
        }

        // 6. Send "thanks for participating" to all losers (never to seeded/fake entries)
        const losers = entries.filter((e: any) => e.user_id !== winner.user_id && !e.is_fake);
        let sentLosers = 0;
        for (const loser of losers) {
          try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
              body: JSON.stringify({
                templateName: 'giveaway-loser',
                recipientEmail: loser.user_email,
                idempotencyKey: `giveaway-loser-${g.id}-${loser.user_id}`,
                templateData: {
                  giveawayTitle: g.title,
                  prizeTitle,
                },
              }),
            });
            if (res.ok) sentLosers++;
          } catch (_) { /* skip */ }
        }
        r.losers_emailed = sentLosers;
        r.losers_total = losers.length;

        // 7. Notify admin via Telegram that the giveaway ended
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/telegram-notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({
              type: 'large_order',
              title: `🎁 Giveaway ended: ${g.title}`,
              message: `The giveaway has finished and a winner was selected.`,
              meta: {
                Winner: winner.user_email,
                Prize: prizeTitle,
                Platform: prizePlatform,
                Participants: entries.length,
                Seeded: winnerIsFake ? `Yes — ${entries.filter((e: any) => e.is_fake).length} fake winners crowned` : 'No',
                'Key delivered': winnerIsFake ? 'Skipped (seeded)' : (gameCode ? 'Yes (auto)' : `No — ${purchaseError || 'manual delivery required'}`),
              },
            }),
          });
        } catch (_) { /* best-effort */ }

        results.push(r);
      } catch (err: any) {
        r.error = err.message;
        results.push(r);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('giveaway-auto-finalize error:', error);
    return new Response(JSON.stringify({ error: error.message, results }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});