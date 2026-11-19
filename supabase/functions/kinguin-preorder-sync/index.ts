import { createClient } from "npm:@supabase/supabase-js@2";
import { requireServiceOrInternal } from "../_shared/adminAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KINGUIN_API = 'https://gateway.kinguin.net/esa/api';
const PLACEHOLDER_ORDER_ID = '00000000-0000-0000-0000-000000000000';
const FROM_ADDRESS = 'Agevers <noreply@updates.agevers.com>';
const ACCOUNT_URL = 'https://agevers.com/account';

const splitCodes = (value: string | null | undefined) =>
  (value || '')
    .split('\n')
    .map((code) => code.trim())
    .filter(Boolean);

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const extractSerials = (payload: unknown): string[] => {
  if (!Array.isArray(payload)) return [];

  return Array.from(
    new Set(
      payload
        .map((item: any) => item?.serial)
        .filter((serial): serial is string => typeof serial === 'string' && serial.trim().length > 0)
        .map((serial) => serial.trim())
    )
  );
};

const buildEmailHtml = (gameTitle: string, codes: string[]) => {
  const codeBlocks = codes
    .map(
      (code) => `
        <div style="background:#2a2a3e;border:1px solid #7c3aed33;border-radius:8px;padding:12px 14px;margin:8px 0;">
          <code style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.08em;word-break:break-all;">${escapeHtml(code)}</code>
        </div>`
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin:0;padding:0;background:#161622;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#161622;padding:32px 16px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#1e1e2e;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:32px 32px 16px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.2;">Your pre-order code is ready</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 16px;color:#cbd5e1;font-size:15px;line-height:1.6;">
                    <p style="margin:0 0 12px;">Good news — <strong>${escapeHtml(gameTitle)}</strong> has been released and your game code is now available.</p>
                    ${codeBlocks}
                    <p style="margin:16px 0 0;color:#94a3b8;font-size:13px;">You can also find this code inside your account orders page.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 32px;text-align:center;">
                    <a href="${ACCOUNT_URL}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;">Open my orders</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const authFail = await requireServiceOrInternal(req, corsHeaders);
  if (authFail) return authFail;

  // Auth-only canary probe used by cron-health-monitor: confirms the
  // service-role/internal-token header still works without running a real sync.
  if (new URL(req.url).searchParams.get('healthCheckOnly') === '1') {
    return new Response(JSON.stringify({ ok: true, healthCheck: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    if (!SUPABASE_URL) throw new Error('SUPABASE_URL not configured');

    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');

    const KINGUIN_API_KEY = Deno.env.get('KINGUIN_API_KEY');
    if (!KINGUIN_API_KEY) throw new Error('KINGUIN_API_KEY not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: pendingOrders, error: pendingOrdersError } = await supabase
      .from('kinguin_orders')
      .select(`
        id,
        order_id,
        kinguin_order_id,
        kinguin_product_id,
        game_key,
        status,
        orders!inner (
          id,
          user_id,
          game_title,
          platform,
          quantity,
          game_code
        )
      `)
      .eq('status', 'processing')
      .neq('order_id', PLACEHOLDER_ORDER_ID)
      .limit(100);

    if (pendingOrdersError) {
      throw new Error(`Failed to load pending Kinguin orders: ${pendingOrdersError.message}`);
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      return new Response(JSON.stringify({ success: true, checked: 0, delivered: 0, skipped_not_released: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const titleList = Array.from(new Set(pendingOrders.map((entry: any) => entry.orders?.game_title).filter(Boolean)));
    const platformList = Array.from(new Set(pendingOrders.map((entry: any) => entry.orders?.platform).filter(Boolean)));

    const releaseDateMap = new Map<string, string>();
    if (titleList.length > 0 && platformList.length > 0) {
      const { data: releaseDates } = await supabase
        .from('allowed_products')
        .select('title, platform, release_date')
        .in('title', titleList)
        .in('platform', platformList)
        .not('release_date', 'is', null);

      releaseDates?.forEach((item) => {
        releaseDateMap.set(`${item.platform}:::${item.title.toLowerCase()}`, item.release_date);
      });
    }

    let delivered = 0;
    let skippedNotReleased = 0;
    const failures: string[] = [];

    for (const pending of pendingOrders as any[]) {
      const linkedOrder = Array.isArray(pending.orders) ? pending.orders[0] : pending.orders;
      if (!linkedOrder?.id) continue;

      const releaseDate = releaseDateMap.get(`${linkedOrder.platform}:::${linkedOrder.game_title.toLowerCase()}`);
      if (releaseDate && new Date(releaseDate) > new Date()) {
        skippedNotReleased += 1;
        continue;
      }

      try {
        const keysRes = await fetch(`${KINGUIN_API}/v2/order/${pending.kinguin_order_id}/keys`, {
          headers: { 'X-Api-Key': KINGUIN_API_KEY },
        });

        if (!keysRes.ok) {
          failures.push(`keys_${pending.kinguin_order_id}_${keysRes.status}`);
          continue;
        }

        const fetchedCodes = extractSerials(await keysRes.json());
        if (fetchedCodes.length === 0) continue;

        const { data: currentOrder, error: currentOrderError } = await supabase
          .from('orders')
          .select('id, user_id, game_title, platform, quantity, game_code, status')
          .eq('id', linkedOrder.id)
          .single();

        if (currentOrderError || !currentOrder) {
          failures.push(`order_${linkedOrder.id}_missing`);
          continue;
        }

        const existingCodes = splitCodes(currentOrder.game_code);
        const wasCompleted = existingCodes.length >= currentOrder.quantity;
        const mergedCodes = Array.from(new Set([...existingCodes, ...fetchedCodes]));
        const isCompleted = mergedCodes.length >= currentOrder.quantity;

        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            game_code: mergedCodes.join('\n'),
            status: isCompleted ? 'completed' : 'processing',
          })
          .eq('id', currentOrder.id);

        if (orderUpdateError) {
          failures.push(`order_${currentOrder.id}_update_failed`);
          continue;
        }

        await supabase
          .from('kinguin_orders')
          .update({
            game_key: fetchedCodes.join('\n'),
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', pending.id);

        if (!wasCompleted && isCompleted) {
          const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(currentOrder.user_id);
          const buyerEmail = authUserData.user?.email;

          if (!authUserError && buyerEmail) {
            const subject = `${currentOrder.game_title} code is ready`;
            const html = buildEmailHtml(currentOrder.game_title, mergedCodes);
            const messageId = `preorder-${currentOrder.id}-${Date.now()}`;

            await supabase.from('email_send_log').insert({
              recipient_email: buyerEmail,
              template_name: 'preorder_key_ready',
              status: 'pending',
              message_id: messageId,
              metadata: { order_id: currentOrder.id, game_title: currentOrder.game_title },
            });

            // Check active provider (respects the admin toggle)
            let provider: 'lovable' | 'resend' = 'resend';
            try {
              const { data: settings } = await supabase
                .from('site_settings')
                .select('email_provider')
                .eq('id', 1)
                .single();
              if (settings?.email_provider === 'lovable') provider = 'lovable';
            } catch (_e) { /* default to resend */ }

            if (provider === 'lovable') {
              const { error: enqErr } = await supabase.rpc('enqueue_email', {
                queue_name: 'transactional_emails',
                payload: {
                  to: buyerEmail,
                  from: FROM_ADDRESS,
                  sender_domain: 'updates.agevers.com',
                  subject,
                  html,
                  message_id: messageId,
                  purpose: 'transactional',
                  label: 'preorder_key_ready',
                  idempotency_key: messageId,
                  queued_at: new Date().toISOString(),
                },
              });
              if (enqErr) {
                await supabase.from('email_send_log').insert({
                  recipient_email: buyerEmail,
                  template_name: 'preorder_key_ready',
                  status: 'failed',
                  message_id: messageId,
                  error_message: 'Failed to enqueue: ' + enqErr.message,
                });
              }
            } else {
              const resendApiKey = Deno.env.get('RESEND_API_KEY');
              if (resendApiKey) {
              try {
                const resendRes = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ from: FROM_ADDRESS, to: [buyerEmail], subject, html }),
                });
                const resendBody = await resendRes.json().catch(() => ({}));
                await supabase.from('email_send_log').insert({
                  recipient_email: buyerEmail,
                  template_name: 'preorder_key_ready',
                  status: resendRes.ok ? 'sent' : 'failed',
                  message_id: messageId,
                  error_message: resendRes.ok ? null : (resendBody?.message || `Resend HTTP ${resendRes.status}`),
                });
              } catch (sendErr) {
                await supabase.from('email_send_log').insert({
                  recipient_email: buyerEmail,
                  template_name: 'preorder_key_ready',
                  status: 'failed',
                  message_id: messageId,
                  error_message: (sendErr as Error).message,
                });
              }
              }
            }
          }
        }

        delivered += 1;
      } catch (error) {
        console.error(`Failed to process Kinguin preorder ${pending.kinguin_order_id}:`, error);
        failures.push(`process_${pending.kinguin_order_id}_failed`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      checked: pendingOrders.length,
      delivered,
      skipped_not_released: skippedNotReleased,
      failures,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Kinguin preorder sync error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});