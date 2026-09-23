import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KINGUIN_API = 'https://gateway.kinguin.net/esa/api';

interface DeliverRequest {
  giveaway_id: string;
  source: 'kinguin' | 'manual';
  manual_code?: string;
  redeem_instructions?: string;
  // Optional: deliver to a specific winner (for giveaways with multiple winners).
  // If omitted, falls back to the giveaway's primary winner_user_id.
  winner_user_id?: string;
  winner_email?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth: caller must be admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');
    const token = authHeader.replace('Bearer ', '');
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData) throw new Error('Invalid auth token');
    const userId = claimsData.claims.sub as string;

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'super_admin'])
      .maybeSingle();
    if (!roleRow) throw new Error('Admin access required');

    const body = (await req.json()) as DeliverRequest;
    const { giveaway_id, source, manual_code, redeem_instructions } = body;
    const overrideWinnerId = body.winner_user_id?.trim() || null;
    const overrideWinnerEmail = body.winner_email?.trim() || null;

    if (!giveaway_id) throw new Error('giveaway_id is required');
    if (source !== 'kinguin' && source !== 'manual') throw new Error('Invalid source');
    if (source === 'manual' && (!manual_code || manual_code.trim().length < 3)) {
      throw new Error('manual_code is required when source is manual');
    }

    // Fetch giveaway with winner
    const { data: giveaway, error: gErr } = await supabase
      .from('giveaways')
      .select('id, title, status, winner_user_id, winner_email, allowed_product_id, prize_count')
      .eq('id', giveaway_id)
      .maybeSingle();
    if (gErr || !giveaway) throw new Error('Giveaway not found');

    // Resolve target winner (either override or primary winner of the giveaway)
    const targetWinnerId = overrideWinnerId || giveaway.winner_user_id;
    const targetWinnerEmail = overrideWinnerEmail || giveaway.winner_email;
    if (!targetWinnerId || !targetWinnerEmail) {
      throw new Error('No winner has been crowned for this giveaway yet');
    }

    // A caller-supplied winner must be backed by server state: the identity has
    // to be an actual entrant of this giveaway (or the crowned primary winner).
    if (overrideWinnerId || overrideWinnerEmail) {
      const isPrimary =
        targetWinnerId === giveaway.winner_user_id && targetWinnerEmail === giveaway.winner_email;
      if (!isPrimary) {
        const { data: entry } = await supabase
          .from('giveaway_entries')
          .select('id, user_id, email')
          .eq('giveaway_id', giveaway_id)
          .eq('user_id', targetWinnerId)
          .maybeSingle();
        if (!entry) {
          throw new Error('Selected winner is not an entrant of this giveaway');
        }
        if (entry.email && entry.email.toLowerCase() !== targetWinnerEmail.toLowerCase()) {
          throw new Error('Selected winner email does not match the giveaway entry');
        }
      }
    }

    // Enforce prize_count: count existing prize rows for this giveaway
    const { count: existingCount } = await supabase
      .from('giveaway_prizes')
      .select('id', { count: 'exact', head: true })
      .eq('giveaway_id', giveaway_id);
    const prizeCount = (giveaway as any).prize_count ?? 1;
    if ((existingCount ?? 0) >= prizeCount) {
      throw new Error(`All ${prizeCount} prizes for this giveaway have already been delivered.`);
    }

    // Linked product (for prize details + Kinguin product id)
    let prizeTitle = giveaway.title;
    let prizePlatform = 'PC';
    let kinguinProductId: string | null = null;
    if (giveaway.allowed_product_id) {
      const { data: prod } = await supabase
        .from('allowed_products')
        .select('title, platform, store')
        .eq('id', giveaway.allowed_product_id)
        .maybeSingle();
      if (prod) {
        prizeTitle = prod.title;
        prizePlatform = `${prod.platform || ''}${prod.store ? ' • ' + prod.store : ''}`.trim();
      }

      const { data: kp } = await supabase
        .from('kinguin_products')
        .select('kinguin_product_id, kinguin_price, kinguin_stock, is_active')
        .eq('allowed_product_id', giveaway.allowed_product_id)
        .maybeSingle();
      if (kp) kinguinProductId = kp.kinguin_product_id;
    }

    let gameCode = '';
    let cost: number | null = null;
    let kinguinOrderId: string | null = null;

    if (source === 'kinguin') {
      const KINGUIN_API_KEY = Deno.env.get('KINGUIN_API_KEY');
      if (!KINGUIN_API_KEY) throw new Error('KINGUIN_API_KEY not configured');
      if (!kinguinProductId) throw new Error('No Kinguin product linked to this giveaway prize');

      // Fetch product price/stock
      const priceRes = await fetch(`${KINGUIN_API}/v2/products/${kinguinProductId}`, {
        headers: { 'X-Api-Key': KINGUIN_API_KEY },
      });
      if (!priceRes.ok) {
        const txt = await priceRes.text();
        throw new Error(`Failed to fetch Kinguin product [${priceRes.status}]: ${txt}`);
      }
      const productData = await priceRes.json();
      const kinguinPrice = Number(productData.price ?? 0);
      const kinguinStock = productData.qty ?? productData.totalQty ?? 0;
      if (!kinguinPrice) throw new Error('Could not determine Kinguin price');
      if (kinguinStock <= 0) throw new Error('Kinguin product is out of stock');

      // Place order
      const orderRes = await fetch(`${KINGUIN_API}/v2/order`, {
        method: 'POST',
        headers: { 'X-Api-Key': KINGUIN_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: [{ productId: kinguinProductId, qty: 1, price: kinguinPrice, keyType: 'text' }],
        }),
      });
      if (!orderRes.ok) {
        const txt = await orderRes.text();
        throw new Error(`Kinguin order failed [${orderRes.status}]: ${txt}`);
      }
      const orderData = await orderRes.json();
      kinguinOrderId = orderData.orderId;
      cost = kinguinPrice;

      // Poll for keys
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 3000));
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
      if (!gameCode) {
        throw new Error(`Kinguin order placed (id: ${kinguinOrderId}) but key not yet available. Try again in a few minutes or enter the code manually once received.`);
      }
    } else {
      gameCode = manual_code!.trim();
    }

    // Persist prize record (one row per code; multiple rows per giveaway allowed)
    const { data: prizeRow, error: insErr } = await supabase
      .from('giveaway_prizes')
      .insert({
        giveaway_id,
        winner_user_id: targetWinnerId,
        winner_email: targetWinnerEmail,
        game_code: gameCode,
        source,
        cost,
        kinguin_order_id: kinguinOrderId,
        email_status: 'pending',
        created_by: userId,
      })
      .select('id')
      .single();
    if (insErr) throw new Error(`Failed to save prize: ${insErr.message}`);

    // If giveaway has no primary winner yet, promote this winner to primary
    if (!giveaway.winner_user_id) {
      await supabase
        .from('giveaways')
        .update({
          winner_user_id: targetWinnerId,
          winner_email: targetWinnerEmail,
          winner_announced_at: new Date().toISOString(),
          status: 'drawn',
        })
        .eq('id', giveaway_id);
    }

    // Send email to winner
    const finalInstructions = redeem_instructions?.trim() || defaultInstructionsFor(prizePlatform);

    const emailClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: emailData, error: emailErr } = await emailClient.functions.invoke(
      'send-transactional-email',
      {
        body: {
          templateName: 'giveaway-winner',
          recipientEmail: targetWinnerEmail,
          idempotencyKey: `giveaway-prize-${prizeRow.id}`,
          templateData: {
            giveawayTitle: giveaway.title,
            prizeTitle,
            platform: prizePlatform,
            gameCode,
            redeemInstructions: finalInstructions,
          },
        },
      }
    );

    const emailOk = !emailErr;
    const emailBody = emailErr ? (emailErr.message || JSON.stringify(emailErr)) : JSON.stringify(emailData ?? {});

    await supabase
      .from('giveaway_prizes')
      .update({
        email_status: emailOk ? 'sent' : 'failed',
        email_sent_at: emailOk ? new Date().toISOString() : null,
        notes: emailOk ? null : `Email error: ${emailBody.slice(0, 500)}`,
      })
      .eq('id', prizeRow.id);

    if (!emailOk) {
      throw new Error(`Prize saved but email failed: ${emailBody}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: source === 'kinguin'
          ? 'Prize purchased from Kinguin and sent to winner.'
          : 'Manual code saved and sent to winner.',
        gameCode,
        cost,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('giveaway-deliver-prize error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function defaultInstructionsFor(platform: string): string {
  const p = platform.toLowerCase();
  if (p.includes('steam'))
    return 'Open Steam → Games → Activate a Product on Steam → enter the code above.';
  if (p.includes('epic'))
    return 'Open the Epic Games Store → click your account → Redeem Code → enter the code.';
  if (p.includes('xbox'))
    return 'Sign in to xbox.com/redeemcode → enter the 25-character code.';
  if (p.includes('playstation') || p.includes('psn'))
    return 'Sign in to your PSN account → Redeem Codes → enter the 12-digit code.';
  if (p.includes('nintendo'))
    return 'Open Nintendo eShop → enter your Nintendo Account → Redeem Code.';
  if (p.includes('gog'))
    return 'Sign in to GOG.com → click your username → Redeem Code.';
  if (p.includes('origin') || p.includes('ea'))
    return 'Open the EA App → click your name → Redeem Product Code.';
  if (p.includes('battle') || p.includes('blizzard'))
    return 'Sign in to Battle.net → click your account → Redeem a Code.';
  return 'Redeem this code on the official platform store linked to your purchase.';
}