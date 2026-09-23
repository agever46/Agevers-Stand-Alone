import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"]);
    if (!roleRows || roleRows.length === 0) throw new Error("Admin access required");

    const { description, title } = await req.json();
    if (!description) throw new Error("No description provided");

    // Skip very short descriptions — not worth an AI call.
    if (description.trim().length < 200) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "description_too_short", paraphrased: description }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const maxRetries = 5;
    let lastError = "";
    let response: Response | null = null;

    // Initial delay to reduce rate limit hits
    await new Promise((r) => setTimeout(r, 500));

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt + 1) * 1500 + Math.random() * 3000;
        console.log(`Retry ${attempt}/${maxRetries} after ${Math.round(delay)}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }

      try {
        response = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3.1-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `You are a premium game store SEO copywriter for Agever's. Create a unique, high-quality product description (180-250 words, 3-4 paragraphs).

**Paragraph 1 — Hook & Overview:** Start with a unique opening (question, bold statement, scenario, comparison — vary every time). Naturally include search phrases like "buy [product name]", "cheap [product name] key", or "[product name] instant delivery" as natural prose, NOT as a keyword list. Mention platform and instant digital delivery.

**Paragraph 2 — Features & Gameplay:** Highlight 3-5 key features with unique vocabulary. Focus on what makes THIS product special (RPG depth, action, story, multiplayer, etc.). Preserve ALL bundle/DLC contents exactly.

**Paragraph 3 — Who Should Play This?** Describe the ideal buyer: what kind of gamer, why they'd love it, what makes it a smart purchase. This section is critical for SEO.

RULES: English only. No marketplace names. Unique opening/phrasing/focus for every product. Output description directly without prefixes.`,
                },
                {
                  role: "user",
                  content: `Game title: "${title}"\n\nOriginal description:\n${description}`,
                },
              ],
              temperature: 0.8,
              max_tokens: 1000,
            }),
          }
        );

        if (response.ok) break;

        lastError = await response.text();
        console.error(`AI Gateway error (attempt ${attempt + 1}):`, response.status, lastError);

        // For 402 (payment required), don't retry
        if (response.status === 402) {
          throw new Error("AI credits exhausted. Please add credits in Settings → Workspace → Usage.");
        }

        // Only retry on 429 (rate limit)
        if (response.status !== 429) {
          break;
        }
      } catch (fetchError) {
        console.error(`Fetch error (attempt ${attempt + 1}):`, fetchError);
        lastError = String(fetchError);
      }
    }

    if (!response || !response.ok) {
      // Do NOT silently succeed — surface the error so the client can mark it as failed
      // and NOT flag the product as paraphrased.
      console.warn("AI paraphrase failed:", lastError);
      return new Response(
        JSON.stringify({
          error: `AI paraphrase failed (${response?.status ?? "no response"}): ${lastError?.slice(0, 300) || "unknown error"}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();
    const paraphrased = data.choices?.[0]?.message?.content?.trim();
    if (!paraphrased) {
      return new Response(
        JSON.stringify({ error: "AI returned empty content" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ paraphrased }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
