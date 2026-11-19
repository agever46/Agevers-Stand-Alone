import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RequestSchema = z.object({
  batchSize: z.number().int().min(1).max(50).optional(),
});

const AiBatchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      description: z.string().min(20),
    })
  ),
});

const COOLDOWN_MS = 8_000;
const AI_TIMEOUT_MS = 35_000;

const extractAiItems = (aiData: any) => {
  const toolArgs = aiData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (toolArgs) {
    return AiBatchSchema.parse(JSON.parse(toolArgs)).items;
  }

  const content = aiData?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("empty_response");
  }

  const parsed = JSON.parse(content);
  if (Array.isArray(parsed)) {
    return z.array(AiBatchSchema.shape.items.element).parse(parsed);
  }

  return AiBatchSchema.parse(parsed).items;
};

const ensureParagraphs = (text: string): string => {
  if (text.includes("\n\n")) return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 3) return text;
  const chunkSize = Math.ceil(sentences.length / 3);
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += chunkSize) {
    paragraphs.push(sentences.slice(i, i + chunkSize).join(" "));
  }
  return paragraphs.join("\n\n");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let lockedProductIds: string[] = [];

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"]);
    if (!roleRows || roleRows.length === 0) throw new Error("Admin access required");

    const parsedBody = RequestSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ error: parsedBody.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actualBatch = Math.min(parsedBody.data.batchSize ?? 5, 5);

    let { data: products, error: fetchErr } = await supabase
      .from("allowed_products")
      .select("id, title, description")
      .eq("paraphrase_status", "idle")
      .eq("description_paraphrased", false)
      .not("description", "is", null)
      .neq("description", "")
      .order("created_at", { ascending: true })
      .limit(actualBatch);

    if (fetchErr) throw fetchErr;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ message: "No products to paraphrase", processed: 0, failed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-skip products with very short descriptions — mark done without an AI call.
    const shortProducts = products.filter((p) => (p.description || "").trim().length < 200);
    if (shortProducts.length > 0) {
      await supabase
        .from("allowed_products")
        .update({ description_paraphrased: true, paraphrase_status: "completed" } as any)
        .in("id", shortProducts.map((p) => p.id));
      products = products.filter((p) => (p.description || "").trim().length >= 200);
    }
    if (products.length === 0) {
      return new Response(JSON.stringify({ message: "Skipped short descriptions", processed: shortProducts.length, failed: 0, skipped_short: shortProducts.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productIds = products.map((product) => product.id);
    lockedProductIds = productIds;
    const { data: lockedRows, error: lockErr } = await supabase
      .from("allowed_products")
      .update({ paraphrase_status: "processing", paraphrase_locked_at: new Date().toISOString() } as any)
      .in("id", productIds)
      .eq("paraphrase_status", "idle")
      .eq("description_paraphrased", false)
      .select("id");

    if (lockErr) throw lockErr;
    const lockedIds = new Set((lockedRows ?? []).map((row) => row.id));
    products = products.filter((product) => lockedIds.has(product.id));
    lockedProductIds = products.map((product) => product.id);
    if (products.length === 0) {
      return new Response(JSON.stringify({ message: "No products to paraphrase", processed: 0, failed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${products.length} products in one AI request`);

    const SYS_PROMPT = "You rewrite game product descriptions in English.\nRules:\n- Keep the result close to the original length, but prefer completing the full batch over being perfectly equal length.\n- Split each description into 2-3 paragraphs using two newline characters (\\n\\n).\n- Preserve the same meaning, key features, and all bundle/edition contents.\n- Remove marketplace names like Kinguin, G2A, Eneba, or similar external marketplace references.\n- Keep each result matched to the same product id.\n- Return results only via the paraphrase_batch tool.";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-3.1-flash-lite",
        temperature: 0.4,
        messages: [
          { role: "system", content: SYS_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              instruction: "Paraphrase all products and return one JSON result for the entire batch.",
              products,
            }),
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "paraphrase_batch",
              description: "Return the paraphrased descriptions for the full batch of products.",
              parameters: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["id", "description"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "paraphrase_batch" } },
      }),
    });

    clearTimeout(timeout);

    if (aiRes.status === 429) {
      await supabase
        .from("allowed_products")
        .update({ paraphrase_status: "idle" } as any)
        .in("id", lockedProductIds);
      lockedProductIds = [];
      return new Response(
        JSON.stringify({
          processed: 0,
          failed: products.length,
          total: products.length,
          remaining: products.length,
          rate_limited: true,
          credits_exhausted: false,
          errors: ["rate_limited"],
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (aiRes.status === 402) {
      await supabase
        .from("allowed_products")
        .update({ paraphrase_status: "idle" } as any)
        .in("id", lockedProductIds);
      lockedProductIds = [];
      return new Response(
        JSON.stringify({
          processed: 0,
          failed: products.length,
          total: products.length,
          remaining: products.length,
          rate_limited: false,
          credits_exhausted: true,
          errors: ["credits_exhausted"],
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errorText);
      throw new Error(`ai_${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const aiItems = extractAiItems(aiData);
    const requestedIds = new Set(products.map((product) => product.id));

    const successful = aiItems.filter((item) => requestedIds.has(item.id) && item.description.trim().length > 20);
    const updatedIds = new Set(successful.map((item) => item.id));

    // Map original descriptions so we can also update sibling products that share the same
    // source description (region variants etc.) — the AI commonly dedupes those internally.
    const productById = new Map(products.map((p) => [p.id, p]));
    const pendingByOriginalDesc = new Map<string, typeof products>();
    for (const p of products) {
      const key = (p.description || "").trim();
      if (!key) continue;
      const arr = pendingByOriginalDesc.get(key) ?? [];
      arr.push(p);
      pendingByOriginalDesc.set(key, arr);
    }

    let updated = 0;
    const appliedIds = new Set<string>();
    if (successful.length > 0) {
      for (const item of successful) {
        const src = productById.get(item.id);
        if (!src) continue;
        const paraphrased = ensureParagraphs(item.description);
        const sourceKey = (src.description || "").trim();
        const siblings = pendingByOriginalDesc.get(sourceKey) ?? [src];
        const idsToUpdate = siblings.map((p) => p.id).filter((id) => !appliedIds.has(id));
        if (idsToUpdate.length === 0) continue;
        const { error: updErr } = await supabase
          .from("allowed_products")
          .update({ description: paraphrased, description_paraphrased: true, paraphrase_status: "completed" } as any)
          .in("id", idsToUpdate);
        if (!updErr) {
          updated += idsToUpdate.length;
          idsToUpdate.forEach((id) => appliedIds.add(id));
        }
      }
    }

    const failed = products
      .filter((product) => !appliedIds.has(product.id))
      .map((product) => ({ id: product.id, error: "missing_result" }));

    if (failed.length > 0) {
      await supabase
        .from("allowed_products")
        .update({ paraphrase_status: "idle" } as any)
        .in("id", failed.map((product) => product.id));
    }
    lockedProductIds = [];

    const { count } = await supabase
      .from("allowed_products")
      .select("id", { count: "exact", head: true })
      .eq("paraphrase_status", "idle")
      .eq("description_paraphrased", false)
      .not("description", "is", null)
      .neq("description", "");

    console.log(`Done: ${updated} updated, ${failed.length} failed, ${count} remaining`);

    // Cooldown handled client-side now

    return new Response(
      JSON.stringify({
        processed: updated,
        failed: failed.length,
        total: products.length,
        remaining: count ?? 0,
        rate_limited: false,
        credits_exhausted: false,
        cooldown_ms: (count ?? 0) > 0 ? COOLDOWN_MS : 0,
        errors: failed.map((item) => item.error),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const name = error instanceof Error ? error.name : "";
    console.error("batch-paraphrase-parallel error:", message);
    if (lockedProductIds.length > 0) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from("allowed_products")
          .update({ paraphrase_status: "idle" } as any)
          .in("id", lockedProductIds);
      } catch (resetError) {
        console.error("Failed to reset locked paraphrase products:", resetError);
      }
    }
    const isTimeout = name === "AbortError" || message.includes("aborted") || message.includes("AbortError");
    return new Response(JSON.stringify({ error: message }), {
      status: isTimeout ? 504 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
