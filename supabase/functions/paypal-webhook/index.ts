import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

async function getPaypalToken() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const secret = Deno.env.get('PAYPAL_SECRET');
  const isLive = Deno.env.get('PAYPAL_LIVE')?.toLowerCase() === 'true';
  const baseUrl = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${btoa(`${clientId}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const json = await res.json();
  return { token: json.access_token as string, baseUrl };
}

async function verifySignature(req: Request, rawBody: string, webhookId: string) {
  const { token, baseUrl } = await getPaypalToken();
  if (!token) return false;
  const verifyBody = {
    auth_algo: req.headers.get('paypal-auth-algo'),
    cert_url: req.headers.get('paypal-cert-url'),
    transmission_id: req.headers.get('paypal-transmission-id'),
    transmission_sig: req.headers.get('paypal-transmission-sig'),
    transmission_time: req.headers.get('paypal-transmission-time'),
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody),
  };
  const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(verifyBody),
  });
  const json = await res.json();
  return json?.verification_status === 'SUCCESS';
}

// See paypal-capture-order: sending only the pre-rotation token silently
// 401'd every alert. Send both accepted credentials and log failures.
async function notifyTg(type: string, title: string, message: string, meta: Record<string, unknown> = {}) {
  try {
    const SB = Deno.env.get('SUPABASE_URL')!;
    const TOK = Deno.env.get('INTERNAL_NOTIFY_TOKEN_V3') || '';
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const res = await fetch(`${SB}/functions/v1/telegram-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': TOK,
        'Authorization': `Bearer ${SERVICE}`,
      },
      body: JSON.stringify({ type, title, message, meta }),
    });
    if (!res.ok) console.error('notifyTg failed', res.status, await res.text().catch(() => ''));
  } catch (e) {
    console.error('notifyTg threw', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID');

  let rawBody = '';
  try {
    rawBody = await req.text();
    const event = JSON.parse(rawBody);
    const eventType = event?.event_type as string;
    console.log('paypal-webhook event:', eventType, event?.id);

    // SECURITY: Always require signature verification. If PAYPAL_WEBHOOK_ID is not
    // configured, fail closed so a misconfiguration is immediately visible rather
    // than silently accepting forged webhook payloads.
    if (!webhookId) {
      console.error('PAYPAL_WEBHOOK_ID is not configured — rejecting webhook');
      return new Response(JSON.stringify({ error: 'webhook not configured' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const ok = await verifySignature(req, rawBody, webhookId);
    if (!ok) {
      console.error('Webhook signature verification failed');
      return new Response(JSON.stringify({ error: 'invalid signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resource = event?.resource || {};

    // Real-time alerts on adverse PayPal events. These fire regardless of
    // whether a pending order was matched (dispute/refund events sometimes
    // arrive after fulfillment).
    if (
      eventType === 'PAYMENT.CAPTURE.DENIED' ||
      eventType === 'PAYMENT.CAPTURE.DECLINED' ||
      eventType === 'PAYMENT.CAPTURE.REVERSED' ||
      eventType === 'PAYMENT.CAPTURE.REFUNDED' ||
      eventType === 'CUSTOMER.DISPUTE.CREATED' ||
      eventType === 'CUSTOMER.DISPUTE.UPDATED' ||
      eventType === 'RISK.DISPUTE.CREATED'
    ) {
      const isDispute = eventType.includes('DISPUTE');
      await notifyTg(
        isDispute ? 'chargeback' : 'fraud',
        isDispute ? '⚠️ PayPal Dispute' : '🚨 PayPal Adverse Event',
        `${eventType} — resource ${resource?.id || 'n/a'} amount ${resource?.amount?.value || resource?.gross_amount?.value || 'n/a'} ${resource?.amount?.currency_code || ''}`,
        {
          event_type: eventType,
          event_id: event?.id,
          resource_id: resource?.id,
          reason: resource?.reason || resource?.status_details?.reason,
          custom_id: resource?.custom_id || resource?.purchase_units?.[0]?.custom_id,
        },
      );
    }

    // Determine paypal order id depending on event type
    let paypalOrderId: string | null = null;
    if (eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'CHECKOUT.ORDER.COMPLETED') {
      paypalOrderId = resource?.id || null;
    } else if (eventType?.startsWith('PAYMENT.CAPTURE.')) {
      // capture.supplementary_data.related_ids.order_id holds the parent order id
      paypalOrderId = resource?.supplementary_data?.related_ids?.order_id
        || (Array.isArray(resource?.links) ? null : null);
      if (!paypalOrderId && resource?.custom_id) {
        // fallback: look up pending by custom_id (which is pending row id)
      }
    }

    const customId = resource?.custom_id || resource?.purchase_units?.[0]?.custom_id;

    // Find pending row by paypal_order_id or by custom_id (pending row id)
    let pending: any = null;
    if (paypalOrderId) {
      const { data } = await supabase.from('pending_paypal_orders').select('*').eq('paypal_order_id', paypalOrderId).maybeSingle();
      pending = data;
    }
    if (!pending && customId) {
      const { data } = await supabase.from('pending_paypal_orders').select('*').eq('id', customId).maybeSingle();
      pending = data;
      if (pending && !paypalOrderId) paypalOrderId = pending.paypal_order_id;
    }

    if (!pending || !paypalOrderId) {
      console.log('No matching pending order for webhook; ignoring.');
      return new Response(JSON.stringify({ received: true, matched: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Already-fulfilled idempotency
    const { data: existingOrder } = await supabase
      .from('orders').select('id').eq('paypal_order_id', paypalOrderId).limit(1).maybeSingle();
    if (existingOrder) {
      return new Response(JSON.stringify({ received: true, already_fulfilled: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (eventType === 'PAYMENT.CAPTURE.DENIED') {
      await supabase.from('pending_paypal_orders').update({ status: 'failed', last_error: 'PAYMENT.CAPTURE.DENIED' }).eq('id', pending.id);
      return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For APPROVED: try capturing first. For CAPTURE.COMPLETED: capture already done by PayPal.
    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      try {
        const { token, baseUrl } = await getPaypalToken();
        const capRes = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `cap-wh-${pending.id}` },
        });
        const capJson = await capRes.json();
        const isAlreadyCaptured = capJson?.name === 'UNPROCESSABLE_ENTITY' && Array.isArray(capJson?.details) &&
          capJson.details.some((d: any) => d?.issue === 'ORDER_ALREADY_CAPTURED');
        if (!capRes.ok && !isAlreadyCaptured) {
          console.error('Webhook capture failed:', capJson);
          // Don't 500 — return 200 so PayPal stops retrying; we'll let CAPTURE.COMPLETED handle it.
          return new Response(JSON.stringify({ received: true, capture: 'deferred' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        console.error('Webhook capture exception:', e);
      }
    }

    // Only fulfill on capture-completion events (or after a successful APPROVED-capture above)
    const shouldFulfill = eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'CHECKOUT.ORDER.COMPLETED';
    if (!shouldFulfill) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Invoke fulfill-order in internal mode (service-role + user_id)
    const fulfillRes = await fetch(`${SUPABASE_URL}/functions/v1/fulfill-order`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        paypal_order_id: paypalOrderId,
        user_id: pending.user_id,
        items: pending.items,
        redeem_coins: pending.redeem_coins,
        shipping_address: pending.shipping_address || undefined,
        selected_shipping: pending.selected_shipping || undefined,
      }),
    });
    const fulfillJson = await fulfillRes.json().catch(() => ({}));
    if (!fulfillRes.ok || (fulfillJson?.error && !fulfillJson?.success)) {
      console.error('Webhook fulfill failed:', fulfillJson);
      await supabase.from('pending_paypal_orders').update({ status: 'failed', last_error: `Webhook fulfill: ${fulfillJson?.error || fulfillRes.status}` }).eq('id', pending.id);
      await notifyTg('fraud', '🚨 PayPal Webhook Fulfillment Failed',
        `Payment captured via webhook but fulfill-order failed for ${paypalOrderId}. Customer paid — manual recovery required.`,
        { paypal_order_id: paypalOrderId, pending_id: pending.id, error: fulfillJson?.error, http_status: fulfillRes.status });
      // Still return 200 to stop PayPal retries; we have data to recover manually.
      return new Response(JSON.stringify({ received: true, fulfill: 'failed' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('pending_paypal_orders').update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() }).eq('id', pending.id);

    // Send confirmation email if not already sent (best-effort)
    try {
      const email = pending.user_email;
      if (email) {
        const items = pending.items as any[];
        const firstItem = items[0];
        const totalPrice = items.reduce((sum: number, i: any) => sum + Number(i.price) * Number(i.quantity), 0);
        // Pull the access_token from any of the newly-created orders so the
        // reveal link works even when the buyer was a guest (no session).
        const { data: firstOrder } = await supabase
          .from('orders')
          .select('access_token')
          .eq('paypal_order_id', paypalOrderId)
          .not('access_token', 'is', null)
          .limit(1)
          .maybeSingle();
        const tokenParam = firstOrder?.access_token ? `?token=${encodeURIComponent(firstOrder.access_token)}` : '';
        await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_ROLE_KEY },
          body: JSON.stringify({
            templateName: 'purchase-confirmation',
            recipientEmail: email,
            idempotencyKey: `purchase-confirm-${paypalOrderId}`,
            templateData: {
              gameTitle: items.length === 1 ? firstItem.title : `${firstItem.title} + ${items.length - 1} more`,
              platform: firstItem.platform,
              quantity: items.reduce((s: number, i: any) => s + Number(i.quantity), 0),
              price: `€${totalPrice.toFixed(2)}`,
              orderLink: `https://agevers.com/order/${paypalOrderId}${tokenParam}`,
              orderId: paypalOrderId,
            },
          }),
        });
      }
    } catch (e) {
      console.error('Webhook email send failed:', e);
    }

    return new Response(JSON.stringify({ received: true, fulfilled: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('paypal-webhook error:', err, 'body:', rawBody.slice(0, 500));
    // Return 200 to avoid endless PayPal retries on a parsing bug
    return new Response(JSON.stringify({ received: true, error: err?.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});