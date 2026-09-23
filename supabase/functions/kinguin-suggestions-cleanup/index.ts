// Daily cleanup for kinguin_product_suggestions.
// Re-checks each pending suggestion against Kinguin. If the product is
// no longer available (API returns no result or qty <= 0), delete the
// stale suggestion so the admin Discovery list only shows in-stock items.
// Accepts admin JWT (from AdminSyncCenter "Discover" button) or service-role
// key (from cron), via requireAdminOrService.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/adminAuth.ts";
import { titleFingerprint } from "../_shared/titleFingerprint.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KINGUIN_API = "https://gateway.kinguin.net/esa/api/v1";

const normalizeTitle = (raw: string | null | undefined): string => {
  let title = (raw || "").toLowerCase();
  return title
    .replace(/\s+-\s+software\s+-\s+(global|eu|europe|row|ww|us|usa|united states|united kingdom|uk|emea|asia|latam)\s*$/i, "")
    .replace(/\s+-\s+(global|eu|europe|row|ww|us|usa|united states|united kingdom|uk|emea|asia|latam)\s*$/i, "")
    .replace(/\s+(cd\s*key|activation\s*key|digital\s*code|download\s*code|key)\s*$/i, "")
    .replace(/\b(europe|european)\b/g, "eu")
    .replace(/\b(united states|usa)\b/g, "us")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authFail = await requireAdminOrService(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");
    if (!KINGUIN_API_KEY) throw new Error("KINGUIN_API_KEY not set");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const existingKinguinIds = new Set<string>();
    const existingAllowedTitles = new Set<string>();

    let from = 0;
    while (true) {
      const { data } = await supabase
        .from("kinguin_products")
        .select("kinguin_product_id")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      data.forEach((row: any) => existingKinguinIds.add(String(row.kinguin_product_id)));
      if (data.length < 1000) break;
      from += 1000;
    }

    from = 0;
    while (true) {
      const { data } = await supabase
        .from("allowed_products")
        .select("title, original_title")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      data.forEach((row: any) => {
        const norm = normalizeTitle(row.title);
        if (norm) existingAllowedTitles.add(norm);
        const originalNorm = normalizeTitle(row.original_title);
        if (originalNorm) existingAllowedTitles.add(originalNorm);
        const fp = titleFingerprint(row.title);
        if (fp) existingAllowedTitles.add(fp);
        const fpOriginal = titleFingerprint(row.original_title);
        if (fpOriginal) existingAllowedTitles.add(fpOriginal);
      });
      if (data.length < 1000) break;
      from += 1000;
    }

    // Only re-verify pending suggestions (approved/rejected ones don't need cleaning).
    const { data: suggestions, error } = await supabase
      .from("kinguin_product_suggestions")
      .select("id, kinguin_product_id, title")
      .eq("status", "pending");
    if (error) throw error;

    let checked = 0;
    let removed = 0;
    let updated = 0;
    const staleIds: string[] = [];

    for (const s of suggestions ?? []) {
      checked++;
      try {
        const normTitle = normalizeTitle(s.title);
        const fpTitle = titleFingerprint(s.title);
        if (
          existingKinguinIds.has(String(s.kinguin_product_id)) ||
          (normTitle && existingAllowedTitles.has(normTitle)) ||
          (fpTitle && existingAllowedTitles.has(fpTitle))
        ) {
          staleIds.push(s.id);
          continue;
        }

        const res = await fetch(
          `${KINGUIN_API}/products?productId=${encodeURIComponent(s.kinguin_product_id)}&limit=1`,
          { headers: { "X-Api-Key": KINGUIN_API_KEY.trim(), Accept: "application/json" } },
        );
        if (!res.ok) {
          // Skip on API error — don't delete based on a transient failure.
          await new Promise(r => setTimeout(r, 80));
          continue;
        }
        const data = await res.json();
        const p = data.results?.[0];
        const qty = p?.qty ?? p?.totalQty ?? 0;

        if (!p || Number(qty) <= 0) {
          staleIds.push(s.id);
        } else {
          // Refresh stored qty/price so the list stays accurate.
          await supabase
            .from("kinguin_product_suggestions")
            .update({
              kinguin_price: p.price ?? null,
              metadata: {
                qty: Number(qty),
                genres: Array.isArray(p.genres) ? p.genres : [],
                is_new: false,
                kinguin_id: Number(s.kinguin_product_id) || s.kinguin_product_id,
                is_preorder: !!p.preorder,
              },
            })
            .eq("id", s.id);
          updated++;
        }
      } catch {
        // ignore per-item errors
      }
      await new Promise(r => setTimeout(r, 80));
    }

    // Bulk delete stale suggestions.
    for (let i = 0; i < staleIds.length; i += 100) {
      const chunk = staleIds.slice(i, i + 100);
      const { error: delErr } = await supabase
        .from("kinguin_product_suggestions")
        .delete()
        .in("id", chunk);
      if (!delErr) removed += chunk.length;
    }

    return new Response(
      JSON.stringify({ checked, removed, updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});