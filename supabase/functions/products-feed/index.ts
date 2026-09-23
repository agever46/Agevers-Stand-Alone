import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "public, max-age=900, s-maxage=1800",
};

const SITE_URL = "https://agevers.com";
const BATCH = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const currency = url.searchParams.get("currency") || "EUR";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "0"));
    const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get("limit") || "0")));
    const paginated = page > 0 && limit > 0;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    interface RawProduct {
      sell_price: number;
      kinguin_stock: number | null;
      allowed_products: {
        title: string;
        platform: string;
        store: string;
        region: string;
        image_url: string | null;
        id: string;
        slug: string;
      };
    }

    let all: RawProduct[] = [];

    if (paginated) {
      const from = (page - 1) * limit;
      const { data, error } = await sb
        .from("kinguin_products")
        .select("sell_price, kinguin_stock, allowed_products!inner(title, platform, store, region, image_url, id, slug)")
        .eq("is_active", true)
        .range(from, from + limit - 1);
      if (error) throw error;
      all = (data || []) as unknown as RawProduct[];
    } else {
      let offset = 0;
      while (true) {
        const { data, error } = await sb
          .from("kinguin_products")
          .select("sell_price, kinguin_stock, allowed_products!inner(title, platform, store, region, image_url, id, slug)")
          .eq("is_active", true)
          .range(offset, offset + BATCH - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as unknown as RawProduct[]));
        if (data.length < BATCH) break;
        offset += BATCH;
      }
    }

    // Also fetch manual keys stock counts
    const { data: manualCounts } = await sb.rpc("get_manual_key_counts");
    const manualMap = new Map<string, number>();
    if (manualCounts) {
      for (const r of manualCounts) {
        manualMap.set(r.allowed_product_id, Number(r.key_count));
      }
    }

    // Track which allowed_product_ids are already covered by kinguin_products
    const coveredIds = new Set<string>();

    const products = all.map((kp) => {
      const ap = kp.allowed_products;
      coveredIds.add(ap.id);
      const kStock = kp.kinguin_stock ?? 0;
      const mStock = manualMap.get(ap.id) ?? 0;
      const totalStock = kStock + mStock;

      return {
        title: ap.title,
        price: kp.sell_price,
        currency,
        region: ap.region,
        platform: ap.store || ap.platform,
        stock_status: totalStock > 0 ? "In stock" : "Out of stock",
        url: `${SITE_URL}/product/${ap.slug}`,
        image_url: ap.image_url || null,
      };
    });

    // Add products that have ONLY manual keys (no kinguin_products row)
    const manualOnlyIds = [...manualMap.keys()].filter((id) => !coveredIds.has(id) && (manualMap.get(id) ?? 0) > 0);
    if (manualOnlyIds.length > 0) {
      const { data: manualOnlyAps } = await sb
        .from("allowed_products")
        .select("id, title, platform, store, region, image_url, slug")
        .in("id", manualOnlyIds);

      // Pull a default price per product from the lowest active seller listing
      const { data: sellerPrices } = await sb
        .from("products")
        .select("title, price")
        .eq("status", "active")
        .in("title", (manualOnlyAps || []).map((p: any) => p.title));

      const priceByTitle = new Map<string, number>();
      for (const sp of sellerPrices || []) {
        const key = (sp as any).title?.toLowerCase();
        const cur = priceByTitle.get(key);
        if (cur == null || (sp as any).price < cur) priceByTitle.set(key, (sp as any).price);
      }

      for (const ap of manualOnlyAps || []) {
        const price = priceByTitle.get(ap.title.toLowerCase()) ?? 0;
        if (price <= 0) continue; // skip if no usable price
        products.push({
          title: ap.title,
          price,
          currency,
          region: ap.region,
          platform: ap.store || ap.platform,
          stock_status: "In stock",
          url: `${SITE_URL}/product/${ap.slug}`,
          image_url: ap.image_url || null,
        });
      }
    }

    const body: Record<string, unknown> = {
      total: products.length,
      generated_at: new Date().toISOString(),
      products,
    };
    if (paginated) {
      body.page = page;
      body.limit = limit;
    }

    return new Response(JSON.stringify(body), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Last-Modified": new Date().toUTCString(),
      },
    });
  } catch (err) {
    console.error("products-feed error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
