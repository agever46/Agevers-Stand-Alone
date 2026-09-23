import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Not authenticated');

    const body = await req.json();
    const {
      items, total_eur, total_charge, charge_currency,
      redeem_coins, shipping_address, selected_shipping, applied_coupon,
      description,
    } = body;

    if (!Array.isArray(items) || items.length === 0) throw new Error('No items');
    if (typeof total_charge !== 'number' || total_charge <= 0) throw new Error('Invalid total');

    // ===== Stale cart recovery =====
    // Carts live in localStorage, so an offerId (allowed_product_id) can point at a
    // product that was replaced during a Kinguin re-sync. Instead of failing the
    // checkout, re-resolve the item to the currently active offer by title.
    const resolveOfferId = async (item: any): Promise<string | null> => {
      const raw = item?.offerId ? String(item.offerId) : null;
      if (raw) {
        const { data: ap } = await supabase
          .from('allowed_products')
          .select('id')
          .eq('id', raw)
          .maybeSingle();
        if (ap?.id) return ap.id;
        const { data: legacy } = await supabase
          .from('products')
          .select('id')
          .eq('id', raw)
          .maybeSingle();
        if (legacy?.id) return raw; // legacy products table item, keep as-is
      }
      const title = item?.title ? String(item.title) : null;
      if (!title) return raw;
      const { data: byTitle } = await supabase
        .from('allowed_products')
        .select('id')
        .eq('title', title)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (byTitle?.id) {
        console.log('Recovered stale cart offerId', { old: raw, new: byTitle.id, title });
        return byTitle.id;
      }
      return raw;
    };
    for (const item of items) {
      if (!item) continue;
      item.offerId = await resolveOfferId(item);
    }

    // ===== Live stock check (Kinguin) — before creating the PayPal order =====
    // Kinguin webhooks can lag or drop. If the cached DB stock is stale, we
    // could accept payment for an item that Kinguin no longer sells. Verify
    // live availability up-front so the buyer gets an immediate error instead
    // of a stuck `awaiting_reveal` / on-hold order later on.
    const KINGUIN_API_KEY_PRECHECK = Deno.env.get('KINGUIN_API_KEY');
    if (KINGUIN_API_KEY_PRECHECK) {
      for (const item of items) {
        const qty = Number(item?.quantity) || 1;
        if (!item?.offerId) continue;
        // Only run the live check when the offer is Kinguin-linked AND there
        // are not enough manual/seller keys to cover the order without Kinguin.
        const { data: kp } = await supabase
          .from('kinguin_products')
          .select('kinguin_product_id, kinguin_stock, is_active')
          .eq('allowed_product_id', item.offerId)
          .maybeSingle();
        if (!kp?.kinguin_product_id) continue;

        const { count: manualCount } = await supabase
          .from('product_keys')
          .select('*', { count: 'exact', head: true })
          .eq('allowed_product_id', item.offerId)
          .eq('status', 'active');
        const localAvailable = manualCount || 0;
        if (localAvailable >= qty) continue; // local supply covers it, skip live check

        try {
          const res = await fetch(
            `https://gateway.kinguin.net/esa/api/v2/products/${kp.kinguin_product_id}`,
            { headers: { 'X-Api-Key': KINGUIN_API_KEY_PRECHECK }, signal: AbortSignal.timeout(4000) },
          );
          if (!res.ok) continue; // fail-open on Kinguin API hiccups
          const productData: any = await res.json();
          const liveStock = Number(productData?.qty ?? productData?.totalQty ?? 0);
          const totalAvailable = localAvailable + liveStock;

          // Refresh DB cache with the fresh number
          await supabase
            .from('kinguin_products')
            .update({
              kinguin_stock: liveStock,
              is_active: liveStock > 0,
              last_stock_check: new Date().toISOString(),
            })
            .eq('kinguin_product_id', kp.kinguin_product_id);

          if (totalAvailable < qty) {
            return new Response(JSON.stringify({
              error: `"${item?.title ?? 'This item'}" is out of stock. Please refresh and try a different game.`,
              code: 'out_of_stock',
            }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        } catch (e) {
          console.warn('live stock precheck failed', kp.kinguin_product_id, (e as Error)?.message);
          // fail-open: fulfill-order will re-check before purchase
        }
      }
    }

    // ===== Server-side total validation (anti price-manipulation) =====
    // Recompute the expected EUR baseline from catalog prices, then verify the
    // client-provided EUR total is within a small tolerance. This prevents a
    // buyer from sending a tiny total_charge while passing correct item prices.
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
          .from('kinguin_products')
          .select('sell_price')
          .eq('allowed_product_id', item.offerId)
          .eq('is_active', true)
          .maybeSingle();
        if (kp?.sell_price != null) catalogPrice = Number(kp.sell_price);
        if (catalogPrice == null) {
          const { data: sp } = await supabase
            .from('products')
            .select('price')
            .eq('id', item.offerId)
            .maybeSingle();
          if (sp?.price != null) catalogPrice = Number(sp.price);
        }
      }
      // Fall back to title lookup
      if (catalogPrice == null && item?.title) {
        const { data: sp2 } = await supabase
          .from('products')
          .select('price')
          .eq('title', item.title)
          .eq('status', 'active')
          .order('price', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (sp2?.price != null) catalogPrice = Number(sp2.price);
      }
      // AliExpress variant price lookup (server-side, authoritative)
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
        // Never fall back to client-supplied price — that defeats validation.
        console.error('Catalog price not found for item', { offerId: item?.offerId, title: item?.title });
        return new Response(JSON.stringify({
          error: `Unable to verify price for "${item?.title ?? 'item'}". Please refresh your cart and try again.`,
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      serverExpectedEur += catalogPrice * qty;
    }
    // Shipping (if provided)
    if (selected_shipping?.price) serverExpectedEur += Number(selected_shipping.price) || 0;
    // Blaze Coins redemption temporarily disabled site-wide (2026-09-08
    // incident) — this value was trusted here with no balance check at all
    // (the balance is only checked later, in fulfill-order, after payment
    // is already captured), letting anyone discount the actual charge by
    // claiming any redeem_coins value regardless of their real balance.
    const coinDiscount = 0;
    // Coupon discount (server-side validated)
    let couponDiscount = 0;
    if (applied_coupon?.code) {
      const { data: vRes } = await supabase.rpc('validate_discount_code', {
        _code: applied_coupon.code,
        _order_total: serverExpectedEur,
      });
      if (vRes?.valid) {
        if (vRes.discount_type === 'percentage') {
          couponDiscount = serverExpectedEur * (Number(vRes.discount_value) / 100);
        } else {
          couponDiscount = Number(vRes.discount_value) || 0;
        }
      }
    }
    serverExpectedEur = Math.max(0, serverExpectedEur - coinDiscount - couponDiscount);

    const clientEur = Number(total_eur ?? total_charge);
    // Allow 10% tolerance for FX conversion, digital fees, and rounding.
    if (clientEur < serverExpectedEur * 0.90) {
      console.error('Order total mismatch', { clientEur, serverExpectedEur });
      return new Response(JSON.stringify({
        error: 'Order total validation failed. Please refresh your cart and try again.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const currency = (charge_currency || 'EUR').toUpperCase();
    const chargeValue = (currency === 'JPY' || currency === 'HUF')
      ? String(Math.round(total_charge))
      : total_charge.toFixed(2);

    // Create pending row first so we have its id for custom_id
    const { data: pending, error: pendingErr } = await supabase
      .from('pending_paypal_orders')
      .insert({
        user_id: user.id,
        user_email: user.email ?? null,
        items,
        total_eur: total_eur ?? total_charge,
        total_charge,
        charge_currency: currency,
        redeem_coins: redeem_coins ?? 0,
        shipping_address: shipping_address ?? null,
        selected_shipping: selected_shipping ?? null,
        applied_coupon: applied_coupon ?? null,
        status: 'created',
      })
      .select('id')
      .single();
    if (pendingErr || !pending) throw new Error(pendingErr?.message || 'Failed to create pending order');

    const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const secret = Deno.env.get('PAYPAL_SECRET');
    if (!clientId || !secret) throw new Error('PayPal not configured');
    const isLive = Deno.env.get('PAYPAL_LIVE')?.toLowerCase() === 'true';
    const baseUrl = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    const authRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${btoa(`${clientId}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const authJson = await authRes.json();
    if (!authJson.access_token) throw new Error('PayPal auth failed');

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authJson.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          custom_id: pending.id,
          description: description || `${items.length} item(s) from Agever's Digital Codes`,
          amount: { value: chargeValue, currency_code: currency },
        }],
      }),
    });
    const orderJson = await orderRes.json();
    if (!orderJson.id) {
      await supabase.from('pending_paypal_orders').update({ status: 'failed', last_error: JSON.stringify(orderJson) }).eq('id', pending.id);
      throw new Error(orderJson?.message || 'PayPal order creation failed');
    }

    await supabase.from('pending_paypal_orders').update({ paypal_order_id: orderJson.id }).eq('id', pending.id);

    return new Response(JSON.stringify({ id: orderJson.id, pending_id: pending.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('paypal-create-order error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});