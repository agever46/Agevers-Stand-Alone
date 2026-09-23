import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KINGUIN_API = "https://gateway.kinguin.net/esa/api/v1";

// Card-like keywords in the (Kinguin original) name. If ANY match, we leave the
// product in Gift Cards.
const CARD_RE = /\b(gift ?card|network card|prepaid|voucher|wallet|psn card|xbox live|xbox game pass|game pass|steam wallet|steam gift|itunes|app store|nintendo eshop|nintendo online|google play|razer gold|netflix|spotify|roblox|minecoins|amazon .{0,6}(card|gift)|apple .{0,6}(card|gift)|wolt|zalando|deliveroo|binance|paypal|skrill|neosurf|blizzard balance|paysafe|top.?up|subscription|membership|karma koin|mol points|nintendo prepaid|nintendo card)\b/i;

// Map Kinguin `platform` string → { store, platform } in our schema.
function mapPlatform(kPlatform: string | null | undefined): { store: string; platform: string } | null {
  if (!kPlatform) return null;
  const p = kPlatform.toLowerCase().trim();
  if (p.includes("steam")) return { store: "Steam", platform: "PC" };
  if (p.includes("epic")) return { store: "Epic Games", platform: "PC" };
  if (p.includes("gog")) return { store: "GOG", platform: "PC" };
  if (p.includes("origin") || p.includes("ea app") || p.includes("ea play") || p.includes("ea desktop")) return { store: "EA Games", platform: "PC" };
  if (p.includes("uplay") || p.includes("ubisoft") || p.includes("u-play") || p.includes("ubi connect")) return { store: "Ubisoft", platform: "PC" };
  if (p.includes("battle.net") || p.includes("battlenet") || p.includes("blizzard")) return { store: "Blizzard", platform: "PC" };
  if (p.includes("rockstar") || p.includes("social club")) return { store: "Rockstar", platform: "PC" };
  if (p.includes("bethesda")) return { store: "Games", platform: "Bethesda" };
  if (p.includes("microsoft store") || p.includes("windows store") || p.includes("windows 10") || p.includes("windows 11")) return { store: "Microsoft Store", platform: "PC" };
  if (p.includes("xbox")) return { store: "Games", platform: "Xbox" };
  if (p.includes("playstation") || p.includes("ps3") || p.includes("ps4") || p.includes("ps5") || p.includes("psn") || p.includes("ps vita")) return { store: "Games", platform: "PlayStation" };
  if (p.includes("nintendo") || p.includes("switch") || p.includes("wii")) return { store: "Games", platform: "Nintendo" };
  if (p.includes("meta quest") || p.includes("oculus") || p.includes("quest")) return { store: "Games", platform: "Meta Quest" };
  if (p.includes("ios") || p.includes("android") || p.includes("mobile")) return { store: "Mobile", platform: "Mobile" };
  if (p.includes("roblox")) return null; // stays as gift card / currency
  if (p === "pc" || p.startsWith("pc ") || p.includes(" pc") || p.includes("drm free") || p.includes("drm-free") || p.includes("standalone")) return { store: "Games", platform: "PC" };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");
    if (!KINGUIN_API_KEY) throw new Error("KINGUIN_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Invalid JWT");
    const userId = claimsData.claims.sub;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]);
    if (!roles?.length) throw new Error("Admin required");

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dryRun !== false; // default TRUE for safety
    const batchSize: number = Math.min(Number(body.batchSize) || 400, 500);
    const offset: number = Math.max(0, Number(body.offset) || 0);

    // 1. Fetch all allowed_products in Gift Cards store
    const apIds: string[] = [];
    const productMap: Record<string, { title: string }> = {};
    const PAGE = 1000;
    let off = 0;
    while (true) {
      const { data, error } = await supabase
        .from("allowed_products")
        .select("id, title")
        .eq("store", "Gift Cards")
        .range(off, off + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const p of data) { apIds.push(p.id); productMap[p.id] = { title: p.title }; }
      if (data.length < PAGE) break;
      off += PAGE;
    }

    // 2. Fetch matching kinguin_products in chunks
    const kpRows: { allowed_product_id: string; kinguin_product_id: string }[] = [];
    const CHUNK = 200;
    for (let i = 0; i < apIds.length; i += CHUNK) {
      const { data } = await supabase
        .from("kinguin_products")
        .select("allowed_product_id, kinguin_product_id")
        .in("allowed_product_id", apIds.slice(i, i + CHUNK));
      if (data) kpRows.push(...data);
    }

    const grandTotal = kpRows.length;
    const toProcess = kpRows.slice(offset, offset + batchSize);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (d: Record<string, unknown>) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`));

        const total = toProcess.length;
        let checked = 0, updated = 0, skippedCard = 0, unknown = 0, failed = 0, notFound = 0;
        const unknownPlatforms: Record<string, number> = {};
        const cardSamples: { name: string }[] = [];
        const unknownSamples: { id: string; name: string; kPlatform: string | null }[] = [];
        const failedSamples: { id: string; kinguinId: string; status?: number; reason: string }[] = [];
        const updatedSamples: unknown[] = [];

        send({ type: "start", total, grandTotal, offset, dryRun });

        for (const kp of toProcess) {
          checked++;
          try {
            const url = `${KINGUIN_API}/products?productId=${kp.kinguin_product_id}&limit=1`;
            const res = await fetch(url, {
              headers: { "X-Api-Key": KINGUIN_API_KEY.trim(), Accept: "application/json" },
            });
            if (!res.ok) {
              failed++;
              if (failedSamples.length < 20) failedSamples.push({ id: kp.allowed_product_id, kinguinId: kp.kinguin_product_id, status: res.status, reason: `http_${res.status}` });
              if (res.status === 429) await new Promise(r => setTimeout(r, 3000));
            } else {
              const j = await res.json();
              const prod = j.results?.[0];
              if (!prod) {
                notFound++;
                if (failedSamples.length < 20) failedSamples.push({ id: kp.allowed_product_id, kinguinId: kp.kinguin_product_id, reason: "not_found_on_kinguin" });
              } else {
                const name: string = prod.name || "";
                if (CARD_RE.test(name)) {
                  skippedCard++;
                  if (cardSamples.length < 10) cardSamples.push({ name });
                } else {
                  const mapped = mapPlatform(prod.platform);
                  if (!mapped) {
                    unknown++;
                    const key = String(prod.platform ?? "(empty)");
                    unknownPlatforms[key] = (unknownPlatforms[key] || 0) + 1;
                    if (unknownSamples.length < 30) unknownSamples.push({ id: kp.allowed_product_id, name, kPlatform: prod.platform ?? null });
                  } else {
                    if (updatedSamples.length < 10) updatedSamples.push({ id: kp.allowed_product_id, name, kPlatform: prod.platform, to: mapped });
                    if (!dryRun) {
                      // Fix the stored title too: it may still carry the wrong
                      // "- Gift Cards -" segment from the original import.
                      const currentTitle = productMap[kp.allowed_product_id]?.title || "";
                      const fixedTitle = currentTitle.replace(/\s*-\s*Gift Cards\s*-\s*/gi, ` - ${mapped.platform} - `);
                      const { error: uerr } = await supabase
                        .from("allowed_products")
                        .update({
                          store: mapped.store,
                          platform: mapped.platform,
                          product_type: "Game",
                          tab_category: null,
                          ...(fixedTitle !== currentTitle ? { title: fixedTitle } : {}),
                        })
                        .eq("id", kp.allowed_product_id);
                      if (uerr) {
                        failed++;
                        if (failedSamples.length < 20) failedSamples.push({ id: kp.allowed_product_id, kinguinId: kp.kinguin_product_id, reason: `db_update: ${uerr.message}` });
                      } else updated++;
                    } else {
                      updated++;
                    }
                  }
                }
              }
            }
          } catch (e) {
            failed++;
            if (failedSamples.length < 20) failedSamples.push({ id: kp.allowed_product_id, kinguinId: kp.kinguin_product_id, reason: `exception: ${(e as Error).message}` });
          }
          if (checked % 10 === 0) send({ type: "progress", checked, total, grandTotal, offset, updated, skippedCard, unknown, failed });
          await new Promise(r => setTimeout(r, 120));
        }

        const nextOffset = offset + toProcess.length;
        send({
          type: "done",
          checked, total, grandTotal, offset, nextOffset,
          hasMore: nextOffset < grandTotal,
          updated, skippedCard, unknown, failed, notFound,
          unknownPlatforms,
          cardSamples, unknownSamples, failedSamples, updatedSamples,
          dryRun,
        });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});