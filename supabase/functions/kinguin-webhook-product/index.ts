// Kinguin Product Update Webhook
// Path: /kinguin/webhook/product/update
// Receives real-time product updates (stock, price) from Kinguin.
// Replaces relying solely on the hourly cron (kinguin-stock-sync).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const KINGUIN_API = 'https://gateway.kinguin.net/esa/api';
const KINGUIN_MARKUP = 0.0735;

// Global cache to reduce DB pressure during webhook bursts
let pricingCache: {
  rules: any[] | null;
  topupRules: any[] | null;
  settings: any | null;
  lastFetched: number;
} = {
  rules: null,
  topupRules: null,
  settings: null,
  lastFetched: 0
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getPricingConfig(supabase: any) {
  const now = Date.now();
  if (pricingCache.rules && (now - pricingCache.lastFetched < CACHE_TTL_MS)) {
    return pricingCache;
  }

  const [rulesRes, topupRulesRes, settingsRes] = await Promise.all([
    supabase.from('pricing_rules').select('max_cost, margin_pct').order('tier_order'),
    supabase.from('pricing_rules_topups').select('max_cost, margin_pct').order('tier_order'),
    supabase.from('pricing_settings').select('fixed_fee, platform_pct').eq('id', 1).single(),
  ]);

  pricingCache = {
    rules: rulesRes.data || [],
    topupRules: topupRulesRes.data || [],
    settings: settingsRes.data || { fixed_fee: 0.50, platform_pct: 0.05 },
    lastFetched: now
  };

  return pricingCache;
}

function applyKinguinMarkup(cost: number): number {
  return cost * (1 + KINGUIN_MARKUP);
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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Retry wrapper for the Kinguin gateway — it occasionally stalls past 8s.
// Runs in the background (post-ack), so a slightly longer total budget is fine.
async function fetchWithRetry(url: string, init: RequestInit, attempts = 3, timeoutMs = 15000): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      // Retry on 5xx / 429 which usually clear on the next try.
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`Kinguin API ${res.status}`);
      } else {
        return res;
      }
    } catch (err) {
      lastErr = err;
    }
    // Exponential backoff: 500ms, 1500ms
    await new Promise((r) => setTimeout(r, 500 * Math.pow(3, i)));
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetchWithRetry failed');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const KINGUIN_API_KEY = Deno.env.get('KINGUIN_API_KEY');
    const WEBHOOK_SECRET = Deno.env.get('KINGUIN_WEBHOOK_SECRET');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Required secret check — Kinguin embeds the token in the URL. If the
    // secret is not configured, refuse all requests rather than silently
    // accepting unauthenticated webhook payloads.
    if (!WEBHOOK_SECRET) {
      console.error('KINGUIN_WEBHOOK_SECRET not configured — refusing webhook');
      return new Response(JSON.stringify({ error: 'webhook not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    {
      const url = new URL(req.url);
      const provided = url.searchParams.get('secret') || req.headers.get('x-webhook-secret');
      if (provided !== WEBHOOK_SECRET) {
        return new Response(null, { status: 401, headers: corsHeaders });
      }
    }

    const payload = await req.json().catch(() => ({} as any));
    console.log('Kinguin product webhook payload:', JSON.stringify(payload));

    // Kinguin sends { productId } or { kinguinId } in the payload depending on event.
    const productId =
      payload?.productId ?? payload?.kinguinId ?? payload?.id ?? payload?.product?.productId;

    if (!productId) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Ack Kinguin immediately and do all work in the background so upstream
    // fetches / DB writes never make the worker time out (502/520).
    const bgTask = (async () => {
      try {
        // Pass payload to background task to check for data
        await processProductUpdate(supabase, KINGUIN_API_KEY!, String(productId), payload);
      } catch (err) {
        console.error('background processProductUpdate failed:', err);
      }
    })();
    // @ts-ignore EdgeRuntime is provided by Supabase edge runtime
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(bgTask);
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('kinguin-webhook-product error:', message);
    return new Response(null, { status: 204, headers: corsHeaders });
  }
});

async function processProductUpdate(supabase: any, KINGUIN_API_KEY: string, productId: string, payload?: any) {
    // Find the matching kinguin_products row
    const { data: kp } = await supabase
      .from('kinguin_products')
      .select('id, kinguin_product_id, allowed_product_id, kinguin_price, sell_price, kinguin_stock, is_active, is_overpriced')
      .eq('kinguin_product_id', productId)
      .maybeSingle();

    if (!kp) {
      return;
    }

    let stock = payload?.qty ?? payload?.totalQty ?? payload?.product?.qty ?? payload?.product?.totalQty ?? null;
    let currentPrice = payload?.price ?? payload?.product?.price ?? null;

    // Only fetch from API if we are missing either price or stock from the webhook payload.
    // This dramatically reduces outbound requests during bursts.
    if (stock === null || currentPrice === null) {
      if (!KINGUIN_API_KEY) throw new Error('KINGUIN_API_KEY not configured');
      let res: Response;
      try {
        res = await fetchWithRetry(`${KINGUIN_API}/v2/products/${kp.kinguin_product_id}`, {
          headers: { 'X-Api-Key': KINGUIN_API_KEY },
        }, 2, 10000); // Reduced attempts and timeout for webhook processing
      } catch (err) {
        console.error('Kinguin API fetch failed for', kp.kinguin_product_id, err);
        return;
      }

      if (!res.ok) {
        if (res.status === 404) {
          await supabase
            .from('kinguin_products')
            .update({ kinguin_stock: 0, is_active: false, last_stock_check: new Date().toISOString() })
            .eq('id', kp.id);
        }
        return;
      }

      const productData = await res.json();
      stock = stock ?? (productData.qty ?? productData.totalQty ?? 0);
      currentPrice = currentPrice ?? (productData.price ?? null);
    }

    const desiredActive = stock > 0 && !kp.is_overpriced;

    const changes: string[] = [];
    const updateData: Record<string, unknown> = {
      kinguin_stock: stock,
      last_stock_check: new Date().toISOString(),
      last_webhook_update: new Date().toISOString(),
      is_active: desiredActive,
    };

    if (currentPrice !== null && currentPrice > 0) {
      updateData.kinguin_price = currentPrice;
      const oldKinguinPrice = Number(kp.kinguin_price ?? 0);
      if (Math.abs(currentPrice - oldKinguinPrice) > 0.01) {
        changes.push(`price €${oldKinguinPrice.toFixed(2)}→€${currentPrice.toFixed(2)}`);
        
        // Load pricing rules + settings + store info for this product using cache
        const config = await getPricingConfig(supabase);
        
        const [apRes] = await Promise.all([
          kp.allowed_product_id
            ? supabase.from('allowed_products').select('store, tab_category').eq('id', kp.allowed_product_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        const pricingRules = config.rules?.length ? config.rules : [
          { max_cost: 2, margin_pct: 0.10 },
          { max_cost: 50, margin_pct: 0.065 },
          { max_cost: 150, margin_pct: 0.055 },
          { max_cost: 99999, margin_pct: 0.04 },
        ];
        const topupRules = config.topupRules?.length ? config.topupRules : pricingRules;
        const pricingSettings = config.settings || { fixed_fee: 0.50, platform_pct: 0.05 };
        const ap: any = (apRes as any).data;
        const isTopup = ap && (ap.store === 'Top Ups' || ap.store === 'Gift Cards' || ap.tab_category === 'topups');
        const ruleSet = isTopup ? topupRules : pricingRules;
        const newSellPrice = calculateSellPrice(currentPrice, ruleSet, pricingSettings);
        if (Math.abs(newSellPrice - Number(kp.sell_price ?? 0)) > 0.01) {
          updateData.sell_price = newSellPrice;
          changes.push(`sell €${Number(kp.sell_price ?? 0).toFixed(2)}→€${newSellPrice.toFixed(2)}`);
        }
      }
    }

    // Stock change detection
    const { data: existing } = await supabase
      .from('kinguin_products')
      .select('kinguin_stock, is_active, is_overpriced')
      .eq('id', kp.id)
      .maybeSingle();
    if (existing) {
      if (Number(existing.kinguin_stock ?? 0) !== Number(stock)) {
        changes.push(`stock ${existing.kinguin_stock ?? 0}→${stock}`);
      }
      if (existing.is_active !== desiredActive) {
        changes.push(desiredActive ? 'reactivated' : (existing.is_overpriced ? 'deactivated (overpriced flag)' : 'deactivated'));
      }
    }

    if (changes.length > 0) {
      updateData.last_change_summary = changes.join(', ');
      updateData.last_change_at = new Date().toISOString();
      updateData.last_change_source = 'webhook';
    }

    await supabase.from('kinguin_products').update(updateData).eq('id', kp.id);
}
