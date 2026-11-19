import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify admin using getClaims with fallback to getUser
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || SUPABASE_SERVICE_ROLE_KEY;
    const anonClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let userId: string;
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      // Fallback: use getUser via service role client
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        console.error("Auth failed - getClaims error:", claimsError?.message, "getUser error:", userError?.message);
        throw new Error("Not authenticated");
      }
      userId = userData.user.id;
    } else {
      userId = claimsData.claims.sub as string;
    }

    const { data: roleRows } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]);
    if (!roleRows || roleRows.length === 0) throw new Error("Admin access required");

    const body = await req.json().catch(() => ({}));
    const { action, mode } = body;

    // Mode: news_article — generate a full news article draft via AI
    if (mode === "news_article") {
      const { prompt, existing_title } = body;
      if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
        throw new Error("prompt required (min 3 chars) describing the article topic");
      }

      const systemPrompt = `You are a professional gaming news editor for Agever's, a digital game store.
Write SEO-optimized news articles about game releases, deals, industry updates, platform news, and gaming culture.

Guidelines:
- Engaging journalistic tone, factual, no fluff
- Content in Markdown: use ## for H2 subheaders (H1 is auto-rendered from title); 3-5 sections
- 400-700 words total in the content
- Title: punchy, under 70 chars, clickable but not clickbait
- Excerpt: 1-2 sentences (under 200 chars) summarizing the article hook
- meta_title: SEO-friendly, under 60 chars (can mirror title or refine for search)
- meta_description: under 160 chars, compelling, includes main keyword
- tags: 3-6 lowercase keywords (e.g. ["gta-6", "rockstar", "release-date"])
- Never invent prices, dates, or quotes. Stay factual based on the prompt.
- No marketplace names (Kinguin, G2A, etc.). Refer to the store as "Agever's" if needed.`;

      const userMessage = existing_title
        ? `Article title (keep it): "${existing_title}"\n\nTopic / brief:\n${prompt}`
        : `Topic / brief for the news article:\n${prompt}`;

      const tools = [
        {
          type: "function",
          function: {
            name: "create_news_article",
            description: "Return the structured news article draft.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Article H1 title, under 70 chars" },
                excerpt: { type: "string", description: "1-2 sentence summary, under 200 chars" },
                content: { type: "string", description: "Full article body in Markdown with ## H2 subheaders, 400-700 words" },
                meta_title: { type: "string", description: "SEO title under 60 chars" },
                meta_description: { type: "string", description: "SEO description under 160 chars" },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-6 lowercase keyword tags",
                },
              },
              required: ["title", "excerpt", "content", "meta_title", "meta_description", "tags"],
              additionalProperties: false,
            },
          },
        },
      ];

      let lastError = "unknown_error";
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);

        try {
          const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              model: "gemini-3.5-flash",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
              ],
              tools,
              tool_choice: { type: "function", function: { name: "create_news_article" } },
              temperature: 0.8,
            }),
          });

          if (aiRes.status === 429) {
            lastError = "rate_limited";
            continue;
          }
          if (aiRes.status === 402) {
            return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (!aiRes.ok) {
            const errText = await aiRes.text();
            console.error(`AI error ${aiRes.status}:`, errText);
            lastError = `ai_${aiRes.status}`;
            break;
          }

          const aiData = await aiRes.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          const argsStr = toolCall?.function?.arguments;
          if (!argsStr) {
            lastError = "empty_response";
            console.error("No tool call in response:", JSON.stringify(aiData).slice(0, 500));
            continue;
          }

          let parsed: any;
          try {
            parsed = typeof argsStr === "string" ? JSON.parse(argsStr) : argsStr;
          } catch (e) {
            lastError = "parse_failed";
            console.error("Failed to parse tool args:", argsStr);
            continue;
          }

          return new Response(JSON.stringify({
            title: parsed.title,
            excerpt: parsed.excerpt,
            content: parsed.content,
            meta_title: parsed.meta_title,
            meta_description: parsed.meta_description,
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          lastError = e instanceof Error && e.name === "AbortError" ? "timeout" : "request_failed";
          console.error("News article generation error:", e);
        } finally {
          clearTimeout(timeout);
        }
      }

      return new Response(JSON.stringify({ error: `Failed to generate article: ${lastError}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: list — return IDs of products needing paraphrasing
    // Includes: not yet paraphrased OR paraphrased but still contain marketplace names (bad paraphrase)
    if (action === "list") {
      const { product_ids } = body;
      
      // 1. Products not yet paraphrased
      let query1 = supabase
        .from("allowed_products")
        .select("id, title")
        .eq("description_paraphrased", false)
        .not("description", "is", null)
        .order("created_at", { ascending: false });

      if (product_ids && Array.isArray(product_ids) && product_ids.length > 0) {
        query1 = query1.in("id", product_ids);
      }

      const { data: notParaphrased, error: err1 } = await query1.limit(200);
      if (err1) throw err1;

      // 2. Products marked as paraphrased but description still contains marketplace names (bad paraphrase)
      const MARKETPLACE_NAMES = ["Kinguin", "G2A", "Eneba", "CDKeys", "Instant Gaming", "kinguin.net", "g2a.com"];
      let query2 = supabase
        .from("allowed_products")
        .select("id, title, description")
        .eq("description_paraphrased", true)
        .not("description", "is", null);

      if (product_ids && Array.isArray(product_ids) && product_ids.length > 0) {
        query2 = query2.in("id", product_ids);
      }

      const { data: alreadyParaphrased, error: err2 } = await query2.limit(500);
      if (err2) throw err2;

      // Filter badly paraphrased ones
      const badlyParaphrased = (alreadyParaphrased || []).filter((p: any) => {
        if (!p.description || p.description.trim().length === 0) return false;
        const descLower = p.description.toLowerCase();
        return MARKETPLACE_NAMES.some(name => descLower.includes(name.toLowerCase()));
      });

      // Reset bad ones so they get re-processed
      if (badlyParaphrased.length > 0) {
        const badIds = badlyParaphrased.map((p: any) => p.id);
        await supabase.from("allowed_products").update({ description_paraphrased: false }).in("id", badIds);
        console.log(`Found ${badlyParaphrased.length} badly paraphrased products, resetting for re-paraphrase`);
      }

      const allProducts = [
        ...(notParaphrased || []).map((p: any) => ({ id: p.id, title: p.title })),
        ...badlyParaphrased.map((p: any) => ({ id: p.id, title: p.title })),
      ];

      // Deduplicate by id
      const seen = new Set<string>();
      const products = allProducts.filter((p: any) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      return new Response(JSON.stringify({ products }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: paraphrase_batch — process multiple products in parallel
    if (action === "paraphrase_batch") {
      const { product_ids } = body;
      if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
        throw new Error("product_ids array required");
      }

      const { data: products, error: fetchError } = await supabase
        .from("allowed_products")
        .select("id, title, description")
        .in("id", product_ids)
        .not("description", "is", null);

      if (fetchError) throw fetchError;
      if (!products || products.length === 0) {
        return new Response(JSON.stringify({ results: [], succeeded: 0, failed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const paraphraseOne = async (product: any): Promise<{ id: string; success: boolean; title: string; error?: string }> => {
        let lastError = "unknown_error";

        for (let attempt = 0; attempt < 4; attempt++) {
          if (attempt > 0) {
            await delay(2500 * attempt + Math.floor(Math.random() * 1200));
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 20000);

          try {
            const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                model: "gemini-3.5-flash-lite",
                messages: [
                  {
                    role: "system",
                    content: `You are a premium game store SEO copywriter for Agever's. Create a unique, high-quality product description (180-250 words, 3-4 paragraphs).

**Paragraph 1 — Hook & Overview:** Start with a unique opening (question, bold statement, scenario, comparison — vary every time). Naturally include search phrases like "buy [product name]", "cheap [product name] key", or "[product name] instant delivery" as natural prose, NOT as a keyword list. Mention platform and instant digital delivery.

**Paragraph 2 — Features & Gameplay:** Highlight 3-5 key features with unique vocabulary. Focus on what makes THIS product special (RPG depth, action, story, multiplayer, etc.). Preserve ALL bundle/DLC contents exactly.

**Paragraph 3 — Who Should Play This?** Describe the ideal buyer: what kind of gamer, why they'd love it, what makes it a smart purchase. This section is critical for SEO.

RULES: English only. No marketplace names. Unique opening/phrasing/focus for every product. Output description directly without prefixes.`
                  },
                  { role: "user", content: `Product: "${product.title}"\n\nOriginal description:\n${product.description}` },
                ],
                temperature: 0.7,
                max_tokens: 400,
              }),
            });

            if (aiRes.status === 429) {
              lastError = "rate_limited";
              console.warn(`Rate limited attempt ${attempt + 1} for "${product.title}"`);
              continue;
            }

            if (aiRes.status === 402) {
              lastError = "credits_exhausted";
              break;
            }

            if (!aiRes.ok) {
              lastError = `ai_${aiRes.status}`;
              console.error(`AI error ${aiRes.status} for ${product.title}`);
              break;
            }

            const aiData = await aiRes.json();
            const newDesc = aiData.choices?.[0]?.message?.content?.trim();
            if (newDesc) {
              await supabase
                .from("allowed_products")
                .update({ description: newDesc, description_paraphrased: true })
                .eq("id", product.id);

              return { id: product.id, success: true, title: product.title };
            }

            lastError = "empty_response";
            break;
          } catch (e) {
            lastError = e instanceof Error && e.name === "AbortError" ? "timeout" : "request_failed";
            console.error(`Error for ${product.title}:`, e);
          } finally {
            clearTimeout(timeout);
          }
        }

        return { id: product.id, success: false, title: product.title, error: lastError };
      };

      const results: { id: string; success: boolean; title: string; error?: string }[] = [];
      const pending = [...products];
      const maxPasses = 3;

      for (let pass = 0; pass < maxPasses && pending.length > 0; pass++) {
        const nextRound: any[] = [];

        for (const product of pending) {
          const result = await paraphraseOne(product);
          results.push(result);

          if (!result.success && result.error === "rate_limited" && pass < maxPasses - 1) {
            nextRound.push(product);
          }

          await delay(result.success ? 700 : 2200);
        }

        pending.splice(0, pending.length, ...nextRound);

        if (pending.length > 0 && pass < maxPasses - 1) {
          console.warn(`Retrying ${pending.length} rate-limited products after cooldown`);
          await delay(8000 + pass * 4000);
        }
      }

      const finalResults = new Map<string, { id: string; success: boolean; title: string; error?: string }>();
      for (const result of results) {
        const previous = finalResults.get(result.id);
        if (!previous || (!previous.success && result.success) || previous.error === "rate_limited") {
          finalResults.set(result.id, result);
        }
      }

      const summarizedResults = Array.from(finalResults.values());
      const succeeded = summarizedResults.filter((result) => result.success).length;
      const failed = summarizedResults.length - succeeded;

      return new Response(JSON.stringify({ results: summarizedResults, succeeded, failed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: paraphrase_one — process a single product (legacy)
    if (action === "paraphrase_one") {
      const { product_id } = body;
      if (!product_id) throw new Error("product_id required");

      const { data: product, error: fetchError } = await supabase
        .from("allowed_products")
        .select("id, title, description")
        .eq("id", product_id)
        .single();

      if (fetchError || !product) throw new Error("Product not found");
      if (!product.description) {
        return new Response(JSON.stringify({ success: false, reason: "no_description" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 3000));
        try {
          const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemini-3.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `You are a premium game store SEO copywriter for Agever's. Create a unique, high-quality product description (180-250 words, 3-4 paragraphs).

**Paragraph 1 — Hook & Overview:** Start with a unique opening (question, bold statement, scenario, comparison — vary every time). Naturally include search phrases like "buy [product name]", "cheap [product name] key", or "[product name] instant delivery" as natural prose, NOT as a keyword list. Mention platform and instant digital delivery.

**Paragraph 2 — Features & Gameplay:** Highlight 3-5 key features with unique vocabulary. Focus on what makes THIS product special (RPG depth, action, story, multiplayer, etc.). Preserve ALL bundle/DLC contents exactly.

**Paragraph 3 — Who Should Play This?** Describe the ideal buyer: what kind of gamer, why they'd love it, what makes it a smart purchase. This section is critical for SEO.

RULES: English only. No marketplace names. Unique opening/phrasing/focus for every product. Output description directly without prefixes.`
                },
                { role: "user", content: `Product: "${product.title}"\n\nOriginal description:\n${product.description}` },
              ],
              temperature: 0.8,
              max_tokens: 600,
            }),
          });

          if (aiRes.status === 429) continue;
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const newDesc = aiData.choices?.[0]?.message?.content?.trim();
            if (newDesc) {
              await supabase.from("allowed_products").update({ description: newDesc, description_paraphrased: true }).eq("id", product.id);
              return new Response(JSON.stringify({ success: true, title: product.title }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
          break;
        } catch (e) {
          console.error(`Error for ${product.title}:`, e);
        }
      }

      // Fallback for legacy single-item flow
      const { error: fallbackError } = await supabase
        .from("allowed_products")
        .update({ description_paraphrased: true })
        .eq("id", product.id);

      if (fallbackError) {
        return new Response(JSON.stringify({ success: false, reason: "fallback_failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, title: product.title, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action. Use 'list' or 'paraphrase_one'.");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
