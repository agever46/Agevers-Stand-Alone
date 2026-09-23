import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KINGUIN_API = "https://gateway.kinguin.net/esa/api/v1";

// Excluded variant/DLC keywords for "base games only"
const NON_BASE_GAME_RX = /\b(dlc|soundtrack|ost|season\s*pass|expansion|add[- ]?on|content\s*pack|skin|cosmetic|v-?bucks|robux|coins?|gems?|credits?|points?|tokens?|bundle|gift\s*card|top[- ]?up|wallet|prepaid|account|subscription)\b/i;
const EDITION_RX = /\b(deluxe|ultimate|premium|gold|complete|goty|definitive|collector'?s|legendary|anniversary|game of the year|standard\s*edition|digital\s*deluxe|super\s*deluxe)\b/i;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");
    const RAWG_API_KEY = Deno.env.get("RAWG_API_KEY");
    if (!KINGUIN_API_KEY) throw new Error("KINGUIN_API_KEY not configured");
    if (!RAWG_API_KEY) throw new Error("RAWG_API_KEY not configured");

    // --- Auth: admin only ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRows } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "super_admin"]);
    if (!roleRows?.length) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const count: number = Math.min(Math.max(Number(body.count) || 10, 1), 25);
    const startPage: number = Math.max(Number(body.startPage) || 1, 1);

    // --- Step 1: pull popular game titles from RAWG (-added ≈ popularity) ---
    const titles: { title: string; rawgSlug: string }[] = [];
    const seenNorm = new Set<string>();
    const pagesNeeded = Math.ceil(count / 10);
    for (let page = startPage; page <= startPage + pagesNeeded + 1 && titles.length < count * 3; page++) {
      const url = `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&ordering=-added&page=${page}&page_size=40`;
      const r = await fetch(url);
      if (!r.ok) break;
      const j = await r.json();
      const results = j.results || [];
      for (const g of results) {
        const t = (g.name || "").trim();
        if (!t) continue;
        if (NON_BASE_GAME_RX.test(t)) continue;
        const n = normalize(t);
        if (!n || seenNorm.has(n)) continue;
        seenNorm.add(n);
        titles.push({ title: t, rawgSlug: g.slug });
      }
      if (!results.length) break;
    }
    console.log(`RAWG: collected ${titles.length} candidate titles`);

    // --- Step 2: skip ones already in catalog (by title match in allowed_products) ---
    const titleArr = titles.map((t) => t.title);
    const { data: existingRows } = await adminClient
      .from("allowed_products")
      .select("title")
      .in("title", titleArr);
    const existingNorm = new Set<string>(
      (existingRows || []).map((r: any) => normalize(r.title || "")),
    );

    // Also load all titles for fuzzy match (in case title differs slightly)
    const allTitles = new Set<string>(existingNorm);
    // Cheap fallback: just rely on `in` lookup above (titles already include common variants from RAWG)

    // --- Step 3: for each remaining title, search Kinguin for a base-game match ---
    const results: Array<{ title: string; status: string; kinguinProductId?: string; sellPrice?: number }> = [];
    let added = 0;
    let skippedExisting = 0;
    let noKinguinMatch = 0;
    let importErrors = 0;
    let imported = 0;

    const searchKinguin = async (rawTitle: string): Promise<any | null> => {
      const params = new URLSearchParams({
        name: rawTitle,
        page: "1",
        limit: "50",
        sortBy: "qty",
        sortType: "desc",
      });
      const r = await fetch(`${KINGUIN_API}/products?${params}`, {
        headers: { "X-Api-Key": KINGUIN_API_KEY, Accept: "application/json" },
      });
      if (!r.ok) return null;
      const data = await r.json();
      const items: any[] = data.results || [];
      if (!items.length) return null;

      const titleNorm = normalize(rawTitle);
      const allTokens = titleNorm.split(" ").filter(Boolean);
      // Relaxed: require only the first 3 meaningful tokens (or all if shorter)
      const titleTokens = allTokens.slice(0, Math.min(3, allTokens.length));

      // Filter: must include all title tokens, must not be DLC/edition/etc.
      const candidates = items.filter((p) => {
        const name = p.name || "";
        if (NON_BASE_GAME_RX.test(name)) return false;
        const nameNorm = normalize(name);
        return titleTokens.every((tok) => nameNorm.includes(tok));
      });
      if (!candidates.length) return null;

      // Prefer: in stock > cheapest > shortest title (most likely the base edition)
      candidates.sort((a, b) => {
        const sA = (a.qty ?? a.totalQty ?? 0) > 0 ? 0 : 1;
        const sB = (b.qty ?? b.totalQty ?? 0) > 0 ? 0 : 1;
        if (sA !== sB) return sA - sB;
        const eA = EDITION_RX.test(a.name || "") ? 1 : 0;
        const eB = EDITION_RX.test(b.name || "") ? 1 : 0;
        if (eA !== eB) return eA - eB;
        const lA = (a.name || "").length;
        const lB = (b.name || "").length;
        return lA - lB;
      });
      return candidates[0];
    };

    const importProcessed = new Set<string>();
    for (const { title } of titles) {
      if (added >= count) break;
      const norm = normalize(title);
      if (existingNorm.has(norm) || allTitles.has(norm)) {
        skippedExisting++;
        results.push({ title, status: "already in catalog" });
        continue;
      }
      let match: any = null;
      try {
        match = await searchKinguin(title);
      } catch (e) {
        console.error(`Kinguin search failed for "${title}":`, (e as Error).message);
      }
      if (!match) {
        noKinguinMatch++;
        results.push({ title, status: "no Kinguin match" });
        continue;
      }
      const pid = String(match.productId || match.kinguinId || "");
      if (!pid || importProcessed.has(pid)) {
        results.push({ title, status: "duplicate Kinguin id" });
        continue;
      }
      importProcessed.add(pid);

      // Invoke kinguin-bulk-import with this product id (it handles auth via authClient header forwarding)
      try {
        const invokeRes = await fetch(`${SUPABASE_URL}/functions/v1/kinguin-bulk-import`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
        body: JSON.stringify({
            kinguinProductId: pid,
            query: title,
            maxPages: 1,
            skipParaphrase: true,
          }),
        });
        const invokeJson = await invokeRes.json().catch(() => ({}));
        if (!invokeRes.ok) {
          importErrors++;
          const errMsg = invokeJson?.error || `HTTP ${invokeRes.status}`;
          console.error(`[import-error] "${title}" pid=${pid} status=${invokeRes.status} body=${JSON.stringify(invokeJson)}`);
          results.push({ title, status: `import error: ${errMsg}`, kinguinProductId: pid });
          continue;
        }
        const wasAdded = Number(invokeJson?.added ?? 0) > 0;
        if (wasAdded) {
          added++;
          imported++;
          const sp = invokeJson?.results?.[0]?.sellPrice;
          results.push({ title, status: "imported", kinguinProductId: pid, sellPrice: sp });
        } else {
          const subStatus = invokeJson?.results?.[0]?.status || "skipped";
          console.log(`[import-skip] "${title}" pid=${pid} subStatus=${subStatus} full=${JSON.stringify(invokeJson).slice(0, 400)}`);
          results.push({ title, status: subStatus, kinguinProductId: pid });
        }
        // small delay to avoid hammering AI paraphrase / Kinguin
        await new Promise((r) => setTimeout(r, 200));
      } catch (e) {
        importErrors++;
        results.push({ title, status: `import threw: ${(e as Error).message}`, kinguinProductId: pid });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        requested: count,
        candidates_scanned: titles.length,
        imported,
        skipped_existing: skippedExisting,
        no_kinguin_match: noKinguinMatch,
        import_errors: importErrors,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("import-popular-games error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});