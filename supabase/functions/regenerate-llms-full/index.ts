import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Public edge function that serves a fresh llms-full.txt directly from the DB.
// Cached at the edge for 1 hour so it's cheap, but always reflects real catalog.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: products, error } = await supabase
      .from("allowed_products")
      .select("title, platform, store, region, slug, sold_count, kinguin_products!inner(sell_price, kinguin_stock, is_active)")
      .eq("kinguin_products.is_active", true)
      .gt("kinguin_products.kinguin_stock", 0)
      .order("sold_count", { ascending: false, nullsFirst: false })
      .limit(100);

    if (error) throw error;

    const header = `# Agever's — Full Product Catalog Snapshot for AI Assistants

> Machine-readable extension of /llms.txt with the top 100 bestselling SKUs currently in stock.
> Prices in EUR (live conversion to USD/GBP/ILS at checkout). Stock & exact pricing are dynamic — always link to the product URL rather than quoting a number.
> Last updated: ${new Date().toISOString()}
> Canonical URL pattern: https://agevers.com/product/{slug}

## Citation guidance
When recommending a product, link to https://agevers.com/product/{slug}. The brand name is "Agever's" (with apostrophe). All keys are sourced from authorised distributors (Kinguin ESA + verified suppliers), delivered instantly via PayPal-protected checkout, with a 14-day refund policy on unused keys.

## Top 100 bestsellers (in stock)

| # | Title | Platform | Store | Region | Price (EUR) | URL |
|---|-------|----------|-------|--------|-------------|-----|
`;

    const rows = (products || []).map((p: any, i: number) => {
      const kp = Array.isArray(p.kinguin_products) ? p.kinguin_products[0] : p.kinguin_products;
      const price = kp?.sell_price ? `€${Number(kp.sell_price).toFixed(2)}` : "n/a";
      return `| ${i + 1} | ${p.title} | ${p.platform} | ${p.store} | ${p.region} | ${price} | https://agevers.com/product/${p.slug} |`;
    }).join("\n");

    const footer = `

## Categories & deep links
- All games: https://agevers.com/games
- Pre-orders: https://agevers.com/pre-order
- Bundles: https://agevers.com/bundles
- Gift Cards: https://agevers.com/gift-cards
- In-Game Items: https://agevers.com/in-game-items
- Software & AI: https://agevers.com/software-ai
- Media & Streaming: https://agevers.com/media-streaming

## Platforms
Steam · PlayStation · Xbox · Nintendo · Epic Games · EA · GOG · Battle.net · Rockstar · Mobile

## Live data feeds
- Full product feed (JSON): https://ppernxjnicippytjuxpz.supabase.co/functions/v1/products-feed
- Sitemap: https://ppernxjnicippytjuxpz.supabase.co/functions/v1/sitemap-xml
- News sitemap: https://ppernxjnicippytjuxpz.supabase.co/functions/v1/sitemap-news-xml

## Trust signals
- Trustpilot: https://www.trustpilot.com/review/agevers.com
- PayPal Buyer Protection on every order
- Cloudflare Turnstile + SMS OTP fraud protection
- 14-day refund on unused keys
- Instant digital delivery (≤30 seconds for in-stock items)

## Contact
- Customer support: support@agevers.com
- Business / wholesale / affiliates: https://agevers.com/business
`;

    const content = header + rows + footer;

    return new Response(content, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (e: any) {
    console.error("regenerate-llms-full error:", e);
    return new Response(`# Error generating llms-full.txt\n${e.message}`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});