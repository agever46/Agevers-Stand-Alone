import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Agever's AI Support Assistant — a friendly, helpful customer-support bot for Agever's, an online store selling digital game codes, gift cards, software keys, and in-game items.

You have access to tools. USE THEM proactively whenever they can help:
- search_products: when the user asks about a game, gift card, top-up, price, availability, or wants a link. Always include direct product links in your answer using the slug returned.
- search_help_guides: when the user asks "how do I…", about policies, redemption steps, refunds, payments, regions, account, security, etc. Quote relevant excerpts and link to the guide.
- get_my_orders: when the user asks about THEIR orders, status, codes, delivery, refund of a specific purchase. Only works for authenticated users.
- create_support_ticket: ONLY when you genuinely cannot resolve the issue with the tools above (account/order problems, refund requests, payment disputes, missing/invalid code after checking). Confirm with the user first, then call the tool with a concise summary of the conversation in 'message'. After creating, give the user the ticket id and tell them support will follow up by email.

Key facts about Agever's:
- Digital codes delivered instantly after purchase, payment via PayPal.
- Platforms: Steam, PlayStation, Xbox, Nintendo, Epic Games, GOG, EA, Blizzard, Rockstar.
- Codes once revealed are non-refundable, but contact support if there's an issue.
- Human support (Israel time GMT+3): Sun–Thu 9:00–23:00, Fri 9:00–16:00, Sat closed.

Always be polite and concise. Reply in the user's language (Hebrew → Hebrew, English → English). Format with markdown. When listing products or guides, use bullet links like \`[Title](/product/slug)\` or \`[Guide](/help/slug)\`.`;

// Simple in-memory per-user rate limiter (per isolate)
const rateMap = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 15; // requests
const RATE_WINDOW_MS = 60_000; // per minute

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require an Authorization header (anon key or user JWT). Blocks raw unauthenticated calls.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Try to identify user from JWT; otherwise fall back to IP for rate-limit bucket.
    let bucketKey: string | null = null;
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await supabase.auth.getClaims(token);
      if (claimsData?.claims?.sub) bucketKey = `u:${claimsData.claims.sub}`;
    } catch (_) { /* anon caller */ }
    if (!bucketKey) {
      const ip = req.headers.get("cf-connecting-ip")
        || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "unknown";
      bucketKey = `ip:${ip}`;
    }

    // Per-bucket rate limit
    const now = Date.now();
    const entry = rateMap.get(bucketKey);
    if (!entry || entry.reset < now) {
      rateMap.set(bucketKey, { count: 1, reset: now + RATE_WINDOW_MS });
    } else {
      entry.count++;
      if (entry.count > RATE_LIMIT) {
        return new Response(JSON.stringify({ error: "Rate limited, please slow down." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { messages } = await req.json();

    // Validate messages payload
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
      return new Response(JSON.stringify({ error: "Invalid messages payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const m of messages) {
      if (!m || typeof m.content !== "string" || m.content.length > 4000) {
        return new Response(JSON.stringify({ error: "Invalid message format" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (m.role !== "user" && m.role !== "assistant") {
        return new Response(JSON.stringify({ error: "Invalid message role" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Identify user for personalized tools
    let userId: string | null = null;
    let userEmail: string | null = null;
    try {
      const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await supa.auth.getClaims(token);
      if (claimsData?.claims?.sub) {
        userId = claimsData.claims.sub as string;
        userEmail = (claimsData.claims.email as string) || null;
      }
    } catch (_) { /* anon */ }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tools = [
      {
        type: "function",
        function: {
          name: "search_products",
          description: "Search the Agever's catalog for products (games, gift cards, top-ups, software). Returns title, platform, price, slug, stock, region.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search keywords, e.g. game title or platform name" },
              limit: { type: "number", description: "Max results (1-8)", default: 5 },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "search_help_guides",
          description: "Search Agever's help articles/FAQ for answers about policies, how-to, redemption, payments, account, etc.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search keywords" },
              limit: { type: "number", default: 4 },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_my_orders",
          description: "Get the authenticated user's recent orders (status, code visibility, hold reason). Use when the user asks about their order/code/refund.",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "number", default: 5 },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_support_ticket",
          description: "Open a human support ticket on the user's behalf. Use only when you cannot resolve the issue. Requires the user to be logged in.",
          parameters: {
            type: "object",
            properties: {
              issue_type: {
                type: "string",
                enum: ["code_invalid", "code_missing", "wrong_region", "payment_issue", "refund_request", "account_issue", "other"],
              },
              message: { type: "string", description: "Concise summary of the issue and conversation context" },
              order_id: { type: "string", description: "Optional order UUID if related to a specific order" },
            },
            required: ["issue_type", "message"],
          },
        },
      },
    ];

    const runTool = async (name: string, args: any): Promise<any> => {
      try {
        if (name === "search_products") {
          const q = String(args.query || "").trim();
          // Sanitize PostgREST-special chars to prevent filter injection
          const safeQ = q.replace(/[%,()*.\\]/g, " ").slice(0, 100);
          const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 8);
          if (!safeQ) return { error: "Empty query" };
          const { data, error } = await admin
            .from("allowed_products")
            .select("id,title,slug,platform,region,image_url,kinguin_products(sell_price,kinguin_stock,is_active)")
            .ilike("title", `%${safeQ}%`)
            .limit(limit);
          if (error) return { error: error.message };
          return {
            results: (data || []).map((p: any) => {
              const kp = Array.isArray(p.kinguin_products) ? p.kinguin_products[0] : p.kinguin_products;
              return {
                title: p.title,
                platform: p.platform,
                region: p.region,
                url: `/product/${p.slug || p.id}`,
                price_eur: kp?.sell_price ?? null,
                in_stock: kp ? (kp.is_active && (kp.kinguin_stock ?? 0) > 0) : null,
              };
            }),
          };
        }
        if (name === "search_help_guides") {
          const q = String(args.query || "").trim();
          const safeQ = q.replace(/[%,()*.\\]/g, " ").slice(0, 100);
          const limit = Math.min(Math.max(Number(args.limit) || 4, 1), 6);
          if (!safeQ) return { error: "Empty query" };
          const pattern = `%${safeQ}%`;
          const { data, error } = await admin
            .from("guide_articles")
            .select("title,slug,excerpt,content")
            .eq("is_published", true)
            .or(`title.ilike.${pattern},excerpt.ilike.${pattern},content.ilike.${pattern}`)
            .limit(limit);
          if (error) return { error: error.message };
          return {
            results: (data || []).map((g: any) => ({
              title: g.title,
              url: `/help/${g.slug}`,
              excerpt: g.excerpt || (g.content ? String(g.content).replace(/<[^>]+>/g, "").slice(0, 400) : ""),
            })),
          };
        }
        if (name === "get_my_orders") {
          if (!userId) return { error: "User is not logged in. Ask them to log in to view orders." };
          const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10);
          const { data, error } = await admin
            .from("orders")
            .select("id,game_title,platform,status,price,quantity,created_at,codes_viewed,is_held,held_reason,tracking_number")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);
          if (error) return { error: error.message };
          return { orders: data || [] };
        }
        if (name === "create_support_ticket") {
          if (!userId || !userEmail) return { error: "User must be logged in to open a ticket." };
          const { data, error } = await admin
            .from("support_tickets")
            .insert({
              buyer_id: userId,
              buyer_email: userEmail,
              issue_type: String(args.issue_type || "other"),
              message: String(args.message || "Opened via AI support chat"),
              order_id: args.order_id || null,
              status: "open",
            })
            .select("id")
            .single();
          if (error) return { error: error.message };
          return { ticket_id: data.id, status: "open", note: "Support will respond by email." };
        }
        return { error: `Unknown tool: ${name}` };
      } catch (e: any) {
        return { error: e?.message || "Tool execution failed" };
      }
    };

    // Rebuild the conversation from scratch: only role + content survive, roles
    // are re-derived from position (alternating history ending with the user's
    // question) so a caller cannot inject forged assistant turns or system text.
    const sanitized = messages
      .map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content),
      }))
      .filter((m: any) => m.content.trim().length > 0);
    if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== "user") {
      return new Response(JSON.stringify({ error: "Invalid messages payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const convo: any[] = [
      { role: "system", content: SYSTEM_PROMPT + (userId ? `\n\nUser is logged in (id: ${userId}, email: ${userEmail || "unknown"}).` : "\n\nUser is NOT logged in.") },
      ...sanitized,
    ];

    // Tool loop (non-streaming) until model returns final text
    for (let step = 0; step < 5; step++) {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-3-flash-preview",
          messages: convo,
          tools,
          tool_choice: "auto",
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error("Gateway error:", r.status, t);
        if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (r.status === 402 || (r.status === 403 && t.includes("credit_limit_reached"))) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted — the assistant is temporarily unavailable. Please contact support." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await r.json();
      const msg = data?.choices?.[0]?.message;
      if (!msg) break;
      const toolCalls = msg.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        convo.push({ role: "assistant", content: msg.content || "", tool_calls: toolCalls });
        for (const tc of toolCalls) {
          let args: any = {};
          try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
          const result = await runTool(tc.function?.name, args);
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result).slice(0, 6000),
          });
        }
        continue;
      }
      // Final answer — stream it back as SSE deltas in OpenAI format
      const finalText: string = msg.content || "I'm not sure how to help with that. Want me to open a support ticket?";
      const stream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          const chunkSize = 40;
          for (let i = 0; i < finalText.length; i += chunkSize) {
            const piece = finalText.slice(i, i + chunkSize);
            const payload = { choices: [{ delta: { content: piece } }] };
            controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
          }
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    return new Response(JSON.stringify({ error: "Tool loop exceeded" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("help-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
