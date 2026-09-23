import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KINGUIN_API = 'https://gateway.kinguin.net/esa/api';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');

    const token = authHeader.replace('Bearer ', '');

    // Internal mode: webhook / server callers pass the service-role key + explicit user_id.
    const isInternal = token === SUPABASE_SERVICE_ROLE_KEY;

    const body = await req.json();
    let user: { id: string; email: string | null };
    if (isInternal) {
      if (!body.user_id) throw new Error('Internal call requires user_id');
      const { data: u, error: uErr } = await supabase.auth.admin.getUserById(body.user_id);
      if (uErr || !u?.user) throw new Error('Internal user lookup failed');
      user = { id: u.user.id, email: u.user.email ?? null };
    } else {
      const { data: { user: authedUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authedUser) throw new Error('Not authenticated');
      user = { id: authedUser.id, email: authedUser.email ?? null };
    }

    const { paypal_order_id, items, shipping_address, selected_shipping, paypal_country } = body;
    // Blaze Coins redemption temporarily disabled site-wide (2026-09-08
    // incident — coins minted through an unknown path were being cashed in
    // as real checkout discounts). Ignore any redeem_coins the client sends
    // until the root cause is found. See supabase/migrations/20260908130000_*.
    const coinsToRedeem = 0;
    const discountFromCoins = 0;

    if (!paypal_order_id || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Missing paypal_order_id or items');
    }

    // Idempotency: if an order already exists for this paypal_order_id, return success without re-fulfilling.
    {
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('paypal_order_id', paypal_order_id)
        .limit(1)
        .maybeSingle();
      if (existing) {
        return new Response(
          JSON.stringify({ success: true, already_fulfilled: true, paypal_order_id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Payment proof: a browser caller must reference a PayPal order that
    // PayPal itself reports as paid. Without this, a signed-in user could call
    // this endpoint with any made-up payment id and receive game codes for
    // free. Internal (service-role) callers already captured the payment.
    if (!isInternal) {
      const ppClientId = Deno.env.get('PAYPAL_CLIENT_ID');
      const ppSecret = Deno.env.get('PAYPAL_SECRET');
      if (!ppClientId || !ppSecret) throw new Error('Payment verification unavailable');
      const ppBase = Deno.env.get('PAYPAL_LIVE')?.toLowerCase() === 'true'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
      const ppTokenRes = await fetch(`${ppBase}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${ppClientId}:${ppSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      const ppToken = await ppTokenRes.json().catch(() => ({}));
      if (!ppToken?.access_token) throw new Error('Payment verification failed');
      const ppOrderRes = await fetch(`${ppBase}/v2/checkout/orders/${encodeURIComponent(paypal_order_id)}`, {
        headers: { Authorization: `Bearer ${ppToken.access_token}` },
      });
      const ppOrder = await ppOrderRes.json().catch(() => ({}));
      if (!ppOrderRes.ok || ppOrder?.status !== 'COMPLETED') {
        console.error('fulfill-order: payment not verified', ppOrderRes.status, ppOrder?.status);
        throw new Error('Payment could not be verified for this order');
      }
    }



    // Server-side fraud block check (whitelist-aware)
    const userEmail = (user.email || '').toLowerCase();
    const { data: whitelistHit } = await supabase
      .from('fraud_lists')
      .select('id')
      .eq('list_type', 'whitelist')
      .eq('entry_type', 'email')
      .eq('value', userEmail)
      .maybeSingle();

    if (!whitelistHit) {
      const { data: fraudScore } = await supabase
        .from('fraud_scores')
        .select('is_blocked, notes')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fraudScore?.is_blocked) {
        throw new Error(fraudScore.notes || 'Your account has been suspended. Please contact support.');
      }
    }

    // Capture delivery proof metadata.
    // When paypal-capture-order calls us server-to-server, the request headers
    // carry that server's address (an AWS IP resolving to "Washington, US"),
    // not the buyer's. It forwards the buyer's real IP/country signed with the
    // service-role key, so prefer that whenever it is present and authentic.
    const isValidIp = (ip: string | null | undefined): ip is string => {
      if (!ip) return false;
      const v4 = /^(\d{1,3}\.){3}\d{1,3}$/;
      const v6 = /^[0-9a-fA-F:]+$/;
      return (v4.test(ip) || (v6.test(ip) && ip.includes(':'))) && ip.length <= 45;
    };
    const originTrusted = req.headers.get('x-internal-origin-key') === SUPABASE_SERVICE_ROLE_KEY;
    const forwardedIp = originTrusted ? req.headers.get('x-internal-client-ip') : null;
    const forwardedCountry = originTrusted
      ? (req.headers.get('x-internal-client-country') || '').toUpperCase()
      : '';
    const buyerIp = (isValidIp(forwardedIp) ? forwardedIp : null)
      || req.headers.get('cf-connecting-ip')
      || req.headers.get('true-client-ip')
      || req.headers.get('x-real-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || 'unknown';
    const buyerUserAgent = req.headers.get('user-agent') || 'unknown';

    // Resolve geolocation from IP (ip-api.com free tier, no key needed)
    let buyerCountry: string | null = null;
    let buyerCity: string | null = null;
    // Prefer Cloudflare's TLS-protected cf-ipcountry header as the trust anchor.
    // Fall back to an HTTPS geolocation API (ipwho.is) so a network attacker
    // cannot spoof country data over plaintext HTTP.
    const cfCountryHeader = forwardedCountry || (req.headers.get('cf-ipcountry') || '').toUpperCase();
    if (cfCountryHeader && cfCountryHeader !== 'XX' && cfCountryHeader !== 'T1') {
      buyerCountry = cfCountryHeader;
    }
    if (buyerIp && buyerIp !== 'unknown') {
      try {
        const geoRes = await fetch(`https://ipwho.is/${encodeURIComponent(buyerIp)}?fields=success,country_code,country,city`, { signal: AbortSignal.timeout(3000) });
        if (geoRes.ok) {
          const geo = await geoRes.json();
          if (geo?.success !== false) {
            buyerCountry = buyerCountry || geo.country_code || geo.country || null;
            buyerCity = geo.city || null;
          }
        } else {
          await geoRes.text();
        }
      } catch (_e) {
        console.error('Geo lookup failed:', _e);
      }
    }

    // === Triple-Match Geo Check ===
    // Compare CF-IPCountry (Cloudflare header), phone prefix country, and PayPal country
    const cfIpCountry = (cfCountryHeader || (buyerCountry || '').toUpperCase());
    const userPhone = await (async () => {
      const { data: prof } = await supabase.from('profiles').select('phone').eq('user_id', user.id).maybeSingle();
      return prof?.phone || '';
    })();
    const phoneCountryMap: Record<string, string> = {
      // '+1' is the shared NANP prefix (US, Canada and ~20 Caribbean
      // countries incl. the Dominican Republic) — it cannot be read as 'US'.
      '+1': 'NANP', '+44': 'GB', '+972': 'IL', '+49': 'DE', '+33': 'FR', '+34': 'ES',
      '+39': 'IT', '+31': 'NL', '+46': 'SE', '+47': 'NO', '+45': 'DK', '+48': 'PL',
      '+7': 'RU', '+81': 'JP', '+82': 'KR', '+86': 'CN', '+91': 'IN', '+55': 'BR',
      '+61': 'AU', '+64': 'NZ', '+90': 'TR', '+971': 'AE', '+966': 'SA', '+20': 'EG',
      '+27': 'ZA', '+52': 'MX', '+57': 'CO', '+56': 'CL', '+54': 'AR', '+351': 'PT',
      '+32': 'BE', '+41': 'CH', '+43': 'AT', '+30': 'GR', '+36': 'HU', '+40': 'RO',
      '+380': 'UA', '+420': 'CZ', '+421': 'SK', '+385': 'HR', '+358': 'FI',
      '+60': 'MY', '+62': 'ID', '+63': 'PH', '+65': 'SG', '+66': 'TH', '+84': 'VN',
      '+92': 'PK', '+93': 'AF', '+94': 'LK', '+95': 'MM', '+98': 'IR', '+212': 'MA',
      '+213': 'DZ', '+216': 'TN', '+218': 'LY', '+221': 'SN', '+233': 'GH', '+234': 'NG',
      '+254': 'KE', '+255': 'TZ', '+256': 'UG', '+352': 'LU', '+353': 'IE', '+354': 'IS',
      '+355': 'AL', '+356': 'MT', '+357': 'CY', '+359': 'BG', '+370': 'LT', '+371': 'LV',
      '+372': 'EE', '+373': 'MD', '+374': 'AM', '+375': 'BY', '+381': 'RS', '+386': 'SI',
      '+387': 'BA', '+389': 'MK', '+423': 'LI', '+502': 'GT', '+503': 'SV', '+504': 'HN',
      '+505': 'NI', '+506': 'CR', '+507': 'PA', '+591': 'BO', '+593': 'EC', '+595': 'PY',
      '+598': 'UY', '+852': 'HK', '+855': 'KH', '+880': 'BD', '+886': 'TW', '+961': 'LB',
      '+962': 'JO', '+964': 'IQ', '+965': 'KW', '+967': 'YE', '+968': 'OM', '+970': 'PS',
      '+973': 'BH', '+974': 'QA', '+976': 'MN', '+977': 'NP', '+992': 'TJ', '+994': 'AZ',
      '+995': 'GE', '+996': 'KG', '+998': 'UZ',
    };
    // Resolve phone country from prefix (longest match first)
    let phoneCountry = '';
    if (userPhone) {
      const sortedPrefixes = Object.keys(phoneCountryMap).sort((a, b) => b.length - a.length);
      for (const prefix of sortedPrefixes) {
        if (userPhone.startsWith(prefix)) { phoneCountry = phoneCountryMap[prefix]; break; }
      }
    }
    let ppCountry = (typeof paypal_country === 'string' ? paypal_country : '').toUpperCase();
    // Fallback: read the PayPal payer country captured during checkout, either
    // from the pending row or from an already-stamped order for this payment.
    if (!ppCountry && paypal_order_id) {
      try {
        const { data: pend } = await supabase
          .from('pending_paypal_orders')
          .select('paypal_payer_snapshot')
          .eq('paypal_order_id', paypal_order_id)
          .maybeSingle();
        ppCountry = String((pend as any)?.paypal_payer_snapshot?.payer?.address?.country_code || '').toUpperCase();
        if (!ppCountry) {
          const { data: ord } = await supabase
            .from('orders')
            .select('paypal_payer_snapshot')
            .eq('paypal_order_id', paypal_order_id)
            .not('paypal_payer_snapshot', 'is', null)
            .limit(1)
            .maybeSingle();
          ppCountry = String((ord as any)?.paypal_payer_snapshot?.payer?.address?.country_code || '').toUpperCase();
        }
      } catch (_e) { /* non-blocking */ }
    }

    // Countries sharing the +1 NANP dialing prefix. A 'NANP' phone can't be
    // pinned to one of them from the prefix alone, so it's treated as
    // compatible with all of them instead of being assumed to be 'US'.
    const NANP_COUNTRIES = new Set([
      'US', 'CA', 'AG', 'AI', 'AS', 'BB', 'BM', 'BS', 'DM', 'DO', 'GD', 'GU',
      'JM', 'KN', 'KY', 'LC', 'MP', 'MS', 'PR', 'SX', 'TC', 'TT', 'VC', 'VG', 'VI',
    ]);
    // Count how many data points are available and how many match
    const geoPoints = [cfIpCountry, phoneCountry, ppCountry].filter(Boolean);

    let tripleMatchMismatch = false;
    if (geoPoints.length >= 2) {
      // Compare only the points that name a real country; a 'NANP' phone is a
      // mismatch only when the other points are not NANP countries themselves.
      const concrete = geoPoints.filter((c) => c !== 'NANP');
      const uniqueCountries = [...new Set(concrete)];
      const nanpConflict = geoPoints.includes('NANP')
        && concrete.some((c) => !NANP_COUNTRIES.has(c));
      if (uniqueCountries.length > 1 || nanpConflict) {
        tripleMatchMismatch = true;
        console.log(`Triple-Match MISMATCH: IP=${cfIpCountry}, Phone=${phoneCountry}, PayPal=${ppCountry}`);
        // Log fraud flag
        await supabase.from('fraud_flags').insert({
          user_id: user.id,
          flag_type: 'geo_mismatch',
          severity: 'high',
          description: `Geo mismatch: IP=${cfIpCountry || '?'}, Phone=${phoneCountry || '?'}, PayPal=${ppCountry || '?'}`,
          metadata: { cf_ip_country: cfIpCountry, phone_country: phoneCountry, paypal_country: ppCountry, buyer_ip: buyerIp },
        });
      }
    }

    // Security hold thresholds — orders matching ANY trigger are flagged for manual review.
    // Triggers: order total >= €100, OR fraud_score risk_score > 70, OR no stock available
    const HOLD_THRESHOLD_EUR = 100;
    const FRAUD_SCORE_THRESHOLD = 70;
    // Cooling period for ALL non-held orders (10 minutes) — auto-releases.
    const COOLING_PERIOD_MS = 10 * 60 * 1000;

    // Fetch user's current fraud risk score (used for hold-decision per item)
    const { data: userFraudScore } = await supabase
      .from('fraud_scores')
      .select('risk_score')
      .eq('user_id', user.id)
      .maybeSingle();
    const userRiskScore = userFraudScore?.risk_score ?? 0;
    const fraudHold = userRiskScore > FRAUD_SCORE_THRESHOLD;

    const results: Array<{
      game_title: string;
      order_id: string;
      game_codes: string[];
      source: string;
      held_for_balance?: boolean;
      is_held?: boolean;
      held_reason?: string | null;
      access_token?: string;
    }> = [];
    type PendingKinguinOrder = {
      kinguin_order_id: string;
      kinguin_product_id: string;
      kinguin_price: number;
      status: string;
      game_key: string | null;
    };

    for (const item of items) {
      const { offerId, title, platform, price, quantity, image_url } = item;

      const { data: allowedProduct } = await supabase
        .from('allowed_products')
        .select('id, aliexpress_product_id')
        .eq('id', offerId)
        .maybeSingle();

      const isAliExpressItem = !!allowedProduct?.aliexpress_product_id;

      // Free-gift claims legitimately pay €0 — exempt them from the catalog
      // price check below, but only when the call is internal (service-role,
      // i.e. from claim-free-gift, not a regular user-authenticated request)
      // AND this exact product is independently confirmed to be an active
      // free-gift offer. Don't just trust the item's own is_free_gift flag —
      // that would let anyone claim any product for €0 by sending it.
      let isVerifiedFreeGift = false;
      if (isInternal && (item as any)?.is_free_gift === true) {
        const { data: giftRow } = await supabase
          .from('free_gift_products')
          .select('id')
          .eq('allowed_product_id', offerId)
          .maybeSingle();
        isVerifiedFreeGift = !!giftRow;
      }

      // Server-side price validation against catalog
      const { data: kpPrice } = await supabase
        .from('kinguin_products')
        .select('sell_price')
        .eq('allowed_product_id', offerId)
        .eq('is_active', true)
        .maybeSingle();

      // Also check seller product price
      const { data: sellerProduct } = await supabase
        .from('products')
        .select('price')
        .eq('title', title)
        .eq('status', 'active')
        .order('price', { ascending: true })
        .limit(1)
        .maybeSingle();

      // AliExpress variant price (server-side, authoritative) when no Kinguin/seller price
      let variationPrice: number | null = null;
      if (isAliExpressItem) {
        const variationSkuId = (item as any)?.variationSkuId ?? (item as any)?.sku_id ?? null;
        const pvQuery = supabase
          .from('product_variations')
          .select('price')
          .eq('allowed_product_id', offerId);
        const { data: pv } = variationSkuId
          ? await pvQuery.eq('sku_id', String(variationSkuId)).maybeSingle()
          : await pvQuery.order('price', { ascending: true }).limit(1).maybeSingle();
        if (pv?.price != null) variationPrice = Number(pv.price);
      }
      const catalogPrice = sellerProduct?.price ?? kpPrice?.sell_price ?? variationPrice;
      if (!isVerifiedFreeGift && catalogPrice == null) {
        // Refuse to fulfill items whose price cannot be independently verified.
        throw new Error(`Cannot verify catalog price for "${title}". Refusing to fulfill.`);
      }
      // Allow 2% tolerance for FX rounding, but reject obvious manipulation
      const tolerance = catalogPrice != null ? Number(catalogPrice) * 0.02 : 0;
      if (!isVerifiedFreeGift && catalogPrice != null && price < Number(catalogPrice) - tolerance) {
        throw new Error(`Price mismatch for "${title}". Expected ~€${catalogPrice}, got €${price}`);
      }

      // Server-side stock validation
      const { count: manualKeyCount } = await supabase
        .from('product_keys')
        .select('*', { count: 'exact', head: true })
        .eq('allowed_product_id', offerId)
        .eq('status', 'active');

      const { data: kpStock } = await supabase
        .from('kinguin_products')
        .select('kinguin_stock')
        .eq('allowed_product_id', offerId)
        .eq('is_active', true)
        .maybeSingle();

      const totalStock = (manualKeyCount || 0) + (kpStock?.kinguin_stock || 0);
      if (!isAliExpressItem && quantity > totalStock) {
        throw new Error(`Not enough stock for "${title}". Available: ${totalStock}, requested: ${quantity}`);
      }

      let allCodes: string[] = [];
      let sellerKeys: any[] = [];
      let remainingQty = quantity;
      let usedKinguinPurchase = false;
      const pendingKinguinOrders: PendingKinguinOrder[] = [];

      // 1. Check for manual keys (admin keys linked to allowed_product_id)
      const { data: manualKeys } = await supabase
        .from('product_keys')
        .select('id, key_code, seller_id, product_id')
        .eq('allowed_product_id', offerId)
        .eq('status', 'active')
        .limit(remainingQty);

      if (manualKeys && manualKeys.length > 0) {
        sellerKeys.push(...manualKeys);
        allCodes.push(...manualKeys.map((k: any) => k.key_code));
        remainingQty -= manualKeys.length;
      }

      // 2. Check for seller keys by product_id
      if (remainingQty > 0) {
        const { data: availableKeys } = await supabase
          .from('product_keys')
          .select('id, key_code, seller_id, product_id')
          .eq('product_id', offerId)
          .eq('status', 'active')
          .is('allowed_product_id', null)
          .limit(remainingQty);

        if (availableKeys && availableKeys.length > 0) {
          sellerKeys.push(...availableKeys);
          allCodes.push(...availableKeys.map((k: any) => k.key_code));
          remainingQty -= availableKeys.length;
        }
      }

      // 3. Fallback: look up via products table by title
      if (remainingQty > 0) {
        const { data: linkedProducts } = await supabase
          .from('products')
          .select('id')
          .eq('title', title)
          .eq('status', 'active');

        if (linkedProducts && linkedProducts.length > 0) {
          const productIds = linkedProducts.map((p: any) => p.id);
          const { data: fallbackKeys } = await supabase
            .from('product_keys')
            .select('id, key_code, seller_id, product_id')
            .in('product_id', productIds)
            .eq('status', 'active')
            .is('allowed_product_id', null)
            .limit(remainingQty);
          if (fallbackKeys && fallbackKeys.length > 0) {
            sellerKeys.push(...fallbackKeys);
            allCodes.push(...fallbackKeys.map((k: any) => k.key_code));
            remainingQty -= fallbackKeys.length;
          }
        }
      }

      // 4. If still need more, try Kinguin purchase for remaining quantity
      let kinguinCodes: string[] = [];
      // We DEFER the actual Kinguin purchase until the user clicks "Reveal Code".
      // This avoids spending money on Kinguin if the buyer never verifies / never reveals.
      let deferredKinguin: { kinguin_product_id: string; qty: number; expected_price: number | null } | null = null;
      if (remainingQty > 0) {
        const KINGUIN_API_KEY = Deno.env.get('KINGUIN_API_KEY');
        if (KINGUIN_API_KEY) {
          // Check if this offerId is a Kinguin-linked allowed product
          const { data: kinguinProduct } = await supabase
            .from('kinguin_products')
            .select('*')
            .eq('allowed_product_id', offerId)
            .eq('is_active', true)
            .maybeSingle();

          if (kinguinProduct) {
            usedKinguinPurchase = true;
            // DEFER the purchase: only reserve metadata; the actual buy + key fetch
            // happens in the `reveal-and-fulfill` edge function after the user
            // verifies (SMS) and clicks "I Agree — View My Code".
            deferredKinguin = {
              kinguin_product_id: kinguinProduct.kinguin_product_id,
              qty: remainingQty,
              expected_price: kinguinProduct.kinguin_price ?? null,
            };
          }
        }
      }

      const gameCodeStr = allCodes.length > 0 ? allCodes.join('\n') : null;
      const orderStatus = isAliExpressItem
        ? 'processing'
        : allCodes.length >= quantity
          ? 'completed'
          : deferredKinguin
            ? 'awaiting_reveal'
            : 'processing';

      // Check if this order should be held for security review.
      // Triggers (ANY of): high-value, insufficient supplier balance, geo mismatch,
      // user fraud risk_score > 70, or no codes available (out of stock fallback).
      const orderTotal = price * quantity;

      // KINGUIN BALANCE PRE-CHECK — if we'll need to buy from Kinguin (deferred purchase)
      // and our current Kinguin balance is below the required cost, hold the order
      // for a "Security Review". Payment goes through normally; we'll top up balance
      // and fulfill manually within the hold window.
      let _kinguinBalanceShortfall = false;
      let _kinguinBalanceReason: string | null = null;
      if (deferredKinguin && deferredKinguin.expected_price != null) {
        try {
          const KINGUIN_API_KEY = Deno.env.get('KINGUIN_API_KEY');
          if (KINGUIN_API_KEY) {
            const balRes = await fetch('https://gateway.kinguin.net/esa/api/v1/balance', {
              headers: { 'X-Api-Key': KINGUIN_API_KEY },
              signal: AbortSignal.timeout(5000),
            });
            if (balRes.ok) {
              const balData = await balRes.json();
              const balance = Number(balData.balance ?? 0);
              const required = Number(deferredKinguin.expected_price) * deferredKinguin.qty;
              const requiredWithBuffer = required * 1.05; // 5% FX safety buffer
              if (balance < requiredWithBuffer) {
                _kinguinBalanceShortfall = true;
                _kinguinBalanceReason = `Security review — manual verification required (ref: SR-${Date.now().toString(36).toUpperCase()})`;
                console.log(`[fulfill-order] Kinguin balance shortfall: balance=€${balance.toFixed(2)} < required=€${required.toFixed(2)} for "${title}"`);

                // Telegram heads-up so admin can top up
                try {
                  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-notify`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    },
                    body: JSON.stringify({
                      type: 'stock',
                      title: '⏸ Order Held — Top Up Kinguin Balance',
                      message: `Order for "${title}" held for security review. Need €${required.toFixed(2)} on Kinguin (current: €${balance.toFixed(2)}). Customer was charged; top up to release the order.`,
                      meta: {
                        balance,
                        required,
                        product: title,
                        qty: deferredKinguin.qty,
                        paypal_order_id,
                      },
                    }),
                  });
                } catch (notifyErr) {
                  console.error('Telegram notify failed:', notifyErr);
                }
              }
            } else {
              console.error(`[fulfill-order] Kinguin balance API error [${balRes.status}]`);
            }
          }
        } catch (kbErr) {
          console.error('[fulfill-order] Kinguin balance check failed (non-blocking):', kbErr);
        }
      }

      const holdForBalance = !!(item as any)._holdForBalance || _kinguinBalanceShortfall;
      // Treat deferred Kinguin as "have stock" — we'll buy it on reveal.
      const noStock = !isAliExpressItem && allCodes.length < quantity && !deferredKinguin;
      const highValue = orderTotal >= HOLD_THRESHOLD_EUR;
      const adminHold = highValue || holdForBalance || tripleMatchMismatch || fraudHold || noStock;
      const holdReason = holdForBalance
        ? ((item as any)._holdBalanceReason || _kinguinBalanceReason || 'Security review — manual verification required')
        : tripleMatchMismatch
          ? `Geo mismatch: IP=${cfIpCountry || '?'}, Phone=${phoneCountry || '?'}, PayPal=${ppCountry || '?'}`
          : fraudHold
            ? `High fraud risk score (${userRiskScore} > ${FRAUD_SCORE_THRESHOLD})`
            : noStock
              ? `Awaiting stock replenishment (need ${quantity}, have ${allCodes.length})`
              : highValue
                ? `High-value order (€${orderTotal.toFixed(2)} ≥ €${HOLD_THRESHOLD_EUR})`
                : null;

      // ALL orders get a 10-minute cooling period; admin-held orders get 1 hour
      const heldUntil = adminHold
        ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + COOLING_PERIOD_MS).toISOString();

      // Insert order row
      const orderInsert: Record<string, any> = {
        user_id: user.id,
        game_title: title,
        platform: platform,
        price: orderTotal,
        quantity: quantity,
        paypal_order_id: paypal_order_id,
        image_url: image_url,
        status: adminHold ? 'held' : orderStatus,
        game_code: adminHold ? null : gameCodeStr,
        ip_address: buyerIp,
        user_agent: buyerUserAgent,
        buyer_country: buyerCountry,
        buyer_city: buyerCity,
        is_held: adminHold,
        held_until: heldUntil,
        held_reason: holdReason,
        // Persist the deferred Kinguin purchase even for held orders — otherwise
        // an admin approving the hold has no way to trigger the buy on reveal.
        pending_kinguin: deferredKinguin ? deferredKinguin : null,
      };

      // Generate a 32-byte random access token — historically used for the guest
      // reveal link. Guest checkout has been removed, but the column stays for
      // legacy rows and admin tooling.
      try {
        const tokenBytes = new Uint8Array(32);
        crypto.getRandomValues(tokenBytes);
        orderInsert.access_token = btoa(String.fromCharCode(...tokenBytes))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } catch {
        orderInsert.access_token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      }

      // Add shipping address for physical products
      if (isAliExpressItem && shipping_address) {
        orderInsert.shipping_full_name = shipping_address.full_name || null;
        orderInsert.shipping_address_line1 = shipping_address.address_line1 || null;
        orderInsert.shipping_address_line2 = shipping_address.address_line2 || null;
        orderInsert.shipping_city = shipping_address.city || null;
        orderInsert.shipping_state = shipping_address.state || null;
        orderInsert.shipping_zip_code = shipping_address.zip_code || null;
        orderInsert.shipping_country = shipping_address.country || null;
        orderInsert.shipping_phone = shipping_address.phone || null;
      }

      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert(orderInsert)
        .select()
        .single();

      if (orderError) {
        // 23505: this exact item was already created for this paypal_order_id
        // (concurrent client + webhook fulfillment). Treat as already fulfilled
        // instead of aborting — the payment is captured and codes were issued.
        if ((orderError as any)?.code === '23505') {
          console.log('Order row already exists for this item; skipping', paypal_order_id, title);
          continue;
        }
        throw new Error('Failed to create order: ' + orderError.message);
      }


      // If admin-held, store codes temporarily but don't expose to user
      if (adminHold && gameCodeStr) {
        await supabase
          .from('orders')
          .update({ game_code: gameCodeStr })
          .eq('id', orderRow.id);
        // Note: game_code is set but status is 'held', so the UI won't show it
      }

      // Insert kinguin order rows and sync stock after order creation
      if (pendingKinguinOrders.length > 0) {
        await supabase.from('kinguin_orders').insert(
          pendingKinguinOrders.map((entry) => ({
            order_id: orderRow.id,
            kinguin_order_id: entry.kinguin_order_id,
            kinguin_product_id: entry.kinguin_product_id,
            kinguin_price: entry.kinguin_price,
            status: entry.status,
            game_key: entry.game_key,
          }))
        );
      }

      // Real stock accounting for the Kinguin purchase happens later in
      // reveal-and-fulfill, once the purchase actually completes with live
      // data. There used to be a write here too, but it used
      // lastKnownKinguinStock — a variable that's declared but never
      // assigned anywhere — so it always wrote kinguin_stock: null,
      // is_active: false on every single deferred purchase, regardless of
      // real stock. That silently deactivated the product on every order,
      // not just when it was genuinely out of stock.

      // Mark each seller key as sold
      for (const key of sellerKeys) {
        await supabase
          .from('product_keys')
          .update({
            status: 'sold',
            sold_at: new Date().toISOString(),
            order_id: orderRow.id,
          })
          .eq('id', key.id);
      }

      // Create seller sale record
      if (sellerKeys.length > 0) {
        const sellerId = sellerKeys[0].seller_id;
        const saleAmount = price * sellerKeys.length;
        const commissionRate = 0.10;
        const commissionAmount = saleAmount * commissionRate;
        const netEarnings = saleAmount - commissionAmount;

        await supabase.from('seller_sales').insert({
          seller_id: sellerId,
          order_id: orderRow.id,
          product_title: title,
          platform: platform,
          sale_amount: saleAmount,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          net_earnings: netEarnings,
          status: 'completed',
        });
      }

      const source = sellerKeys.length > 0 && usedKinguinPurchase ? 'hybrid'
        : sellerKeys.length > 0 ? 'seller'
        : usedKinguinPurchase ? 'kinguin'
        : isAliExpressItem ? 'aliexpress'
        : 'none';

      // Increment sold_count on allowed_products
      await supabase.rpc('increment_sold_count' as any, { _product_id: offerId, _qty: quantity });

      results.push({
        game_title: title,
        order_id: orderRow.id,
        game_codes: allCodes,
        source,
        ...(holdForBalance ? { held_for_balance: true } : {}),
        is_held: adminHold,
        held_reason: holdReason,
        access_token: orderInsert.access_token,
      });
    }

    // Coins-per-purchase temporarily disabled too, alongside redemption
    // (see coinsToRedeem above) — this specific path is server-computed from
    // the real paid amount and was never implicated in any incident, but is
    // included for a full, unambiguous freeze until coins are re-enabled.
    const coinsEarned = 0;

    // Deduct redeemed coins and add earned coins
    if (coinsToRedeem > 0 || coinsEarned > 0) {
      const { data: existingCoins } = await supabase
        .from('user_coins')
        .select('balance, total_earned, total_spent')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingCoins) {
        // Verify sufficient balance for redemption
        if (coinsToRedeem > 0 && existingCoins.balance < coinsToRedeem) {
          throw new Error('Insufficient Blaze Coins balance');
        }
        await supabase
          .from('user_coins')
          .update({
            balance: parseFloat((existingCoins.balance + coinsEarned - coinsToRedeem).toFixed(2)),
            total_earned: parseFloat((existingCoins.total_earned + coinsEarned).toFixed(2)),
            total_spent: parseFloat((existingCoins.total_spent + coinsToRedeem).toFixed(2)),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      } else {
        // Create new coin record (no redemption possible if no existing record)
        if (coinsToRedeem > 0) {
          throw new Error('Insufficient Blaze Coins balance');
        }
        await supabase
          .from('user_coins')
          .insert({
            user_id: user.id,
            balance: coinsEarned,
            total_earned: coinsEarned,
            total_spent: 0,
          });
      }
    }

    // Complete referral if applicable (first purchase triggers reward)
    try {
      await supabase.rpc('complete_referral', {
        _referred_user_id: user.id,
        _order_id: results[0]?.order_id || null,
        _coins: 50,
      });
    } catch (refErr) {
      console.error('Referral completion skipped:', refErr);
    }

    // Send admin notification email for each order
    for (const r of results) {
      const matchingItem = items.find((i: any) => i.title === r.game_title);
      const isHeld = (r as any).held_for_balance || (r as any).is_held || (r as any).status === 'held';
      // Only identity/geo mismatch holds need the "verify your PayPal" narrative.
      // Every other hold reason (high value, out of stock, balance, fraud score)
      // gets the generic "under review" copy — asking for a PayPal screenshot
      // there would be misleading.
      const heldReasonStr = String((r as any).held_reason || '');
      const isIdentityMismatchHold = /^(PayPal identity mismatch|Geo mismatch)/i.test(heldReasonStr);
      // Notify the CUSTOMER if their order is on hold for any reason
      if (isHeld && user.email) {
        // Email and chat notification are independent — a failure in one
        // must not prevent the other from being attempted.
        try {
          const { error: emailErr } = await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: isIdentityMismatchHold ? 'order-verification-required' : 'order-under-review',
              recipientEmail: user.email,
              idempotencyKey: `under-review-${r.order_id}`,
              templateData: {
                customerName: (user.user_metadata as any)?.first_name || (user.user_metadata as any)?.full_name || null,
                productTitle: r.game_title,
                orderId: r.order_id,
                amount: matchingItem ? `€${(matchingItem.price * (matchingItem.quantity || 1)).toFixed(2)}` : undefined,
                ...(isIdentityMismatchHold ? {
                  verificationMessage: "Hi again! Your order is currently under a routine security review because the account details used on our site don't match your PayPal payment information. To protect your account and complete the delivery, could you please confirm that you authorized this payment? A screenshot of your PayPal transaction confirmation would help us release the code immediately. Thank you for your patience!",
                } : {}),
              },
            },
          });
          if (emailErr) throw emailErr;
        } catch (emailNotifyErr) {
          console.error('Customer notification (email) failed:', emailNotifyErr);
        }

        try {
          // Automated internal chat message for verification.
          // Try to find or create a support request for this user to send the automated chat message
          const { data: supportReq, error: supportReqErr } = await supabase
            .from('live_support_requests')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .limit(1)
            .maybeSingle();

          let requestId = supportReq?.id;
          if (!requestId && !supportReqErr) {
            const { data: newReq } = await supabase
              .from('live_support_requests')
              .insert({
                user_id: user.id,
                user_email: user.email,
                status: 'pending'
              })
              .select('id')
              .single();
            requestId = newReq?.id;
          }

          if (requestId) {
            const verificationMessage = isIdentityMismatchHold
              ? "Hi! Your order is currently under a routine security review because your account details (email or phone) don't match your PayPal payment information. To protect your account and complete the delivery, could you please confirm that you authorized this payment? A screenshot of your PayPal transaction confirmation would help us release the code immediately. Thank you for your patience!"
              : "Hi! Your order is currently under a routine manual review before we can release your code. No action is needed from you right now — our team is checking it and will update you here as soon as it's approved. If you have any questions, just reply in this chat.";

            await supabase.from('live_chat_messages').insert({
              request_id: requestId,
              sender_id: '00000000-0000-0000-0000-000000000000', // System/Admin UUID placeholder or actual Admin ID if available
              sender_role: 'admin',
              content: verificationMessage
            });
          }
        } catch (chatNotifyErr) {
          console.error('Customer notification (chat) failed:', chatNotifyErr);
        }
      }
      try {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'admin-new-order',
            recipientEmail: 'admin@agevers.com',
            idempotencyKey: `admin-notify-${r.order_id}`,
            templateData: {
              orderId: r.order_id,
              gameTitle: r.game_title,
              platform: matchingItem?.platform || 'Unknown',
              quantity: matchingItem?.quantity || 1,
              price: `€${(matchingItem?.price * (matchingItem?.quantity || 1)).toFixed(2)}`,
              buyerEmail: user.email || 'unknown',
              source: r.source,
              status: r.held_for_balance ? 'held' : (r.game_codes.length >= (matchingItem?.quantity || 1) ? 'completed' : 'processing'),
              buyerCountry: buyerCountry || '—',
            },
          },
        });
      } catch (emailErr) {
        console.error('Admin notification email failed:', emailErr);
      }

      // Telegram alert to admin chat (direct API — independent of the email result)
      try {
        const tgToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        const tgChatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');
        if (tgToken && tgChatId) {
          const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const qty = matchingItem?.quantity || 1;
          const statusTxt = r.held_for_balance ? 'held' : (r.game_codes.length >= qty ? 'completed' : 'processing');
          const text = `🛒 <b>New Order</b>\n\n` +
            `• <b>Order</b>: ${esc(r.order_id)}\n` +
            `• <b>Product</b>: ${esc(r.game_title)}\n` +
            `• <b>Platform</b>: ${esc(matchingItem?.platform || 'Unknown')}\n` +
            `• <b>Qty</b>: ${qty}\n` +
            `• <b>Total</b>: €${((matchingItem?.price || 0) * qty).toFixed(2)}\n` +
            `• <b>Buyer</b>: ${esc(user.email || 'unknown')} (${esc(buyerCountry || '—')})\n` +
            `• <b>Source</b>: ${esc(r.source)}\n` +
            `• <b>Status</b>: ${esc(statusTxt)}\n\n` +
            `<i>Agever's Admin • ${new Date().toISOString()}</i>`;
          const tgRes = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: tgChatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
          });
          if (!tgRes.ok) console.error('Telegram order alert failed', tgRes.status, await tgRes.text());
        } else {
          console.error('Telegram secrets missing for order alert');
        }
      } catch (tgErr) {
        console.error('Telegram order alert error:', tgErr);
      }

    }

    return new Response(JSON.stringify({ success: true, results, coins_earned: coinsEarned, coins_redeemed: coinsToRedeem, discount_applied: discountFromCoins }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Fulfill order error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
