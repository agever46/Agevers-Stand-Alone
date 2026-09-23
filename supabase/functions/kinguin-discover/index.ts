import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/adminAuth.ts";
import { titleFingerprint } from "../_shared/titleFingerprint.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KINGUIN_API = "https://gateway.kinguin.net/esa/api/v1";

const PLATFORM_MAP: Record<string, string> = {
  steam: "Steam",
  origin: "EA App",
  uplay: "Ubisoft Connect",
  epic: "Epic Games",
  "battle.net": "Battle.net",
  gog: "GOG",
  nintendo: "Nintendo",
  "nintendo switch": "Nintendo",
  xbox: "Xbox",
  "xbox one": "Xbox",
  "xbox series x|s": "Xbox",
  playstation: "PlayStation",
  "playstation 4": "PlayStation",
  "playstation 5": "PlayStation",
  ps4: "PlayStation",
  ps5: "PlayStation",
  "windows store": "Windows Store",
  rockstar: "Rockstar",
  android: "Mobile",
  ios: "Mobile",
  other: "PC",
};

const BLOCKED_TITLE_KEYWORDS = ["account", "altergift", "steam gift", "voucher"];

const normalizePlatform = (raw: string | null | undefined): string => {
  if (!raw) return "PC";
  const lower = raw.toLowerCase();
  return PLATFORM_MAP[lower] || raw;
};

const STORE_TO_PLATFORM: Record<string, string> = {
  Steam: "PC",
  "EA App": "PC",
  "Ubisoft Connect": "PC",
  "Epic Games": "PC",
  "Battle.net": "PC",
  GOG: "PC",
  "Windows Store": "PC",
  Rockstar: "PC",
  Nintendo: "Nintendo",
  Xbox: "Xbox",
  PlayStation: "PlayStation",
  Mobile: "Mobile",
};

const getPlatformForStore = (store: string): string =>
  STORE_TO_PLATFORM[store] || "PC";

const extractImageUrl = (product: any): string | null => {
  return (
    product?.coverImageOriginal ||
    product?.coverImage ||
    product?.images?.cover?.url ||
    product?.images?.cover?.thumbnail ||
    null
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = await requireAdminOrService(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");
    if (!KINGUIN_API_KEY) throw new Error("KINGUIN_API_KEY not configured");

    let requestedLimit = 100;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (body && typeof body.limit === "number") requestedLimit = body.limit;
      } else {
        const url = new URL(req.url);
        const q = url.searchParams.get("limit");
        if (q) requestedLimit = parseInt(q, 10);
      }
    } catch (_e) {}
    const totalLimit = Math.min(Math.max(requestedLimit || 100, 100), 1000);
    const pagesToFetch = Math.ceil(totalLimit / 100);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const existingKinguinIds = new Set<string>();
    const existingSuggestionImages = new Map<string, string | null>();
    const existingAllowedTitles = new Set<string>();
    const overpricedTitles = new Set<string>();

    const normalizeTitle = (raw: string | null | undefined): string => {
      let title = (raw || "").toLowerCase();
      // Imported products are stored with cleaned titles like
      // "Name - Software - Europe", while Discover stores Kinguin's raw title
      // like "Name EU Xbox / Windows 10 CD Key". Normalize both forms so
      // already-listed products are not suggested again.
      title = title
        .replace(/\s+-\s+software\s+-\s+(global|eu|europe|row|ww|us|usa|united states|united kingdom|uk|emea|asia|latam)\s*$/i, "")
        .replace(/\s+-\s+(global|eu|europe|row|ww|us|usa|united states|united kingdom|uk|emea|asia|latam)\s*$/i, "")
        .replace(/\s+(cd\s*key|activation\s*key|digital\s*code|download\s*code|key)\s*$/i, "")
        .replace(/\b(europe|european)\b/g, "eu")
        .replace(/\b(united states|usa)\b/g, "us")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return title;
    };

    const fetchProductImageById = async (kinguinProductId: string): Promise<string | null> => {
      const response = await fetch(`${KINGUIN_API}/products/${kinguinProductId}`, {
        headers: {
          "X-Api-Key": KINGUIN_API_KEY,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`Image backfill fetch failed for ${kinguinProductId} [${response.status}]: ${text}`);
        return null;
      }

      const product = await response.json();
      return extractImageUrl(product);
    };

    const updateSuggestionImage = async (kinguinProductId: string, imageUrl: string) => {
      const { error } = await supabase
        .from("kinguin_product_suggestions")
        .update({ image_url: imageUrl })
        .eq("kinguin_product_id", kinguinProductId)
        .is("image_url", null);

      if (error) {
        console.error(`Image backfill update failed for ${kinguinProductId}: ${error.message}`);
        return false;
      }

      return true;
    };

    let from = 0;
    while (true) {
      const { data } = await supabase.from("kinguin_products").select("kinguin_product_id").range(from, from + 999);
      if (!data || data.length === 0) break;
      data.forEach((row: any) => existingKinguinIds.add(String(row.kinguin_product_id)));
      if (data.length < 1000) break;
      from += 1000;
    }

    from = 0;
    while (true) {
      const { data } = await supabase
        .from("kinguin_product_suggestions")
        .select("kinguin_product_id, image_url")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      data.forEach((row: any) => {
        const id = String(row.kinguin_product_id);
        existingKinguinIds.add(id);
        existingSuggestionImages.set(id, row.image_url ?? null);
      });
      if (data.length < 1000) break;
      from += 1000;
    }

    from = 0;
    while (true) {
      const { data } = await supabase.from("blocked_kinguin_products").select("kinguin_product_id").range(from, from + 999);
      if (!data || data.length === 0) break;
      data.forEach((row: any) => existingKinguinIds.add(String(row.kinguin_product_id)));
      if (data.length < 1000) break;
      from += 1000;
    }

    // Load titles of products already in the catalog to skip suggesting duplicates.
    // Include original_title because imported Kinguin products keep the raw title
    // there, while the public title is cleaned for the storefront.
    from = 0;
    while (true) {
      const { data } = await supabase
        .from("allowed_products")
        .select("title, original_title")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      data.forEach((row: any) => {
        const norm = normalizeTitle(row.title || "");
        if (norm) existingAllowedTitles.add(norm);
        const originalNorm = normalizeTitle(row.original_title || "");
        if (originalNorm) existingAllowedTitles.add(originalNorm);
        // Order-independent fingerprint catches the cleaned-title variants
        // (e.g. "Steam Card 20 EUR - Gift Cards - Global" vs the raw Kinguin
        // "Steam Gift Card 20 EUR Global CD Key").
        const fp = titleFingerprint(row.title || "");
        if (fp) existingAllowedTitles.add(fp);
        const fpOriginal = titleFingerprint(row.original_title || "");
        if (fpOriginal) existingAllowedTitles.add(fpOriginal);
      });
      if (data.length < 1000) break;
      from += 1000;
    }

    // Load overpriced kinguin product IDs + titles so we never re-suggest them
    from = 0;
    while (true) {
      const { data } = await supabase
        .from("kinguin_products")
        .select("kinguin_product_id, allowed_product_id")
        .eq("is_overpriced", true)
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      const allowedIds = data.map((r: any) => r.allowed_product_id).filter(Boolean);
      data.forEach((r: any) => existingKinguinIds.add(String(r.kinguin_product_id)));
      if (allowedIds.length > 0) {
        const { data: titleRows } = await supabase
          .from("allowed_products")
          .select("title")
          .in("id", allowedIds);
        (titleRows || []).forEach((row: any) => {
          const norm = normalizeTitle(row.title || "");
          if (norm) overpricedTitles.add(norm);
          const fp = titleFingerprint(row.title || "");
          if (fp) overpricedTitles.add(fp);
        });
      }
      if (data.length < 1000) break;
      from += 1000;
    }

    const newSuggestions: any[] = [];
    const inScanBackfillRows: { kinguin_product_id: string; image_url: string }[] = [];

    const collectProduct = (product: any, category: "pre_order" | "hot") => {
      const pid = String(product.kinguinId || product.productId);
      const nameLower = (product.name || "").toLowerCase();
      if (!pid || BLOCKED_TITLE_KEYWORDS.some((kw) => nameLower.includes(kw))) return;

      const imageUrl = extractImageUrl(product);

      if (existingSuggestionImages.has(pid)) {
        if (!existingSuggestionImages.get(pid) && imageUrl) {
          inScanBackfillRows.push({ kinguin_product_id: pid, image_url: imageUrl });
          existingSuggestionImages.set(pid, imageUrl);
        }
        return;
      }

      if (existingKinguinIds.has(pid)) return;

      // Skip if a product with the same normalized title already exists in the catalog
      const normTitle = normalizeTitle(product.name || "");
      const fpTitle = titleFingerprint(product.name || "");
      if (
        (normTitle && existingAllowedTitles.has(normTitle)) ||
        (fpTitle && existingAllowedTitles.has(fpTitle))
      ) {
        existingKinguinIds.add(pid);
        return;
      }

      // Skip if this title was previously flagged as overpriced
      if (
        (normTitle && overpricedTitles.has(normTitle)) ||
        (fpTitle && overpricedTitles.has(fpTitle))
      ) {
        existingKinguinIds.add(pid);
        return;
      }

      const isGiftCard = /gift\s*card/i.test(product.name || "");
      // Title-based platform override for Kinguin's cross-platform listings
      // (e.g. "MS Store (PC)" platform that's actually Xbox Play Anywhere).
      const titleStr = product.name || "";
      let storeName: string;
      let platformName: string;
      if (isGiftCard) {
        storeName = "Gift Cards";
        platformName = "Gift Cards";
      } else if (/\bxbox\b/i.test(titleStr)) {
        storeName = "Xbox";
        platformName = "Xbox";
      } else if (/\b(playstation|ps[45]|ps3)\b/i.test(titleStr)) {
        storeName = "PlayStation";
        platformName = "PlayStation";
      } else if (/\bnintendo\b|\bswitch\b/i.test(titleStr)) {
        storeName = "Nintendo";
        platformName = "Nintendo";
      } else {
        storeName = normalizePlatform(product.platform);
        platformName = getPlatformForStore(storeName);
      }

      // Auto-detect pre-order: explicit flag OR future release date
      const releaseDate = product.releaseDate || null;
      const releaseTs = releaseDate ? new Date(releaseDate).getTime() : NaN;
      const isFutureRelease = !Number.isNaN(releaseTs) && releaseTs > Date.now();
      const isPreorder = Boolean(product.isPreorder || product.preOrder || isFutureRelease);
      const isNew =
        !isPreorder &&
        !Number.isNaN(releaseTs) &&
        Date.now() - releaseTs <= 90 * 24 * 60 * 60 * 1000 &&
        releaseTs <= Date.now();
      const finalCategory: "pre_order" | "hot" = isPreorder ? "pre_order" : category;

      newSuggestions.push({
        kinguin_product_id: pid,
        title: product.name || "Unknown",
        platform: platformName,
        store: storeName,
        region: product.regionId || "Global",
        image_url: imageUrl,
        kinguin_price: product.price || null,
        release_date: releaseDate,
        category: finalCategory,
        metadata: {
          kinguin_id: product.kinguinId,
          genres: product.genres,
          qty: product.qty,
          is_preorder: isPreorder,
          is_new: isNew,
        },
      });
      existingKinguinIds.add(pid);
    };

    let preorderOk = true;
    let preorderCount = 0;
    for (let page = 1; page <= pagesToFetch; page++) {
      const res = await fetch(`${KINGUIN_API}/products?page=${page}&limit=100&sortBy=updatedAt&sortType=desc&tags=preorder`, {
        headers: { "X-Api-Key": KINGUIN_API_KEY },
      });
      if (!res.ok) {
        preorderOk = false;
        console.error(`Preorder page ${page} failed [${res.status}]: ${await res.text()}`);
        break;
      }
      const data = await res.json();
      const products = data.results || [];
      preorderCount += products.length;
      for (const product of products) collectProduct(product, "pre_order");
      if (products.length < 100) break;
    }
    console.log(`Preorder scan: ${preorderCount} products across ${pagesToFetch} page(s)`);

    let hotOk = true;
    let hotCount = 0;
    for (let page = 1; page <= pagesToFetch; page++) {
      const res = await fetch(`${KINGUIN_API}/products?page=${page}&limit=100&sortBy=updatedAt&sortType=desc`, {
        headers: { "X-Api-Key": KINGUIN_API_KEY },
      });
      if (!res.ok) {
        hotOk = false;
        console.error(`Hot page ${page} failed [${res.status}]: ${await res.text()}`);
        break;
      }
      const data = await res.json();
      const products = data.results || [];
      hotCount += products.length;
      for (const product of products) collectProduct(product, "hot");
      if (products.length < 100) break;
    }
    console.log(`Hot scan: ${hotCount} products across ${pagesToFetch} page(s)`);

    let inserted = 0;
    if (newSuggestions.length > 0) {
      const { error, data } = await supabase
        .from("kinguin_product_suggestions")
        .upsert(newSuggestions, { onConflict: "kinguin_product_id", ignoreDuplicates: true })
        .select("id");

      if (error) {
        console.error("Insert error:", error.message);
      } else {
        inserted = data?.length || 0;
      }
    }

    let inScanBackfilled = 0;
    for (const row of inScanBackfillRows) {
      if (await updateSuggestionImage(row.kinguin_product_id, row.image_url)) {
        inScanBackfilled += 1;
      }
    }

    const missingSuggestionIds: string[] = [];
    from = 0;
    while (true) {
      const { data } = await supabase
        .from("kinguin_product_suggestions")
        .select("kinguin_product_id")
        .is("image_url", null)
        .range(from, from + 199);
      if (!data || data.length === 0) break;
      data.forEach((row: any) => missingSuggestionIds.push(String(row.kinguin_product_id)));
      if (data.length < 200) break;
      from += 200;
    }

    let directBackfilled = 0;
    const uniqueMissingIds = [...new Set(missingSuggestionIds)];
    for (let i = 0; i < uniqueMissingIds.length; i += 10) {
      const batch = uniqueMissingIds.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (kinguinProductId) => {
          const imageUrl = await fetchProductImageById(kinguinProductId);
          if (!imageUrl) return false;
          return updateSuggestionImage(kinguinProductId, imageUrl);
        }),
      );

      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value) {
          directBackfilled += 1;
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanned_preorder: preorderOk ? "ok" : "failed",
        scanned_hot: hotOk ? "ok" : "failed",
        scan_limit: totalLimit,
        new_suggestions: inserted,
        backfilled_images: inScanBackfilled + directBackfilled,
        total_checked: newSuggestions.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Kinguin discover error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
