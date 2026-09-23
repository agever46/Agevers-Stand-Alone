import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const NP_API = 'https://api.nowpayments.io/v1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const NP_KEY = Deno.env.get('NOWPAYMENTS_API_KEY');
    if (!NP_KEY) throw new Error('NOWPAYMENTS_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth failures must return a clean 401 (not a 500) so the client can tell
    // the shopper their session expired instead of showing a generic error.
    const unauthorized = (detail?: string) => new Response(JSON.stringify({
      error: 'Your session expired. Please sign in again and retry the payment.',
      code: 'session_expired',
      detail,
    }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return unauthorized('missing Authorization header');
    const token = authHeader.replace('Bearer ', '').trim();
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!token || token === anonKey) return unauthorized('no user token supplied');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return unauthorized(authError?.message);

    const body = await req.json();
    const {
      items, total_eur, total_charge,
      redeem_coins, shipping_address, selected_shipping, applied_coupon,
      description, success_url, cancel_url, pay_currency,
    } = body;

    if (!Array.isArray(items) || items.length === 0) throw new Error('No items');
    const eurAmount = Number(total_eur ?? total_charge);
    if (!Number.isFinite(eurAmount) || eurAmount <= 0) throw new Error('Invalid total');

    // ===== Server-side total validation (mirrors paypal-create-order) =====
    let serverExpectedEur = 0;
    for (const item of items) {
      const qty = Number(item?.quantity) || 1;
      let catalogPrice: number | null = null;
      if (item?.offerId) {
        // Honor active Daily Deal sale price first (overrides catalog sell_price)
        const { data: dd } = await supabase
          .from('daily_deals')
          .select('sale_price')
          .eq('allowed_product_id', item.offerId)
          .eq('is_active', true)
          .maybeSingle();
        if (dd?.sale_price != null) catalogPrice = Number(dd.sale_price);
      }
      if (catalogPrice == null && item?.offerId) {
        const { data: kp } = await supabase
          .from('kinguin_products').select('sell_price')
          .eq('allowed_product_id', item.offerId).eq('is_active', true).maybeSingle();
        if (kp?.sell_price != null) catalogPrice = Number(kp.sell_price);
        if (catalogPrice == null) {
          const { data: sp } = await supabase.from('products').select('price')
            .eq('id', item.offerId).maybeSingle();
          if (sp?.price != null) catalogPrice = Number(sp.price);
        }
      }
      if (catalogPrice == null && item?.title) {
        const { data: sp2 } = await supabase.from('products').select('price')
          .eq('title', item.title).eq('status', 'active')
          .order('price', { ascending: true }).limit(1).maybeSingle();
        if (sp2?.price != null) catalogPrice = Number(sp2.price);
      }
      if (catalogPrice == null && item?.offerId && item?.variationSkuId) {
        const { data: pv } = await supabase
          .from('product_variations')
          .select('price')
          .eq('allowed_product_id', item.offerId)
          .eq('sku_id', String(item.variationSkuId))
          .maybeSingle();
        if (pv?.price != null) catalogPrice = Number(pv.price);
      }
      if (catalogPrice == null) {
        console.error('Catalog price not found for item', { offerId: item?.offerId, title: item?.title });
        return new Response(JSON.stringify({
          error: `Unable to verify price for "${item?.title ?? 'item'}". Please refresh your cart and try again.`,
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      serverExpectedEur += catalogPrice * qty;
    }
    if (selected_shipping?.price) serverExpectedEur += Number(selected_shipping.price) || 0;
    // Blaze Coins redemption temporarily disabled site-wide (2026-09-08
    // incident) — see paypal-create-order for the same fix and rationale.
    const coinDiscount = 0;
    let couponDiscount = 0;
    if (applied_coupon?.code) {
      const { data: vRes } = await supabase.rpc('validate_discount_code', {
        _code: applied_coupon.code, _order_total: serverExpectedEur,
      });
      if (vRes?.valid) {
        couponDiscount = vRes.discount_type === 'percentage'
          ? serverExpectedEur * (Number(vRes.discount_value) / 100)
          : Number(vRes.discount_value) || 0;
      }
    }
    serverExpectedEur = Math.max(0, serverExpectedEur - coinDiscount - couponDiscount);
    if (eurAmount < serverExpectedEur * 0.90) {
      return new Response(JSON.stringify({
        error: 'Order total validation failed. Please refresh your cart and try again.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Pending row (reuses existing table; paypal_order_id is the join key fulfill-order uses).
    const cryptoOrderId = `np_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

    const { data: pending, error: pendingErr } = await supabase
      .from('pending_paypal_orders')
      .insert({
        user_id: user.id,
        user_email: user.email ?? null,
        items,
        total_eur: eurAmount,
        total_charge: eurAmount,
        charge_currency: 'EUR',
        redeem_coins: redeem_coins ?? 0,
        shipping_address: shipping_address ?? null,
        selected_shipping: selected_shipping ?? null,
        applied_coupon: applied_coupon ?? null,
        status: 'created',
        paypal_order_id: cryptoOrderId,
      })
      .select('id')
      .single();
    if (pendingErr || !pending) throw new Error(pendingErr?.message || 'Failed to create pending order');

    const origin = req.headers.get('origin') || 'https://agevers.com';
    const ipnUrl = `${SUPABASE_URL}/functions/v1/nowpayments-webhook`;

    const invoiceRes = await fetch(`${NP_API}/invoice`, {
      method: 'POST',
      headers: { 'x-api-key': NP_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: Number(eurAmount.toFixed(2)),
        price_currency: 'eur',
        ...(pay_currency ? { pay_currency: String(pay_currency).toLowerCase() } : {}),
        order_id: cryptoOrderId,
        order_description: description || `${items.length} item(s) from Agever's`,
        ipn_callback_url: ipnUrl,
        success_url: success_url || `${origin}/order/${cryptoOrderId}`,
        cancel_url: cancel_url || `${origin}/checkout`,
        is_fee_paid_by_user: true,
      }),
    });
    const invoice = await invoiceRes.json();
    if (!invoiceRes.ok || !invoice?.invoice_url) {
      await supabase.from('pending_paypal_orders').update({
        status: 'failed', last_error: JSON.stringify(invoice),
      }).eq('id', pending.id);
      throw new Error(invoice?.message || `NOWPayments invoice failed (${invoiceRes.status})`);
    }

    return new Response(JSON.stringify({
      invoice_url: invoice.invoice_url,
      invoice_id: invoice.id,
      crypto_order_id: cryptoOrderId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('nowpayments-create-invoice error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});