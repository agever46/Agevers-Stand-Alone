// Auto-groups loose Gift Cards into collections.
// Scans allowed_products (platform = 'Gift Cards') for titles that do not match
// any existing collection auto_group_keyword, derives a brand name from the
// title, and creates a new collection when at least MIN_ITEMS cards share it.
// Runs from cron (service role) or from the admin UI (admin JWT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Even a single loose card gets its own group, so future imports of the same
// brand automatically land in an existing collection.
const MIN_ITEMS = 1;

// Titles that are clearly games / software mis-tagged as Gift Cards
const BLOCK =
  /battle|gundam|adobe|hewlett|power rangers|rpg dev|starlink|call of duty|smite|edition|deluxe|season pass|adventures of elliot/i;

function deriveBrand(rawTitle: string): string {
  let s = rawTitle.split(" - Gift Cards")[0];
  s = s.replace(/\b(egift card|gift card|game card|fuel card|card)\b.*$/i, "");
  s = s.replace(/[$€£¥₩₱]\s?[\d.,]+/g, " ");
  s = s.replace(
    /\b[\d.,]+\s?(AED|USD|EUR|GBP|SAR|TRY|BRL|CNY|JPY|RON|HUF|MXN|ARS|OMR|PHP|KRW|GB|Robux|Coins)\b/gi,
    " ",
  );
  s = s.replace(/\b[\d.,]+\b/g, " ");
  s = s.replace(/\b(omr|usdt|top[- ]?up)\b/gi, " ");
  s = s.replace(/[-–—:]+\s*$/, "").replace(/\s+/g, " ").trim();
  s = s.replace(/\s+[A-Z]$/, "").trim();
  return s;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// The keyword must be a literal substring of the raw title, otherwise the
// grouping logic on the site will never match it.
function deriveKeyword(raw: string, brand: string): string | null {
  const target = normalize(brand);
  if (!target) return null;
  const words = raw.split(" - Gift Cards")[0].split(/\s+/);
  let acc = "";
  const out: string[] = [];
  for (const w of words) {
    const n = acc + normalize(w);
    if (!n || !target.startsWith(n)) break;
    acc = n;
    out.push(w);
    if (acc === target) break;
  }
  let kw = out.join(" ").replace(/[-–—:,]+$/, "").trim();
  if (!kw) return null;
  if (kw.length <= 5 && raw.toUpperCase().includes(`${kw} CARD`.toUpperCase())) {
    kw = `${kw} Card`;
  }
  return kw;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authFail = await requireAdminOrService(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: collections, error: colErr } = await supabase
      .from("collections")
      .select("slug, auto_group_keyword")
      .eq("target_page", "Gift Cards")
      .not("auto_group_keyword", "is", null);
    if (colErr) throw colErr;

    const keywords = (collections || [])
      .map((c: any) => (c.auto_group_keyword || "").toUpperCase().trim())
      .filter(Boolean);
    const existingSlugs = new Set((collections || []).map((c: any) => c.slug));

    // Paginate all gift cards
    const pageSize = 1000;
    const titles: string[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("allowed_products")
        .select("title")
        .eq("platform", "Gift Cards")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      titles.push(...data.map((d: any) => d.title).filter(Boolean));
      if (data.length < pageSize) break;
    }

    const ungrouped = titles.filter((t) => {
      const up = t.toUpperCase();
      return !keywords.some((k) => up.includes(k));
    });

    // Bucket by the literal keyword found inside the title
    const buckets: Record<string, { name: string; keyword: string; count: number }> = {};
    for (const t of ungrouped) {
      if (BLOCK.test(t)) continue;
      const b = deriveBrand(t);
      if (!b || b.length < 3) continue;
      const kw = deriveKeyword(t, b);
      if (!kw || kw.length < 3) continue;
      const key = kw.toUpperCase();
      // Use the literal keyword as the display name: it is always a clean
      // prefix of the title (the derived brand can carry leftover junk).
      if (!buckets[key]) buckets[key] = { name: kw.replace(/\s+/g, " ").trim(), keyword: kw, count: 0 };
      buckets[key].count += 1;
    }

    const rows: any[] = [];
    for (const bucket of Object.values(buckets)) {
      if (bucket.count < MIN_ITEMS) continue;
      const slug = `${slugify(bucket.name)}-gift-cards`;
      if (existingSlugs.has(slug)) continue;
      existingSlugs.add(slug);
      rows.push({
        name: bucket.name,
        slug,
        auto_group_keyword: bucket.keyword,
        target_page: "Gift Cards",
        is_active: true,
      });
    }

    let created = 0;
    if (rows.length > 0) {
      const { error: insErr } = await supabase
        .from("collections")
        .upsert(rows, { onConflict: "slug", ignoreDuplicates: true });
      if (insErr) throw insErr;
      created = rows.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanned: titles.length,
        ungrouped: ungrouped.length,
        created,
        groups: rows.map((r) => r.name),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("auto-group-gift-cards error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});