import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getPaypalToken() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const secret = Deno.env.get('PAYPAL_SECRET');
  if (!clientId || !secret) throw new Error('PayPal not configured');
  const isLive = Deno.env.get('PAYPAL_LIVE')?.toLowerCase() === 'true';
  const baseUrl = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${btoa(`${clientId}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('PayPal auth failed');
  return { token: json.access_token, baseUrl };
}

// Send a Telegram alert via the internal telegram-notify endpoint.
// telegram-notify authenticates on INTERNAL_NOTIFY_TOKEN_V2 first and accepts
// a service-role bearer as an alternative. Sending only the pre-rotation token
// meant every alert from here was silently 401'd — which is why 10 days of
// card-payment failures produced no alert at all. Send both credentials, and
// never swallow the failure without a trace again.
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

// ---- Identity match helpers ----
function norm(s: any): string {
  return String(s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}
function digits(s: any): string {
  return String(s ?? '').replace(/\D+/g, '');
}
function namesOverlap(a: string, b: string): boolean {
  if (!a || !b) return false;
  const at = new Set(a.split(' ').filter(t => t.length >= 2));
  const bt = new Set(b.split(' ').filter(t => t.length >= 2));
  for (const t of at) if (bt.has(t)) return true;
  return false;
}

// Dialing-prefix -> ISO country. Used to detect a phone that belongs to a
// different country than the PayPal account.
//
// '1' is NOT unique to the US — it's the shared NANP prefix for the US,
// Canada, and ~18 Caribbean territories, and there's no way to tell them
// apart from just the leading digits (would need area-code data). Mapped to
// the 'NANP' sentinel instead of guessing 'US', so a genuine Canadian buyer
// with a +1 phone and a Canadian PayPal account isn't wrongly flagged as a
// country mismatch — see isNanpCompatible() below for how it's compared.
const PHONE_PREFIX_COUNTRY: Record<string, string> = {
  '1': 'NANP', '7': 'RU', '20': 'EG', '27': 'ZA', '30': 'GR', '31': 'NL', '32': 'BE',
  '33': 'FR', '34': 'ES', '36': 'HU', '39': 'IT', '40': 'RO', '41': 'CH', '43': 'AT',
  '44': 'GB', '45': 'DK', '46': 'SE', '47': 'NO', '48': 'PL', '49': 'DE', '51': 'PE',
  '52': 'MX', '53': 'CU', '54': 'AR', '55': 'BR', '56': 'CL', '57': 'CO', '58': 'VE',
  '60': 'MY', '61': 'AU', '62': 'ID', '63': 'PH', '64': 'NZ', '65': 'SG', '66': 'TH',
  '81': 'JP', '82': 'KR', '84': 'VN', '86': 'CN', '90': 'TR', '91': 'IN', '92': 'PK',
  '93': 'AF', '94': 'LK', '95': 'MM', '98': 'IR', '212': 'MA', '213': 'DZ', '216': 'TN',
  '218': 'LY', '220': 'GM', '221': 'SN', '233': 'GH', '234': 'NG', '237': 'CM',
  '243': 'CD', '249': 'SD', '251': 'ET', '254': 'KE', '255': 'TZ', '256': 'UG',
  '260': 'ZM', '263': 'ZW', '351': 'PT', '352': 'LU', '353': 'IE', '354': 'IS',
  '355': 'AL', '356': 'MT', '357': 'CY', '358': 'FI', '359': 'BG', '370': 'LT',
  '371': 'LV', '372': 'EE', '373': 'MD', '374': 'AM', '375': 'BY', '380': 'UA',
  '381': 'RS', '385': 'HR', '386': 'SI', '387': 'BA', '389': 'MK', '420': 'CZ',
  '421': 'SK', '423': 'LI', '502': 'GT', '503': 'SV', '504': 'HN', '505': 'NI',
  '506': 'CR', '507': 'PA', '509': 'HT', '591': 'BO', '593': 'EC', '595': 'PY',
  '598': 'UY', '852': 'HK', '853': 'MO', '855': 'KH', '856': 'LA', '880': 'BD',
  '886': 'TW', '960': 'MV', '961': 'LB', '962': 'JO', '963': 'SY', '964': 'IQ',
  '965': 'KW', '966': 'SA', '967': 'YE', '968': 'OM', '970': 'PS', '971': 'AE',
  '972': 'IL', '973': 'BH', '974': 'QA', '975': 'BT', '976': 'MN', '977': 'NP',
  '992': 'TJ', '993': 'TM', '994': 'AZ', '995': 'GE', '996': 'KG', '998': 'UZ',
};
function phoneCountryOf(rawPhone: any): string {
  const d = digits(rawPhone);
  if (!d) return '';
  for (let len = 4; len >= 1; len--) {
    const p = d.slice(0, len);
    if (PHONE_PREFIX_COUNTRY[p]) return PHONE_PREFIX_COUNTRY[p];
  }
  return '';
}

// ISO countries/territories that share the +1 NANP dialing prefix. A phone
// resolved to the 'NANP' sentinel can't be pinned to one of these without
// area-code data, so it's treated as compatible with any of them.
const NANP_COUNTRIES = new Set([
  'US', 'CA', 'AG', 'AI', 'AS', 'BB', 'BM', 'BS', 'DM', 'DO', 'GD', 'GU',
  'JM', 'KN', 'KY', 'LC', 'MP', 'MS', 'PR', 'SX', 'TC', 'TT', 'VC', 'VG', 'VI',
]);
// True when a phone-derived country and a PayPal/site country could plausibly
// be the same real country, given what we can actually tell from a phone
// number alone. Exact match is always compatible; a 'NANP' phone is
// compatible with any NANP country (can't distinguish US/Canada/etc. from
// the dialing prefix alone) rather than assuming a specific one.
function isNanpCompatible(phoneCountry: string, otherCountry: string): boolean {
  if (phoneCountry === otherCountry) return true;
  if (phoneCountry === 'NANP') return NANP_COUNTRIES.has(otherCountry);
  return false;
}


async function comparePayerIdentity(supabase: any, userId: string, userEmail: string | null, payer: any, shipping: any) {
  const mismatches: Array<{ field: string; severity: 'low' | 'medium' | 'high'; site: string; paypal: string; points: number }> = [];

  const ppEmail = norm(payer?.email_address);
  const ppGiven = norm(payer?.name?.given_name);
  const ppSurname = norm(payer?.name?.surname);
  const ppFullName = norm(`${ppGiven} ${ppSurname}`);
  const ppCountry = String(payer?.address?.country_code || '').toUpperCase();
  const ppPhoneDigits = digits(payer?.phone?.phone_number?.national_number);
  const shipName = norm(shipping?.name?.full_name);
  const shipCountry = String(shipping?.address?.country_code || '').toUpperCase();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, phone, country')
    .eq('user_id', userId)
    .maybeSingle();

  const siteEmail = norm(userEmail);
  const siteName = norm(profile?.display_name);
  const sitePhone = digits(profile?.phone);
  const siteCountry = String(profile?.country || '').toUpperCase();

  // Email
  if (ppEmail && siteEmail && ppEmail !== siteEmail) {
    mismatches.push({ field: 'email', severity: 'high', site: siteEmail, paypal: ppEmail, points: 40 });
  }
  // Country (compare full word vs ISO-2; do a loose contains check too)
  if (ppCountry && siteCountry) {
    const same = ppCountry === siteCountry ||
      siteCountry.startsWith(ppCountry) ||
      ppCountry.startsWith(siteCountry.slice(0, 2));
    if (!same) {
      mismatches.push({ field: 'country', severity: 'high', site: siteCountry, paypal: ppCountry, points: 30 });
    }
  }
  // Shipping vs PayPal country (different country to ship)
  if (shipCountry && ppCountry && shipCountry !== ppCountry) {
    mismatches.push({ field: 'shipping_country', severity: 'medium', site: shipCountry, paypal: ppCountry, points: 15 });
  }
  // Name
  if (ppFullName && siteName && !namesOverlap(ppFullName, siteName)) {
    mismatches.push({ field: 'name', severity: 'medium', site: siteName, paypal: ppFullName, points: 15 });
  }
  // Shipping name vs PayPal name
  if (shipName && ppFullName && !namesOverlap(shipName, ppFullName)) {
    mismatches.push({ field: 'shipping_name', severity: 'low', site: shipName, paypal: ppFullName, points: 5 });
  }
  // Phone number differs from the PayPal phone -> manual review (high).
  if (ppPhoneDigits && sitePhone) {
    const a = ppPhoneDigits.slice(-9);
    const b = sitePhone.slice(-9);
    if (a !== b) {
      mismatches.push({ field: 'phone', severity: 'high', site: sitePhone, paypal: ppPhoneDigits, points: 25 });
    }
  }
  // Site phone belongs to a different country than the PayPal account -> manual review (high).
  // Compared against the PayPal account's own country (ppCountry), not the
  // phone's national_number, which PayPal never includes a dialing code for
  // and so can't be resolved to a country on its own (see phoneCountryOf).
  const sitePhoneCountry = phoneCountryOf(profile?.phone);
  if (sitePhoneCountry && ppCountry && !isNanpCompatible(sitePhoneCountry, ppCountry)) {
    mismatches.push({ field: 'phone_country', severity: 'high', site: sitePhoneCountry, paypal: ppCountry, points: 30 });
  }


  // Cross-order consistency: prior PayPal-paid orders from a different country
  const { data: priorOrders } = await supabase
    .from('orders')
    .select('buyer_country, paypal_payer_snapshot, created_at')
    .eq('user_id', userId)
    .not('paypal_order_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);
  const priorCountries = new Set<string>();
  for (const o of priorOrders || []) {
    const c = String((o as any)?.paypal_payer_snapshot?.payer?.address?.country_code || o?.buyer_country || '').toUpperCase();
    if (c) priorCountries.add(c);
  }
  if (ppCountry) priorCountries.add(ppCountry);
  if (priorCountries.size > 1) {
    mismatches.push({
      field: 'multi_country_purchases',
      severity: 'high',
      site: Array.from(priorCountries).join(','),
      paypal: ppCountry,
      points: 25,
    });
  }

  return { mismatches, snapshot: { payer, shipping, captured_at: new Date().toISOString() } };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');
    const userToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(userToken);
    if (authErr || !user) throw new Error('Not authenticated');

    const { paypal_order_id } = await req.json();
    if (!paypal_order_id) throw new Error('Missing paypal_order_id');

    // The buyer's real IP. This function IS called straight from the browser,
    // so its headers carry the buyer's address; fulfill-order is then called
    // server-to-server and would otherwise only see this server's own IP.
    const isValidIp = (ip: string | null | undefined): ip is string => {
      if (!ip) return false;
      const v4 = /^(\d{1,3}\.){3}\d{1,3}$/;
      const v6 = /^[0-9a-fA-F:]+$/;
      return (v4.test(ip) || (v6.test(ip) && ip.includes(':'))) && ip.length <= 45;
    };
    const buyerClientIp = [
      req.headers.get('cf-connecting-ip'),
      req.headers.get('true-client-ip'),
      req.headers.get('x-real-ip'),
      req.headers.get('x-client-ip'),
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    ].find(isValidIp) || null;
    const buyerCfCountry = (req.headers.get('cf-ipcountry') || '').toUpperCase();

    // Load pending row (must belong to caller)
    const { data: pending, error: pendingErr } = await supabase
      .from('pending_paypal_orders')
      .select('*')
      .eq('paypal_order_id', paypal_order_id)
      .maybeSingle();
    if (pendingErr) throw new Error(pendingErr.message);
    if (!pending) throw new Error('Pending order not found');
    if (pending.user_id !== user.id) throw new Error('Forbidden');

    // Idempotency: if orders row already exists, return success
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('paypal_order_id', paypal_order_id)
      .limit(1)
      .maybeSingle();
    if (existingOrder) {
      return new Response(JSON.stringify({ success: true, already_fulfilled: true, paypal_order_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Capture via PayPal API
    const { token, baseUrl } = await getPaypalToken();
    const capRes = await fetch(`${baseUrl}/v2/checkout/orders/${paypal_order_id}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `cap-${pending.id}` },
    });
    const capJson = await capRes.json();

    // Treat already-captured as success
    const isAlreadyCaptured = capJson?.name === 'UNPROCESSABLE_ENTITY' && Array.isArray(capJson?.details) &&
      capJson.details.some((d: any) => d?.issue === 'ORDER_ALREADY_CAPTURED');

    if (!capRes.ok && !isAlreadyCaptured) {
      await supabase.from('pending_paypal_orders').update({ status: 'failed', last_error: JSON.stringify(capJson) }).eq('id', pending.id);
      const issue = Array.isArray(capJson?.details) ? capJson.details[0]?.issue : null;
      const isCredsMismatch = capJson?.name === 'RESOURCE_NOT_FOUND' || issue === 'INVALID_RESOURCE_ID';
      // Alert on ALL capture failures — buyer already approved on PayPal, so any
      // failure here means we may have lost a paid customer.
      await notifyTg(
        'fraud',
        isCredsMismatch ? '🚨 PayPal Capture: RESOURCE_NOT_FOUND' : '🚨 PayPal Capture Failed',
        isCredsMismatch
          ? `PayPal can't find order ${paypal_order_id}. Likely PAYPAL_CLIENT_ID/SECRET mismatch with the merchant account. Buyers cannot complete payment.`
          : `Capture failed for order ${paypal_order_id} (${capRes.status}). Buyer approved on PayPal but capture rejected — investigate.`,
        { paypal_order_id, pending_id: pending.id, http_status: capRes.status, name: capJson?.name, issue, message: capJson?.message },
      );
      // Map known PayPal issues to a clear, user-facing message and return a
      // structured 200 response so the browser shows it instead of a raw 500.
      const friendly: Record<string, string> = {
        ORDER_NOT_APPROVED: 'The payment was not approved in the PayPal window. Please click Pay again and complete the approval.',
        PAYER_ACTION_REQUIRED: 'PayPal needs one more confirmation step. Please reopen the PayPal window and finish the payment.',
        INSTRUMENT_DECLINED: 'Your payment method was declined by PayPal. Please try another card or PayPal balance.',
        PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING: 'Card payments are temporarily unavailable. Please pay using your PayPal balance or account instead.',
        INVALID_RESOURCE_ID: 'This payment session expired. Please refresh the page and try again.',
      };
      const userMessage = (issue && friendly[issue])
        || (isCredsMismatch ? friendly.INVALID_RESOURCE_ID : null)
        || 'Payment could not be completed. You have not been charged. Please try again or contact support.';
      return new Response(JSON.stringify({ success: false, error: userMessage, code: issue || capJson?.name || 'capture_failed' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    if (!isAlreadyCaptured) {
      const status = capJson?.status;
      const capStatus = capJson?.purchase_units?.[0]?.payments?.captures?.[0]?.status;
      if (status !== 'COMPLETED' && capStatus !== 'COMPLETED') {
        await supabase.from('pending_paypal_orders').update({ status: 'failed', last_error: `Capture status: ${status}/${capStatus}` }).eq('id', pending.id);
        await notifyTg('fraud', '🚨 PayPal Capture Not Completed',
          `Order ${paypal_order_id} returned status ${status}/${capStatus} instead of COMPLETED.`,
          { paypal_order_id, pending_id: pending.id, status, capStatus });
        throw new Error(`Capture not completed: ${status || capStatus}`);
      }
    }

    await supabase.from('pending_paypal_orders').update({ status: 'captured' }).eq('id', pending.id);

    // -------- PayPal vs site identity verification --------
    let payerSnapshot: any = null;
    let identityHoldReason: string | null = null;
    // PayPal account country — forwarded to fulfill-order so its Triple-Match
    // geo check always has this data point (it used to silently read '' and
    // then compare only two points, which can never disagree).
    let payerAccountCountry = '';
    try {
      // Fetch full order details (capJson may be partial in already-captured branch)
      const detailsRes = await fetch(`${baseUrl}/v2/checkout/orders/${paypal_order_id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const details = await detailsRes.json();
      const payer = details?.payer || capJson?.payer || {};
      const shipping = details?.purchase_units?.[0]?.shipping || capJson?.purchase_units?.[0]?.shipping || {};

      // How the buyer actually paid: an existing PayPal account, or a card
      // entered directly (guest checkout). PayPal never exposes the funding
      // instrument *within* a PayPal-account payment (balance vs linked
      // card/bank) to merchants — only this top-level distinction.
      const paymentSource = details?.payment_source || capJson?.payment_source || {};
      const paymentSourceType: string | null = paymentSource.card ? 'card' : paymentSource.paypal ? 'paypal_account' : null;
      const paymentSourceDetail: string | null = paymentSource.card
        ? [paymentSource.card.brand, paymentSource.card.last_digits ? `••${paymentSource.card.last_digits}` : null].filter(Boolean).join(' ') || null
        : null;

      payerAccountCountry = String(payer?.address?.country_code || '').toUpperCase();

      const { mismatches, snapshot } = await comparePayerIdentity(supabase, user.id, user.email || null, payer, shipping);
      payerSnapshot = { ...snapshot, mismatches };

      await supabase
        .from('pending_paypal_orders')
        .update({
          paypal_payer_snapshot: payerSnapshot,
          payment_source_type: paymentSourceType,
          payment_source_detail: paymentSourceDetail,
        })
        .eq('id', pending.id);

      if (mismatches.length > 0) {
        const totalPoints = mismatches.reduce((s, m) => s + m.points, 0);
        const highSeverity = mismatches.filter(m => m.severity === 'high');

        // Insert one fraud flag per mismatch
        const flagRows = mismatches.map(m => ({
          user_id: user.id,
          flag_type: `paypal_${m.field}_mismatch`,
          severity: m.severity,
          description: `PayPal ${m.field} (${m.paypal || 'n/a'}) does not match site ${m.field} (${m.site || 'n/a'})`,
          metadata: { paypal_order_id, ...m },
        }));
        if (flagRows.length) {
          await supabase.from('fraud_flags').insert(flagRows);
        }

        // Bump fraud_scores risk_score so fulfill-order applies its existing hold logic
        const { data: existingScore } = await supabase
          .from('fraud_scores')
          .select('risk_score, total_flags')
          .eq('user_id', user.id)
          .maybeSingle();
        const currentScore = existingScore?.risk_score ?? 0;
        const newScore = Math.min(100, currentScore + totalPoints);
        const riskLevel = newScore >= 80 ? 'critical' : newScore >= 60 ? 'high' : newScore >= 30 ? 'medium' : 'low';
        await supabase.from('fraud_scores').upsert({
          user_id: user.id,
          risk_score: newScore,
          risk_level: riskLevel,
          total_flags: (existingScore?.total_flags ?? 0) + flagRows.length,
          last_flag_at: new Date().toISOString(),
          notes: `PayPal identity mismatch (${mismatches.map(m => m.field).join(', ')})`,
        }, { onConflict: 'user_id' });

        if (highSeverity.length > 0) {
          identityHoldReason = `PayPal identity mismatch: ${highSeverity.map(m => m.field).join(', ')}`;
        }
      }
    } catch (idErr) {
      console.error('paypal identity check failed:', idErr);
    }

    // Fulfill via fulfill-order using the user's JWT
    const fulfillRes = await fetch(`${SUPABASE_URL}/functions/v1/fulfill-order`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
        // Authenticates the forwarded buyer-origin data below, so fulfill-order
        // can trust it instead of reading this server's own IP.
        'x-internal-origin-key': SUPABASE_SERVICE_ROLE_KEY,
        ...(buyerClientIp ? { 'x-internal-client-ip': buyerClientIp } : {}),
        ...(buyerCfCountry ? { 'x-internal-client-country': buyerCfCountry } : {}),
      },
      body: JSON.stringify({
        paypal_order_id,
        items: pending.items,
        redeem_coins: pending.redeem_coins,
        shipping_address: pending.shipping_address || undefined,
        selected_shipping: pending.selected_shipping || undefined,
        paypal_country: payerAccountCountry || undefined,
      }),
    });
    const fulfillJson = await fulfillRes.json();
    if (!fulfillRes.ok || (fulfillJson?.error && !fulfillJson?.success)) {
      await supabase.from('pending_paypal_orders').update({ status: 'failed', last_error: `Fulfill: ${fulfillJson?.error || fulfillRes.status}` }).eq('id', pending.id);
      await notifyTg('fraud', '🚨 PayPal Fulfillment Failed (post-capture)',
        `Payment CAPTURED but fulfill-order failed for ${paypal_order_id}. Customer paid but got nothing — manual recovery required.`,
        { paypal_order_id, pending_id: pending.id, error: fulfillJson?.error, http_status: fulfillRes.status });
      throw new Error(fulfillJson?.error || 'Fulfillment failed');
    }

    await supabase.from('pending_paypal_orders').update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() }).eq('id', pending.id);

    // Count the discount-code redemption server-side, only after a confirmed payment.
    // (The client used to call increment_coupon_usage directly, which allowed anyone
    // to burn through a coupon's max_uses without buying anything.)
    try {
      const couponId = (pending as any)?.applied_coupon?.id;
      if (couponId) {
        const { error: couponErr } = await supabase.rpc('increment_coupon_usage', { _coupon_id: couponId });
        if (couponErr) console.error('increment_coupon_usage failed:', couponErr.message);
      }
    } catch (couponEx) {
      console.error('increment_coupon_usage threw:', couponEx);
    }

    // Stamp orders rows with the payer snapshot, and apply identity hold if needed
    if (payerSnapshot) {
      const orderPatch: any = { paypal_payer_snapshot: payerSnapshot };
      if (identityHoldReason) {
        orderPatch.is_held = true;
        orderPatch.held_reason = identityHoldReason;
      }
      await supabase.from('orders').update(orderPatch).eq('paypal_order_id', paypal_order_id);
    }

    return new Response(JSON.stringify({ success: true, paypal_order_id, fulfill: fulfillJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('paypal-capture-order error:', err);
    // Top-level catch — ensures ANY unhandled failure produces a Telegram ping.
    await notifyTg('fraud', '🚨 PayPal Capture — Unhandled Error',
      `paypal-capture-order threw: ${err?.message || 'unknown'}`, { error: String(err?.message || err) });
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});