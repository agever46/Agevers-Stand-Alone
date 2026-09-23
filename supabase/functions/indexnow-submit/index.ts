import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOST = "agevers.com";
const KEY = "48eddc2cf84a9cfa8d5b15956fd675ba";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

// IndexNow endpoints — submitting to one propagates to all participating engines (Bing, Yandex, Seznam, Naver)
const ENDPOINTS = [
  "https://api.indexnow.org/IndexNow",
  "https://www.bing.com/indexnow",
];

function normalizeUrl(u: string): string | null {
  try {
    const url = new URL(u, `https://${HOST}`);
    if (url.hostname !== HOST && url.hostname !== `www.${HOST}`) return null;
    url.hostname = HOST;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let urls: string[] = [];
    let mode: "manual" | "all" | "recent" = "manual";

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      mode = body.mode || "manual";
      if (Array.isArray(body.urls)) urls = body.urls;
    } else {
      mode = (new URL(req.url).searchParams.get("mode") as any) || "recent";
    }

    // Auto-collect URLs based on mode
    if (mode !== "manual") {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const collected: string[] = [`https://${HOST}/`];

      // Static high-value pages
      const staticPages = [
        "/games", "/pre-order", "/bundles", "/collection",
        "/news", "/guides", "/help", "/faq",
        "/about", "/contact", "/sell", "/business",
        "/steam", "/playstation", "/xbox", "/nintendo",
        "/epic-games", "/ea-games", "/blizzard", "/rockstar",
        "/gog", "/mobile", "/software", "/gift-cards",
        "/in-game-items", "/media-streaming",
        "/compare", "/pricing-calculator",
      ];
      for (const p of staticPages) collected.push(`https://${HOST}${p}`);

      if (mode === "recent") {
        // Last 24h
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const [{ data: news }, { data: products }, { data: guides }] = await Promise.all([
          sb.from("news_articles").select("slug").eq("is_published", true).gte("published_at", since),
          sb.from("allowed_products").select("slug").gte("created_at", since).limit(500),
          sb.from("guide_articles").select("slug").eq("is_published", true).gte("updated_at", since),
        ]);
        for (const n of news || []) collected.push(`https://${HOST}/news/${n.slug}`);
        for (const p of products || []) collected.push(`https://${HOST}/product/${p.slug}`);
        for (const g of guides || []) collected.push(`https://${HOST}/guides/${g.slug}`);
      } else if (mode === "all") {
        // Paginate to bypass Supabase's 1000-row default cap
        const pageSize = 1000;
        let from = 0;
        while (true) {
          const { data, error } = await sb
            .from("allowed_products")
            .select("slug")
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          for (const p of data) collected.push(`https://${HOST}/product/${p.slug}`);
          if (data.length < pageSize) break;
          from += pageSize;
        }

        const [{ data: news }, { data: guides }, { data: cols }, { data: groups }, { data: bundles }] = await Promise.all([
          sb.from("news_articles").select("slug").eq("is_published", true).limit(5000),
          sb.from("guide_articles").select("slug").eq("is_published", true).limit(1000),
          sb.from("collections").select("slug").eq("is_active", true).limit(500),
          sb.from("game_groups").select("slug").eq("is_active", true).limit(500),
          sb.from("bundles").select("slug").eq("is_active", true).limit(500),
        ]);
        for (const n of news || []) collected.push(`https://${HOST}/news/${n.slug}`);
        for (const g of guides || []) collected.push(`https://${HOST}/guides/${g.slug}`);
        for (const c of cols || []) collected.push(`https://${HOST}/collection/${c.slug}`);
        for (const g of groups || []) collected.push(`https://${HOST}/group/${g.slug}`);
        for (const b of bundles || []) collected.push(`https://${HOST}/bundles/${b.slug}`);
      }

      urls = [...urls, ...collected];
    }

    // Normalize + dedupe
    const cleaned = [...new Set(urls.map(normalizeUrl).filter((u): u is string => !!u))];
    if (cleaned.length === 0) {
      return new Response(JSON.stringify({ error: "No valid URLs" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IndexNow accepts up to 10K URLs per submission, but Bing rejects very large
    // payloads (likely body-size limit). 500 per chunk works reliably.
    const CHUNK = 500;
    const results: any[] = [];
    for (let i = 0; i < cleaned.length; i += CHUNK) {
      const chunk = cleaned.slice(i, i + CHUNK);
      const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: chunk };

      for (const endpoint of ENDPOINTS) {
        try {
          const r = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify(payload),
          });
          results.push({ endpoint, chunk_size: chunk.length, status: r.status, ok: r.ok });
        } catch (e) {
          results.push({ endpoint, chunk_size: chunk.length, error: (e as Error).message });
        }
      }
    }

    return new Response(
      JSON.stringify({ submitted: cleaned.length, mode, results }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("indexnow-submit error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});