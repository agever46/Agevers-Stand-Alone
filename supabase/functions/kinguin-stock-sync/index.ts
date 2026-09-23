import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceOrInternal, requireAdminOrService } from "../_shared/adminAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KINGUIN_API = 'https://gateway.kinguin.net/esa/api';
const KINGUIN_MARKUP = 0.0735;
const BATCH_SIZE = 1000;       // products per cron invocation (cron runs every 5 hours — see 'kinguin-stock-sync-every-5-hours')
const CONCURRENCY = 15;        // parallel kinguin API calls (safe rate ~17 req/s)
const SOFT_TIMEOUT_MS = 55_000; // stop processing new chunks after ~55s (edge functions have a hard wall-clock limit)

function applyKinguinMarkup(cost: number): number {
  return cost * (1 + KINGUIN_MARKUP);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Retry on 5xx / 429 / network errors — these usually clear on the next try and
// should never be treated as "confirmed out of stock".
async function fetchWithRetry(url: string, init: RequestInit, attempts = 3, timeoutMs = 10000): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`Kinguin API ${res.status}`);
      } else {
        return res;
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 300 * Math.pow(3, i)));
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetchWithRetry failed');
}

function calculateSellPrice(
  cost: number,
  rules: { max_cost: number; margin_pct: number }[],
  settings: { fixed_fee: number; platform_pct: number },
): number {
  const adjustedCost = applyKinguinMarkup(cost);
  const sorted = [...rules].sort((a, b) => a.max_cost - b.max_cost);
  let margin = 0.04;
  for (const rule of sorted) {
    if (adjustedCost <= rule.max_cost) { margin = rule.margin_pct; break; }
  }
  const rawPrice = (adjustedCost + settings.fixed_fee) / (1 - settings.platform_pct - margin);
  return Math.ceil(rawPrice * 100) / 100;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  // Cron/webhook callers use the service-role key; the manual "Run now"
  // button in Admin > Sync Center calls this with the logged-in admin's own
  // session instead, so fall back to an admin-role check for that case.
  const internalOk = await requireServiceOrInternal(req, corsHeaders) === null;
  if (!internalOk) {
    const denied = await requireAdminOrService(req, corsHeaders);
    if (denied) return denied;
  }

  // Auth-only canary probe used by cron-health-monitor: confirms the
  // service-role/internal-token header still works without running a real sync.
  if (new URL(req.url).searchParams.get('healthCheckOnly') === '1') {
    return new Response(JSON.stringify({ ok: true, healthCheck: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const KINGUIN_API_KEY = Deno.env.get('KINGUIN_API_KEY');
    if (!KINGUIN_API_KEY) throw new Error('KINGUIN_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const runStart = Date.now();
    const startedAtIso = new Date(runStart).toISOString();
    // Create the run row up-front so the dashboard can show "in progress"
    const { data: runRow } = await supabase
      .from('kinguin_sync_runs')
      .insert({ started_at: startedAtIso, status: 'running' })
      .select('id')
      .single();
    const runId = runRow?.id as string | undefined;

    // Allow opt-in for full sync (admin tool); default = batched cron mode
    let fullSync = false;
    let limit = BATCH_SIZE;
    let topupRules: { max_cost: number; margin_pct: number }[] | null = null;
    try {
      if (req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        if (body?.fullSync === true) fullSync = true;
        if (typeof body?.limit === 'number' && body.limit > 0) limit = Math.min(body.limit, 5000);
      }
    } catch (_) { /* ignore */ }

    // Fetch pricing rules ONCE so we can recalc sell_price when kinguin_price changes
    const [rulesRes, topupRulesRes, settingsRes] = await Promise.all([
      supabase.from('pricing_rules').select('max_cost, margin_pct').order('tier_order'),
      supabase.from('pricing_rules_topups').select('max_cost, margin_pct').order('tier_order'),
      supabase.from('pricing_settings').select('fixed_fee, platform_pct').eq('id', 1).single(),
    ]);
    const pricingRules = rulesRes.data?.length ? rulesRes.data : [
      { max_cost: 2, margin_pct: 0.10 },
      { max_cost: 50, margin_pct: 0.065 },
      { max_cost: 150, margin_pct: 0.055 },
      { max_cost: 99999, margin_pct: 0.04 },
    ];
    topupRules = topupRulesRes.data?.length ? topupRulesRes.data : pricingRules;
    const pricingSettings = settingsRes.data || { fixed_fee: 0.50, platform_pct: 0.05 };

    // Safety net: products manually marked as overpriced must never be kept active
    // by automated stock/price syncs.
    await supabase
      .from('kinguin_products')
      .update({
        is_active: false,
        last_change_summary: 'deactivated (overpriced flag)',
        last_change_at: new Date().toISOString(),
        last_change_source: 'cron',
      })
      .eq('is_overpriced', true)
      .eq('is_active', true);

    // Pick the OLDEST-checked ACTIVE products first so the whole catalog rotates fast.
    let query = supabase
      .from('kinguin_products')
      .select('id, kinguin_product_id, allowed_product_id, kinguin_price, sell_price, kinguin_stock, is_active, is_overpriced')
      .eq('is_active', true)
      .eq('is_overpriced', false)
      .order('last_stock_check', { ascending: true, nullsFirst: true });
    if (!fullSync) query = query.limit(limit);
    const { data: activeProducts, error } = await query;
    if (error) throw new Error('Failed to fetch kinguin products: ' + error.message);

    // Also recheck a small batch of currently-INACTIVE products. Without this,
    // a product deactivated for stock=0 (or a transient API hiccup) can never
    // come back automatically — the query above only ever looks at is_active=true
    // rows, so restocked items would stay hidden forever unless Kinguin happens
    // to send a webhook for that exact SKU.
    const RECHECK_INACTIVE_BATCH = 150;
    const { data: inactiveRecheck } = await supabase
      .from('kinguin_products')
      .select('id, kinguin_product_id, allowed_product_id, kinguin_price, sell_price, kinguin_stock, is_active, is_overpriced')
      .eq('is_active', false)
      .eq('is_overpriced', false)
      .not('kinguin_product_id', 'is', null)
      .order('last_stock_check', { ascending: true, nullsFirst: true })
      .limit(fullSync ? 100000 : RECHECK_INACTIVE_BATCH);

    const kinguinProducts = [...(activeProducts || []), ...(inactiveRecheck || [])];
    if (kinguinProducts.length === 0) {
      return new Response(JSON.stringify({ message: 'No kinguin products to sync', updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pre-fetch allowed_products store info to know which pricing rule set to use
    const allowedIds = [...new Set(kinguinProducts.map(p => p.allowed_product_id).filter(Boolean))];
    const storeMap = new Map<string, string>();
    if (allowedIds.length > 0) {
      const { data: ap } = await supabase
        .from('allowed_products')
        .select('id, store, tab_category')
        .in('id', allowedIds);
      for (const row of ap || []) {
        const isTopup = row.store === 'Top Ups' || row.store === 'Gift Cards' || row.tab_category === 'topups';
        storeMap.set(row.id, isTopup ? 'topup' : 'standard');
      }
    }

    // --- Expire products past their expiration_date ---
    let expired = 0;
    const { data: expiredProducts } = await supabase
      .from('allowed_products')
      .select('id, title')
      .not('expiration_date', 'is', null)
      .lte('expiration_date', new Date().toISOString());

    if (expiredProducts && expiredProducts.length > 0) {
      for (const ep of expiredProducts) {
        // Deactivate linked kinguin products
        await supabase
          .from('kinguin_products')
          .update({ is_active: false, kinguin_stock: 0, last_stock_check: new Date().toISOString() })
          .eq('allowed_product_id', ep.id)
          .eq('is_active', true);
        
        // Deactivate linked manual seller products
        await supabase
          .from('products')
          .update({ status: 'inactive' })
          .eq('title', ep.title)
          .eq('status', 'active');

        expired++;
      }
      if (expired > 0) console.log(`Expired ${expired} products past their expiration date`);
    }

    let updated = 0;
    let deactivated = 0;
    let reactivated = 0;
    let priceChanged = 0;

    // Process in parallel chunks for speed
    const processOne = async (kp: any) => {
      try {
        let res: Response;
        try {
          res = await fetchWithRetry(`${KINGUIN_API}/v2/products/${kp.kinguin_product_id}`, {
            headers: { 'X-Api-Key': KINGUIN_API_KEY },
          });
        } catch (fetchErr) {
          // Transient network/5xx/429 failure even after retries — do NOT treat
          // this as "out of stock". Leave the row untouched (it stays at the
          // front of the oldest-checked queue so it's retried again next run).
          console.error(`Kinguin API unreachable for ${kp.kinguin_product_id}, skipping:`, fetchErr);
          return;
        }

        if (!res.ok) {
          if (res.status === 404) {
            // Confirmed: this listing no longer exists on Kinguin.
            await supabase
              .from('kinguin_products')
              .update({
                kinguin_stock: 0,
                last_stock_check: new Date().toISOString(),
                is_active: false,
                last_change_summary: 'deactivated (404 - listing removed)',
                last_change_at: new Date().toISOString(),
                last_change_source: 'cron',
              })
              .eq('id', kp.id);
            if (kp.is_active) deactivated++;
            return;
          }
          // Other non-2xx (rare after retries) — skip without touching stock/active.
          console.error(`Kinguin API error [${res.status}] for ${kp.kinguin_product_id}, skipping`);
          return;
        }

        const productData = await res.json();
        const stock = productData.qty ?? productData.totalQty ?? 0;
        const currentPrice = productData.price ?? null;

        const changes: string[] = [];
        const updateData: any = {
          kinguin_stock: stock,
          last_stock_check: new Date().toISOString(),
        };

        // Update kinguin price AND recalc sell_price using pricing rules
        if (currentPrice !== null && currentPrice > 0) {
          updateData.kinguin_price = currentPrice;
          const oldKinguinPrice = Number(kp.kinguin_price ?? 0);
          // Recalc only if cost actually changed (>1 cent diff) to avoid noise
          if (Math.abs(currentPrice - oldKinguinPrice) > 0.01) {
            changes.push(`price €${oldKinguinPrice.toFixed(2)}→€${currentPrice.toFixed(2)}`);
            const ruleSet = storeMap.get(kp.allowed_product_id) === 'topup' ? topupRules! : pricingRules;
            const newSellPrice = calculateSellPrice(currentPrice, ruleSet, pricingSettings);
            if (Math.abs(newSellPrice - Number(kp.sell_price ?? 0)) > 0.01) {
              updateData.sell_price = newSellPrice;
              changes.push(`sell €${Number(kp.sell_price ?? 0).toFixed(2)}→€${newSellPrice.toFixed(2)}`);
              priceChanged++;
            }
          }
        }

        // Stock change
        if (Number(kp.kinguin_stock ?? 0) !== Number(stock)) {
          changes.push(`stock ${kp.kinguin_stock ?? 0}→${stock}`);
        }

        // Keep is_active in sync with live stock in both directions (mirrors
        // the webhook handler) — deactivate when out of stock, and just as
        // importantly, reactivate once stock comes back. This is what lets a
        // product recover automatically after a real or false stockout,
        // instead of staying hidden until someone notices and fixes it by hand.
        const desiredActive = stock > 0 && !kp.is_overpriced;
        if (desiredActive !== kp.is_active) {
          updateData.is_active = desiredActive;
          changes.push(desiredActive ? 'reactivated' : 'deactivated');
          if (desiredActive) reactivated++; else deactivated++;
        }

        if (changes.length > 0) {
          updateData.last_change_summary = changes.join(', ');
          updateData.last_change_at = new Date().toISOString();
          updateData.last_change_source = 'cron';
        }

        await supabase
          .from('kinguin_products')
          .update(updateData)
          .eq('id', kp.id);

        updated++;
      } catch (err) {
        console.error(`Failed to sync product ${kp.kinguin_product_id}:`, err);
      }
    };

    // Run with bounded concurrency
    let skipped = 0;
    for (let i = 0; i < kinguinProducts.length; i += CONCURRENCY) {
      if (Date.now() - runStart > SOFT_TIMEOUT_MS) {
        skipped = kinguinProducts.length - i;
        console.warn(`Soft timeout hit. Skipping remaining ${skipped} products.`);
        break;
      }
      const chunk = kinguinProducts.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(processOne));
    }

    // Persist run summary
    if (runId) {
      await supabase.from('kinguin_sync_runs').update({
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - runStart,
        mode: fullSync ? 'full' : 'batched',
        batch_size: kinguinProducts.length,
        total_processed: updated + deactivated,
        updated,
        deactivated,
        reactivated,
        price_changed: priceChanged,
        expired,
        skipped,
        status: skipped > 0 ? 'partial' : 'success',
      }).eq('id', runId);
    }

    return new Response(JSON.stringify({
      success: true,
      updated,
      deactivated,
      reactivated,
      priceChanged,
      expired,
      skipped,
      total: kinguinProducts.length,
      mode: fullSync ? 'full' : 'batched',
      message: `Synced ${updated} of ${kinguinProducts.length}, ${deactivated} deactivated, ${reactivated} reactivated, ${priceChanged} price recalcs, ${expired} expired, ${skipped} skipped`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Stock sync error:', message);
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await sb.from('kinguin_sync_runs').insert({
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        status: 'error',
        error_message: message,
      });
    } catch (_) { /* ignore logging failure */ }
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
