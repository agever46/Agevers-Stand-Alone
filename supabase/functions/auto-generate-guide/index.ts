import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const slugify = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 90);

/**
 * Generates SEO buying guides for products.
 *
 * Body:
 *   { product_ids?: string[], limit?: number, category_slug?: string, auto_publish?: boolean }
 *
 * If product_ids is omitted, picks top `limit` (default 5) products by sold_count
 * that don't already have a buying guide.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth: require admin (so callable from admin UI). Cron skips by passing service role.
    const authHeader = req.headers.get("Authorization");
    const isServiceRole =
      authHeader && authHeader.replace("Bearer ", "") === SUPABASE_SERVICE_ROLE_KEY;

    if (!isServiceRole) {
      if (!authHeader) throw new Error("Not authenticated");
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(
        SUPABASE_URL,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claims } = await anonClient.auth.getClaims(token);
      const userId = claims?.claims?.sub as string | undefined;
      if (!userId) throw new Error("Not authenticated");
      const { data: roles } = await sb
        .from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]);
      if (!roles || roles.length === 0) throw new Error("Admin access required");
    }

    const body = await req.json().catch(() => ({}));
    const productIds: string[] | undefined = body.product_ids;
    const limit: number = Math.min(Math.max(body.limit || 5, 1), 20);
    const categorySlugOverride: string | undefined = body.category_slug;
    const autoPublish: boolean = body.auto_publish !== false;

    // Load all active guide categories (AI will pick the best fit per product unless override given)
    const { data: allCats } = await sb
      .from("guide_categories")
      .select("id, name, slug, description")
      .eq("is_active", true)
      .order("display_order");
    if (!allCats || allCats.length === 0) throw new Error("No active guide categories");
    const categoryList = allCats.map((c: any) => `- ${c.slug}: ${c.name}${c.description ? ` (${c.description})` : ""}`).join("\n");
    const validSlugs = allCats.map((c: any) => c.slug);

    // Pick products
    let products: any[] = [];
    if (productIds && productIds.length > 0) {
      const { data } = await sb
        .from("allowed_products")
        .select("id, title, slug, platform, store, region, description, developers, publishers, release_date, image_url")
        .in("id", productIds);
      products = data || [];
    } else {
      // Top sellers without an existing guide (heuristic: title not already used in guide_articles)
      const { data: candidates } = await sb
        .from("allowed_products")
        .select("id, title, slug, platform, store, region, description, developers, publishers, release_date, image_url, sold_count")
        .order("sold_count", { ascending: false })
        .limit(limit * 4);

      if (candidates) {
        const titles = candidates.map((p: any) => `${p.title.toLowerCase().slice(0, 40)}%`);
        const { data: existingGuides } = await sb
          .from("guide_articles")
          .select("title");
        const existingSet = new Set(
          (existingGuides || []).map((g: any) => g.title.toLowerCase())
        );
        products = candidates
          .filter((p: any) => {
            const guess = `how to buy ${p.title} cheap`.toLowerCase();
            return !existingSet.has(guess);
          })
          .slice(0, limit);
      }
    }

    if (products.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, generated: 0, message: "No products to generate guides for" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const product of products) {
      try {
        const productCtx = `Title: ${product.title}
Platform: ${product.platform}
Store: ${product.store}
Region: ${product.region}
Developers: ${(product.developers || []).join(", ") || "—"}
Publishers: ${(product.publishers || []).join(", ") || "—"}
Release: ${product.release_date || "—"}
Description (excerpt): ${(product.description || "").slice(0, 600)}`;

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
                  "You write SEO-rich buying guides for Agever's, a digital game key marketplace. Tone: helpful, honest, expert. Length: 600-900 words in markdown. Use ## H2 sections like 'What is [Game]?', 'Is it worth buying in 2025?', 'How to redeem the key', 'System requirements', 'Final verdict'. Naturally include phrases like 'buy [game] key', 'cheap [game] key', 'where to buy [game]'. Never invent specific prices.",
              },
              {
                role: "user",
                content: `Write a complete buying guide for this product:\n\n${productCtx}\n\nReturn ONLY via the tool call.`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "publish_guide",
                  description: "Return the complete guide article fields",
                  parameters: {
                    type: "object",
                    properties: {
                      category_slug: { type: "string", enum: validSlugs, description: `Pick the most fitting category for this guide from:\n${categoryList}` },
                      title: { type: "string", description: "SEO H1, max 70 chars, include game name" },
                      excerpt: { type: "string", description: "1-2 sentence summary, max 180 chars" },
                      content: { type: "string", description: "Full guide body in markdown, 600-900 words" },
                      meta_title: { type: "string", description: "SEO title, max 60 chars" },
                      meta_description: { type: "string", description: "SEO meta desc, max 155 chars" },
                    },
                    required: ["category_slug", "title", "excerpt", "content", "meta_title", "meta_description"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "publish_guide" } },
          }),
        });

        if (!aiRes.ok) {
          results.push({ product_id: product.id, ok: false, error: `AI ${aiRes.status}` });
          continue;
        }

        const aiData = await aiRes.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          results.push({ product_id: product.id, ok: false, error: "No tool call" });
          continue;
        }

        const guide = JSON.parse(toolCall.function.arguments);

        // Resolve chosen category (override wins, else AI choice, else fallback)
        const chosenSlug = categorySlugOverride || guide.category_slug || "buying-guides";
        const cat = allCats.find((c: any) => c.slug === chosenSlug) || allCats.find((c: any) => c.slug === "buying-guides") || allCats[0];

        // Unique slug
        let baseSlug = slugify(guide.title);
        let slug = baseSlug;
        let n = 2;
        while (true) {
          const { data: existing } = await sb
            .from("guide_articles").select("id").eq("slug", slug).maybeSingle();
          if (!existing) break;
          slug = `${baseSlug}-${n++}`;
          if (n > 50) { slug = `${baseSlug}-${Date.now()}`; break; }
        }

        const { data: inserted, error: insErr } = await sb
          .from("guide_articles")
          .insert({
            category_id: cat.id,
            title: guide.title,
            slug,
            excerpt: guide.excerpt,
            content: guide.content,
            image_url: product.image_url || null,
            meta_title: guide.meta_title,
            meta_description: guide.meta_description,
            is_published: autoPublish,
          })
          .select("id, slug")
          .single();

        if (insErr) {
          results.push({ product_id: product.id, ok: false, error: insErr.message });
          continue;
        }

        results.push({ product_id: product.id, ok: true, guide_id: inserted.id, slug: inserted.slug, title: guide.title });

        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 600));
      } catch (e) {
        results.push({ product_id: product.id, ok: false, error: (e as Error).message });
      }
    }

    // Ping IndexNow for new guides
    const newSlugs = results.filter((r) => r.ok).map((r) => `https://agevers.com/guides/${r.slug}`);
    if (autoPublish && newSlugs.length > 0) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/indexnow-submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({ mode: "manual", urls: newSlugs }),
        });
      } catch {}
    }

    const successCount = results.filter((r) => r.ok).length;
    return new Response(
      JSON.stringify({ ok: true, generated: successCount, attempted: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("auto-generate-guide error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});