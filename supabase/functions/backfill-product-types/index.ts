import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRODUCT_TYPE_KEYWORDS = [
  "legendary","deluxe","ultimate","premium","complete","goty",
  "definitive","collector","anniversary","gold edition","season pass",
  "expansion","dlc","add-on","addon","content pack","skin","outfit",
  "cosmetic","currency","bundle","edition","pre-order","preorder",
  "pre order bonus","standard edition",
];

// Gift Cards / In-Game Items / Gaming Accessories / Software family are
// differentiated by Platform/Sub-Platform, not a Game/DLC/Edition "Type" —
// never default these to "Game".
const NO_TYPE_STORES = new Set(["Gift Cards", "In-Game Items", "Gaming Accessories", "Software", "Windows", "Office", "Antivirus & Utilities"]);

function classify(originalTitle: string, title: string, store: string | null): string | null {
  if (store && NO_TYPE_STORES.has(store)) return null;
  const src = (originalTitle?.trim() ? originalTitle : title).toUpperCase();
  if (store === "Subscriptions") return "Subscription";
  if (store === "Top Ups") return "Top Up";
  if (/\bPRE[\s-]?ORDER\s+BONUS\b/.test(src)) return "PRE ORDER BONUS";
  if (/\b(DELUXE|GOLD\s+EDITION|ULTIMATE|PREMIUM|COMPLETE|GOTY|DEFINITIVE|COLLECTOR'?S|LEGENDARY|ANNIVERSARY|DIGITAL\s+DELUXE|SUPER\s+DELUXE|STANDARD\s+EDITION)\b/.test(src)) return "Edition";
  if (/\bSEASON\s+PASS\b/.test(src)) return "Season Pass";
  if (/\bEXPANSION\b/.test(src)) return "Expansion";
  if (/\bDLC\b|\bADD[- ]?ON\b|\bCONTENT\s+PACK\b/.test(src)) return "DLC";
  if (/\b(SKINS?|OUTFIT|COSMETIC|CHARACTER\s+PACK)\b/.test(src)) return "Skin";
  if (/\b(COINS?|GEMS?|V-?BUCKS|ROBUX|CREDITS?|POINTS?|GOLD|CASH|TOKENS?)\b/.test(src)) return "Currency";
  if (/\bBUNDLE\b/.test(src)) return "Bundle";
  return "Game";
}

function filterGenreBadges(badges: string[] | null): string[] {
  if (!badges) return [];
  return badges.filter((b) => {
    const lower = b.toLowerCase().trim();
    return !PRODUCT_TYPE_KEYWORDS.some((kw) => lower === kw || lower.includes(kw));
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Not authenticated");
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "super_admin"]);
    if (!roles?.length) throw new Error("Admin required");

    const { batchStart = 0, batchLimit = 500 } = await req.json().catch(() => ({}));
    const { data: products, error } = await supabase
      .from("allowed_products")
      .select("id, title, original_title, store, badges")
      .range(batchStart, batchStart + batchLimit - 1);
    if (error) throw error;
    if (!products?.length) {
      return new Response(JSON.stringify({ done: true, processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let updated = 0;
    await Promise.all(products.map(async (p: any) => {
      const productType = classify(p.original_title || "", p.title, p.store);
      const cleanedBadges = filterGenreBadges(p.badges);
      const { error: e } = await supabase
        .from("allowed_products")
        .update({ product_type: productType, badges: cleanedBadges })
        .eq("id", p.id);
      if (!e) updated++;
    }));

    return new Response(JSON.stringify({
      processed: products.length,
      updated,
      hasMore: products.length >= batchLimit,
      nextStart: batchStart + batchLimit,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
