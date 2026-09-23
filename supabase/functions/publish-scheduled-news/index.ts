import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceOrInternal } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authFail = await requireServiceOrInternal(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const nowIso = new Date().toISOString();

    // Find drafts whose scheduled time has arrived
    const { data: due, error: selErr } = await sb
      .from("news_articles")
      .select("id, title, scheduled_publish_at")
      .eq("is_published", false)
      .not("scheduled_publish_at", "is", null)
      .lte("scheduled_publish_at", nowIso);

    if (selErr) throw selErr;

    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ ok: true, published: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = due.map((a: any) => a.id);

    // Publish them — set published_at to the scheduled time so freshness is honest
    const updates = await Promise.all(
      due.map((a: any) =>
        sb
          .from("news_articles")
          .update({
            is_published: true,
            published_at: a.scheduled_publish_at,
          })
          .eq("id", a.id)
      )
    );

    const failed = updates.filter((u) => u.error).length;
    console.log(`publish-scheduled-news: published ${ids.length - failed}/${ids.length}`, ids);

    // Notify IndexNow about the newly published URLs
    try {
      const { data: pubd } = await sb
        .from("news_articles")
        .select("slug")
        .in("id", ids)
        .eq("is_published", true);
      const urls = (pubd || []).map((a: any) => `https://agevers.com/news/${a.slug}`);
      if (urls.length > 0) {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/indexnow-submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({ mode: "manual", urls }),
        });
      }
    } catch (e) {
      console.warn("IndexNow ping failed (non-fatal):", (e as Error).message);
    }

    return new Response(
      JSON.stringify({ ok: true, published: ids.length - failed, failed, ids }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("publish-scheduled-news error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
