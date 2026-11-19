import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const slugify = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 90);

// Generate a hero image via Gemini and upload to article-images bucket. Returns public URL or null.
async function generateAndUploadImage(
  sb: any,
  apiKey: string,
  prompt: string,
  slug: string,
): Promise<string | null> {
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      console.warn("Image gen failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const imageUrl: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl?.startsWith("data:image/")) return null;
    const [meta, b64] = imageUrl.split(",");
    const mime = meta.match(/data:(image\/[a-z]+);/)?.[1] || "image/png";
    const ext = mime.split("/")[1] || "png";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `news/${slug}-${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from("article-images").upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (upErr) {
      console.warn("Image upload failed:", upErr.message);
      return null;
    }
    const { data: pub } = sb.storage.from("article-images").getPublicUrl(path);
    return pub?.publicUrl || null;
  } catch (e) {
    console.warn("Image generation error:", (e as Error).message);
    return null;
  }
}

// Top gaming RSS feeds — public, no auth required
const RSS_FEEDS = [
  "https://www.ign.com/rss/articles/feed?tags=games",
  "https://www.gamespot.com/feeds/news/",
  "https://www.eurogamer.net/?format=rss",
  "https://www.pcgamer.com/rss/",
  "https://www.rockpapershotgun.com/feed",
];

interface RssItem { title: string; description: string; link: string; pubDate: string; }

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const tag = (block: string, name: string) => {
    const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (!m) return "";
    return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim();
  };
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    items.push({
      title: tag(block, "title"),
      description: tag(block, "description").slice(0, 400),
      link: tag(block, "link"),
      pubDate: tag(block, "pubDate"),
    });
  }
  return items;
}

async function fetchTrendingFromRss(): Promise<{ topic: string; sources: string[] } | null> {
  // Pick 2 random feeds to keep it fast
  const shuffled = [...RSS_FEEDS].sort(() => Math.random() - 0.5).slice(0, 2);
  const allItems: RssItem[] = [];
  for (const url of shuffled) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AgeversBot/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      allItems.push(...parseRss(xml).slice(0, 8));
    } catch (e) {
      console.warn(`RSS fetch failed for ${url}:`, (e as Error).message);
    }
  }
  if (allItems.length === 0) return null;

  // Pick a random recent story
  const pick = allItems[Math.floor(Math.random() * Math.min(allItems.length, 12))];
  const topic = `${pick.title}. ${pick.description}`.trim();
  return { topic, sources: [pick.link] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authFail = await requireAdminOrService(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Optional override from body
    const body = await req.json().catch(() => ({}));
    const categorySlugOverride: string | undefined = body.category_slug;
    const customTopic: string | undefined = body.topic;
    const autoPublish: boolean = body.auto_publish !== false; // default true

    // 1) Fetch a fresh trending topic from gaming RSS feeds
    let topic = customTopic;
    let citations: string[] = [];

    if (!topic) {
      const rss = await fetchTrendingFromRss();
      if (rss) {
        topic = rss.topic;
        citations = rss.sources;
      }
    }

    if (!topic) {
      topic = "Pick a major gaming release, update, or industry story from this week and write about it.";
    }

    // 2) Load all active categories (AI will pick the best fit unless override given)
    const { data: allCats } = await sb
      .from("news_categories")
      .select("id, name, slug, description")
      .eq("is_active", true)
      .order("display_order");
    if (!allCats || allCats.length === 0) throw new Error("No active news categories");
    const categoryList = allCats.map((c: any) => `- ${c.slug}: ${c.name}${c.description ? ` (${c.description})` : ""}`).join("\n");
    const validSlugs = allCats.map((c: any) => c.slug);

    // 3) Generate full article via Lovable AI (Gemini)
    const sourcesNote = citations.length
      ? `\n\nReference URLs (cite naturally in prose, do NOT list as raw links):\n${citations.slice(0, 5).join("\n")}`
      : "";

    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write SEO-optimized gaming news articles for Agever's, a digital game key marketplace. Tone: confident, informed, conversational. Length: 500-800 words. Structure: hook → context → details → why it matters → quick takeaway. Use markdown with ## headings. Avoid filler. Never invent prices or release dates — speak generally if unsure.",
          },
          {
            role: "user",
            content: `Write a news article about the following topic:\n\n${topic}${sourcesNote}\n\nReturn ONLY a JSON object via the tool call.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "publish_article",
              description: "Return the complete article fields",
              parameters: {
                type: "object",
                properties: {
                  category_slug: { type: "string", enum: validSlugs, description: `Pick the most fitting category for this article from:\n${categoryList}` },
                  title: { type: "string", description: "Compelling H1, max 70 chars" },
                  excerpt: { type: "string", description: "1-2 sentence summary, max 180 chars" },
                  content: { type: "string", description: "Full article body in markdown, 500-800 words" },
                  meta_title: { type: "string", description: "SEO title, max 60 chars" },
                  meta_description: { type: "string", description: "SEO meta desc, max 155 chars" },
                  tags: { type: "array", items: { type: "string" }, description: "3-6 lowercase tags" },
                },
                required: ["category_slug", "title", "excerpt", "content", "meta_title", "meta_description", "tags"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "publish_article" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`AI gateway error ${aiRes.status}: ${t}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call returned by AI");

    const article = JSON.parse(toolCall.function.arguments);

    // Resolve chosen category (override wins, else AI choice, else fallback)
    const chosenSlug = categorySlugOverride || article.category_slug || "industry";
    const cat = allCats.find((c: any) => c.slug === chosenSlug) || allCats.find((c: any) => c.slug === "industry") || allCats[0];

    // 4) Build unique slug
    let baseSlug = slugify(article.title);
    let slug = baseSlug;
    let n = 2;
    while (true) {
      const { data: existing } = await sb
        .from("news_articles")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${n++}`;
      if (n > 50) { slug = `${baseSlug}-${Date.now()}`; break; }
    }

    // 5) Insert
    // Generate hero image
    const imagePrompt = `Photorealistic editorial gaming news hero image for an article titled "${article.title}". Cinematic lighting, vibrant colors, modern gaming aesthetic, no text or logos, 16:9 composition.`;
    const heroImage = await generateAndUploadImage(sb, GEMINI_API_KEY, imagePrompt, slug);

    const { data: inserted, error: insErr } = await sb
      .from("news_articles")
      .insert({
        category_id: cat.id,
        title: article.title,
        slug,
        excerpt: article.excerpt,
        content: article.content,
        image_url: heroImage,
        og_image_url: heroImage,
        meta_title: article.meta_title,
        meta_description: article.meta_description,
        tags: article.tags || [],
        author_name: "Agever's Editorial",
        is_published: autoPublish,
        published_at: autoPublish ? new Date().toISOString() : null,
      })
      .select("id, slug")
      .single();

    if (insErr) throw insErr;

    // 6) Ping IndexNow if published
    if (autoPublish && inserted) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/indexnow-submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({ mode: "manual", urls: [`https://agevers.com/news/${inserted.slug}`] }),
        });
      } catch (e) {
        console.warn("IndexNow ping failed:", (e as Error).message);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, id: inserted?.id, slug: inserted?.slug, title: article.title, topic_used: topic }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auto-generate-news error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});