import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://agevers.com";
const BATCH = 1000;

const STATIC_PAGES = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/games", priority: "0.9", changefreq: "daily" },
  { loc: "/bundles", priority: "0.8", changefreq: "daily" },
  { loc: "/steam", priority: "0.9", changefreq: "daily" },
  { loc: "/xbox", priority: "0.9", changefreq: "daily" },
  { loc: "/playstation", priority: "0.9", changefreq: "daily" },
  { loc: "/nintendo", priority: "0.9", changefreq: "daily" },
  { loc: "/epic-games", priority: "0.8", changefreq: "daily" },
  { loc: "/gog", priority: "0.8", changefreq: "daily" },
  { loc: "/blizzard", priority: "0.8", changefreq: "daily" },
  { loc: "/ea-games", priority: "0.8", changefreq: "daily" },
  { loc: "/rockstar", priority: "0.8", changefreq: "daily" },
  { loc: "/gift-cards", priority: "0.8", changefreq: "daily" },
  { loc: "/software", priority: "0.7", changefreq: "weekly" },
  { loc: "/software/ai", priority: "0.7", changefreq: "weekly" },
  { loc: "/in-game-items", priority: "0.7", changefreq: "daily" },
  { loc: "/mobile", priority: "0.7", changefreq: "weekly" },
  { loc: "/media-streaming", priority: "0.7", changefreq: "weekly" },
  { loc: "/pre-order", priority: "0.7", changefreq: "daily" },
  { loc: "/about", priority: "0.5", changefreq: "monthly" },
  { loc: "/contact", priority: "0.5", changefreq: "monthly" },
  { loc: "/faq", priority: "0.5", changefreq: "monthly" },
  { loc: "/help-center", priority: "0.5", changefreq: "monthly" },
  { loc: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
  { loc: "/terms-of-service", priority: "0.3", changefreq: "yearly" },
  { loc: "/refund-policy", priority: "0.3", changefreq: "yearly" },
  { loc: "/guides", priority: "0.7", changefreq: "weekly" },
  { loc: "/news", priority: "0.8", changefreq: "daily" },
  { loc: "/compare", priority: "0.7", changefreq: "monthly" },
  { loc: "/compare/agevers-vs-g2a", priority: "0.7", changefreq: "monthly" },
  { loc: "/compare/agevers-vs-cdkeys", priority: "0.7", changefreq: "monthly" },
  { loc: "/compare/agevers-vs-eneba", priority: "0.7", changefreq: "monthly" },
  { loc: "/compare/agevers-vs-difmark", priority: "0.7", changefreq: "monthly" },
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all products with slug in batches
    interface ProductRow {
      slug: string;
      created_at: string;
    }

    let products: ProductRow[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await sb
        .from("allowed_products")
        .select("slug, created_at")
        .range(offset, offset + BATCH - 1)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) break;
      products.push(...data);
      if (data.length < BATCH) break;
      offset += BATCH;
    }

    // Fetch published guide articles
    const { data: guides, error: guidesErr } = await sb
      .from("guide_articles")
      .select("slug, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false });
    if (guidesErr) throw guidesErr;

    // Fetch published news articles
    const { data: newsArticles } = await sb
      .from("news_articles")
      .select("slug, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false });

    // Fetch active news categories
    const { data: newsCats } = await sb
      .from("news_categories")
      .select("slug, updated_at")
      .eq("is_active", true);

    // Fetch active collections
    const { data: collections } = await sb
      .from("collections")
      .select("slug, updated_at")
      .eq("is_active", true);

    // Fetch active game groups
    const { data: gameGroups } = await sb
      .from("game_groups")
      .select("slug, updated_at")
      .eq("is_active", true);

    // Fetch active bundles
    const { data: bundles } = await sb
      .from("bundles")
      .select("slug, updated_at")
      .eq("is_active", true);

    const today = new Date().toISOString().split("T")[0];

    // Build XML
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ];

    // Static pages
    for (const p of STATIC_PAGES) {
      lines.push("  <url>");
      lines.push(`    <loc>${SITE_URL}${p.loc}</loc>`);
      lines.push(`    <lastmod>${today}</lastmod>`);
      lines.push(`    <changefreq>${p.changefreq}</changefreq>`);
      lines.push(`    <priority>${p.priority}</priority>`);
      lines.push("  </url>");
    }

    // Product pages using stored slug
    for (const prod of products) {
      const lastmod = prod.created_at
        ? prod.created_at.split("T")[0]
        : today;
      const productUrl = `${SITE_URL}/product/${prod.slug}`;
      lines.push("  <url>");
      lines.push(`    <loc>${escapeXml(productUrl)}</loc>`);
      lines.push(`    <lastmod>${lastmod}</lastmod>`);
      lines.push(`    <changefreq>weekly</changefreq>`);
      lines.push(`    <priority>0.6</priority>`);
      lines.push("  </url>");
    }

    // Guide articles
    if (guides) {
      for (const g of guides) {
        const lastmod = g.updated_at ? g.updated_at.split("T")[0] : today;
        const guideUrl = `${SITE_URL}/guides/${g.slug}`;
        lines.push("  <url>");
        lines.push(`    <loc>${escapeXml(guideUrl)}</loc>`);
        lines.push(`    <lastmod>${lastmod}</lastmod>`);
        lines.push(`    <changefreq>weekly</changefreq>`);
        lines.push(`    <priority>0.7</priority>`);
        lines.push("  </url>");
      }
    }

    // News categories
    if (newsCats) {
      for (const c of newsCats) {
        const lastmod = c.updated_at ? c.updated_at.split("T")[0] : today;
        lines.push("  <url>");
        lines.push(`    <loc>${escapeXml(`${SITE_URL}/news/category/${c.slug}`)}</loc>`);
        lines.push(`    <lastmod>${lastmod}</lastmod>`);
        lines.push(`    <changefreq>daily</changefreq>`);
        lines.push(`    <priority>0.7</priority>`);
        lines.push("  </url>");
      }
    }

    // News articles
    if (newsArticles) {
      for (const n of newsArticles) {
        const lastmod = n.updated_at ? n.updated_at.split("T")[0] : today;
        lines.push("  <url>");
        lines.push(`    <loc>${escapeXml(`${SITE_URL}/news/${n.slug}`)}</loc>`);
        lines.push(`    <lastmod>${lastmod}</lastmod>`);
        lines.push(`    <changefreq>weekly</changefreq>`);
        lines.push(`    <priority>0.7</priority>`);
        lines.push("  </url>");
      }
    }

    // Collections
    if (collections) {
      for (const c of collections) {
        const lastmod = c.updated_at ? c.updated_at.split("T")[0] : today;
        lines.push("  <url>");
        lines.push(`    <loc>${escapeXml(`${SITE_URL}/collection/${c.slug}`)}</loc>`);
        lines.push(`    <lastmod>${lastmod}</lastmod>`);
        lines.push(`    <changefreq>weekly</changefreq>`);
        lines.push(`    <priority>0.7</priority>`);
        lines.push("  </url>");
      }
    }

    // Game groups
    if (gameGroups) {
      for (const g of gameGroups) {
        const lastmod = g.updated_at ? g.updated_at.split("T")[0] : today;
        lines.push("  <url>");
        lines.push(`    <loc>${escapeXml(`${SITE_URL}/game/${g.slug}`)}</loc>`);
        lines.push(`    <lastmod>${lastmod}</lastmod>`);
        lines.push(`    <changefreq>weekly</changefreq>`);
        lines.push(`    <priority>0.7</priority>`);
        lines.push("  </url>");
      }
    }

    // Bundles
    if (bundles) {
      for (const b of bundles) {
        const lastmod = b.updated_at ? b.updated_at.split("T")[0] : today;
        lines.push("  <url>");
        lines.push(`    <loc>${escapeXml(`${SITE_URL}/bundle/${b.slug}`)}</loc>`);
        lines.push(`    <lastmod>${lastmod}</lastmod>`);
        lines.push(`    <changefreq>weekly</changefreq>`);
        lines.push(`    <priority>0.7</priority>`);
        lines.push("  </url>");
      }
    }

    lines.push("</urlset>");

    const xml = lines.join("\n");

    // Compute most recent modification across products / guides / news for Last-Modified header
    const latestStr = (arr: { updated_at?: string; created_at?: string }[] | undefined | null, key: "updated_at" | "created_at") =>
      (arr || []).reduce<string | null>((acc, r: any) => {
        const v = r[key];
        if (!v) return acc;
        return !acc || v > acc ? v : acc;
      }, null);
    const candidates = [
      latestStr(products as any, "created_at"),
      latestStr(guides as any, "updated_at"),
      latestStr(newsArticles as any, "updated_at"),
    ].filter(Boolean) as string[];
    const latestMod = candidates.sort().pop() || new Date().toISOString();
    const lastModifiedHeader = new Date(latestMod).toUTCString();

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=7200",
        "Last-Modified": lastModifiedHeader,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("sitemap-xml error:", err);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      {
        status: 500,
        headers: { "Content-Type": "application/xml" },
      }
    );
  }
});
