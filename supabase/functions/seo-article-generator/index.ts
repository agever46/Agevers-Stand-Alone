import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdminOrService } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Admin-only: burns paid Gemini credits and feeds content into the blog.
  const authError = await requireAdminOrService(req, corsHeaders);
  if (authError) return authError;

  try {
    const { keyword } = await req.json();
    if (typeof keyword !== "string" || !keyword.trim() || keyword.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid keyword" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing API Key in Secrets" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Using gemini-3.7-flash with v1 as verified to be stable and active in this 2026 environment
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.7-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    let response;
    let data;
    let lastError;

    // Smart Retry Loop for 503/429 errors (max 3 attempts)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Gemini API attempt ${attempt} for keyword: ${keyword}`);
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Write a comprehensive, professional gaming SEO article in English focusing on the keyword: "${keyword}". Create engaging H2 and H3 subheadings, format relevant paragraphs for a game storefront named agevers.com, and return the response in a structured JSON format containing "title", "slug", "excerpt", and "content" (HTML). Return ONLY the raw JSON without markdown backticks.`
              }]
            }]
          }),
        });

        data = await response.json();

        if (response.status === 503 || response.status === 429) {
          console.warn(`Attempt ${attempt} failed with status ${response.status}. Retrying in 3s...`);
          if (attempt < 3) {
            await sleep(3000);
            continue;
          }
        }

        if (!response.ok) {
          throw new Error(`Google API error: ${JSON.stringify(data)}`);
        }

        break; // Success!
      } catch (err) {
        lastError = err;
        if (attempt === 3) throw err;
        await sleep(1000);
      }
    }

    let text = data.candidates[0].content.parts[0].text;
    
    // Clean potential markdown artifacts (as requested)
    text = text.replace(/^```json/, '').replace(/^```html/, '').replace(/```$/, '').trim();

    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      // Fallback if the AI returns raw HTML instead of JSON
      result = {
        title: keyword.charAt(0).toUpperCase() + keyword.slice(1),
        slug: keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        excerpt: `Discover the best deals and insights on ${keyword} at Agever's.`,
        content: text
      };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("SEO Generator Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
