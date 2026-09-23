import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://agevers.com";

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

    // Google News spec: include articles published in the last 48 hours
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: articles, error } = await sb
      .from("news_articles")
      .select("slug, title, published_at, tags")
      .eq("is_published", true)
      .gte("published_at", fortyEightHoursAgo)
      .order("published_at", { ascending: false })
      .limit(1000);

    if (error) throw error;

    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ];

    for (const a of (articles || [])) {
      const url = `${SITE_URL}/news/${a.slug}`;
      const pubDate = a.published_at;
      if (!pubDate) continue;
      const tags = (a.tags || []) as string[];
      lines.push("  <url>");
      lines.push(`    <loc>${escapeXml(url)}</loc>`);
      lines.push("    <news:news>");
      lines.push("      <news:publication>");
      lines.push("        <news:name>Agever's</news:name>");
      lines.push("        <news:language>en</news:language>");
      lines.push("      </news:publication>");
      lines.push(`      <news:publication_date>${pubDate}</news:publication_date>`);
      lines.push(`      <news:title>${escapeXml(a.title)}</news:title>`);
      if (tags.length > 0) {
        lines.push(`      <news:keywords>${escapeXml(tags.join(", "))}</news:keywords>`);
      }
      lines.push("    </news:news>");
      lines.push("  </url>");
    }

    lines.push("</urlset>");
    const xml = lines.join("\n");

    const latestMod = (articles || []).reduce<string | null>((acc, a) => {
      if (!a.published_at) return acc;
      return !acc || a.published_at > acc ? a.published_at : acc;
    }, null);
    const lastModifiedHeader = latestMod ? new Date(latestMod).toUTCString() : new Date().toUTCString();

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // Short cache — news sitemap is meant to be very fresh
        "Cache-Control": "public, max-age=300, s-maxage=600",
        "Last-Modified": lastModifiedHeader,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("sitemap-news-xml error:", err);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"></urlset>`,
      {
        status: 500,
        headers: { "Content-Type": "application/xml" },
      }
    );
  }
});
