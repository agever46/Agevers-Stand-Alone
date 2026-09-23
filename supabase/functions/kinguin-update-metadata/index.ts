import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Inline cleanTitle logic (synced with clean-titles/index.ts) ──
const JUNK_PATTERNS = [/\s*\(?CD KEY\)?/gi, /\s*\(?STEAM KEY\)?/gi, /\s*\(VALID UNTIL[^)]*\)/gi, /\s*\(WITHOUT[^)]*\)/gi, /\s*\bKINGUIN\b\s*/gi];
const CURRENCY_TO_REGION: [string, string][] = [
  ["MVR","Maldives"],["UAH","Ukraine"],["UYU","Uruguay"],["CRC","Costa Rica"],["COP","Colombia"],["SGD","Singapore"],
  ["BRL","Brazil"],["ARS","Argentina"],["MXN","Mexico"],["CLP","Chile"],["PEN","Peru"],
  ["JPY","Japan"],["KRW","South Korea"],["CNY","China"],["INR","India"],["ZAR","South Africa"],
  ["SAR","Saudi Arabia"],["AED","UAE"],["ILS","Israel"],["NZD","New Zealand"],["HKD","Hong Kong"],
  ["THB","Thailand"],["MYR","Malaysia"],["PHP","Philippines"],["IDR","Indonesia"],["VND","Vietnam"],
  ["TWD","Taiwan"],["EUR","Europe"],["GBP","United Kingdom"],["USD","United States"],["CAD","Canada"],
  ["AUD","Australia"],["CHF","Switzerland"],["SEK","Sweden"],["NOK","Norway"],["DKK","Denmark"],
  ["PLN","Poland"],["CZK","Czech Republic"],["HUF","Hungary"],["RON","Romania"],["TRY","Turkey"],["BGN","Bulgaria"],
];
const TWO_LETTER_CODES: [string,string][] = [
  ["EU","Europe"],["US","United States"],["UK","United Kingdom"],["GB","United Kingdom"],
  ["FR","France"],["DE","Germany"],["IT","Italy"],["ES","Spain"],["PL","Poland"],["CZ","Czech Republic"],
  ["RU","Russia"],["TR","Turkey"],["AR","Argentina"],["BR","Brazil"],["BG","Bulgaria"],
  ["AU","Australia"],["JP","Japan"],["KR","South Korea"],["CN","China"],["IN","India"],
  ["CA","Canada"],["MX","Mexico"],["NZ","New Zealand"],["HK","Hong Kong"],["DK","Denmark"],
  ["FI","Finland"],["NO","Norway"],["SE","Sweden"],["CH","Switzerland"],["BE","Belgium"],
  ["NL","Netherlands"],["ZA","South Africa"],["SG","Singapore"],["SA","Saudi Arabia"],["AE","UAE"],
  ["KW","Kuwait"],["BH","Bahrain"],["OM","Oman"],["QA","Qatar"],["LB","Lebanon"],["JO","Jordan"],
  ["IQ","Iraq"],["EG","Egypt"],["IL","Israel"],["GR","Greece"],["HU","Hungary"],["PT","Portugal"],
  ["RO","Romania"],["SK","Slovakia"],["AT","Austria"],["IE","Ireland"],["HR","Croatia"],
  ["RS","Serbia"],["SI","Slovenia"],["LT","Lithuania"],["LV","Latvia"],["EE","Estonia"],
  ["TW","Taiwan"],["TH","Thailand"],["MY","Malaysia"],["PH","Philippines"],["ID","Indonesia"],
  ["VN","Vietnam"],["CL","Chile"],["CO","Colombia"],["PE","Peru"],["UA","Ukraine"],["UY","Uruguay"],["CR","Costa Rica"],
];
const REGION_EXTRACTIONS: [RegExp, string][] = [
  [/\bEU\/NA\b/i,"EU/NA"],[/\bEMEA\b/i,"EMEA"],[/\bLATAM\b/i,"Latin America"],
  [/\bMENA\b/i,"Middle East"],[/\bSEA\b/i,"Southeast Asia"],[/\bROW\b/i,"Global"],
  [/\bEUROPE\b/i,"Europe"],[/\bGLOBAL\b/i,"Global"],
  ...CURRENCY_TO_REGION.map(([code, region]) => [new RegExp(`\\b${code}\\b(?!\\s*\\d)`, "i"), region] as [RegExp, string]),
  ...TWO_LETTER_CODES.flatMap(([code, region]) => [
    [new RegExp(`\\s\\b${code}\\b(?=\\s+(PC|XBOX|PS|NINTENDO|STEAM|$))`, "i"), region] as [RegExp, string],
    [new RegExp(`\\s\\b${code}\\b\\s*$`, "i"), region] as [RegExp, string],
  ]),
];
const PLATFORM_SUFFIXES = [/\s+PC\s+STEAM\b/gi, /\s+PC\s+EPIC\s+GAMES\b/gi, /\s+PC\s+EPIC\b/gi, /\s+PC\s+GOG(?:\.COM)?\b/gi, /\s+EPIC\s+GAMES\b/gi, /\s+STEAM\b/gi, /\s+XBOX ONE\s*\/?\s*XBOX SERIES X\|S/gi, /\s+XBOX ONE\b/gi, /\s+XBOX SERIES X\|S\b/gi, /\s+XBOX SERIES\b/gi, /\s+PS4\s*\/?\s*PS5/gi, /\s+PS[45]\b/gi, /\s+NINTENDO SWITCH\b/gi, /\s+PC\s*$/gi];
const LC = new Set(["of","the","at","in","on","for","and","or","to","a","an","by","with","from","as","but","nor","so","yet","vs"]);
const UC = new Set(["DLC","RPG","VR","II","III","IV","VI","VII","VIII","IX","XI","XII","XIII","XIV","XV","XVI","XVII","XX","EA","FC","GTA","FIFA","NBA","NFL","MLB","NHL","WWE","TOTY","GOTY","HD","3D","2D","PUBG","MMO","MMORPG","FPS","RTS","JRPG","ARPG","REMAKE","UC","USD","EUR","GBP","CAD","AUD","CHF","SEK","NOK","DKK","PLN","CZK","HUF","RON","TRY","BRL","ARS","MXN","CLP","COP","PEN","JPY","KRW","CNY","INR","ZAR","SAR","AED","ILS","NZD","SGD","HKD","THB","MYR","PHP","IDR","VND","TWD","BGN","UAH","UYU","CRC","MVR"]);

function smartTC(text: string): string {
  const words = text.split(" "); let ac = false;
  return words.map((w, i) => {
    const u = w.toUpperCase(); const first = i === 0 || ac;
    if (w.endsWith(":")) ac = true; else ac = false;
    if (UC.has(u)) return u;
    if (UC.has(u.replace(":",""))) return u.charAt(0).toUpperCase() + u.slice(1).toLowerCase();
    if (/^[IVXLCDM]+$/.test(u) && u.length <= 5) return u;
    if (/^\d/.test(w)) return w;
    if (!first && LC.has(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}

function cleanTitle(orig: string, platform: string, dbRegion: string): { title: string; region: string } {
  let t = orig.trim();
  const alreadyClean = new RegExp(`\\s*-\\s*${platform.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(\\s*-\\s*.+)?$`, "i");
  t = t.replace(alreadyClean, "").toUpperCase();
  t = t.replace(/\bGIFT\s+CARD\b/gi, "CARD");
  t = t.replace(/\bGIT\s+CARD\b/gi, "CARD");
  for (const p of JUNK_PATTERNS) t = t.replace(p, "");
  let dr = "";
  for (const [p, r] of REGION_EXTRACTIONS) { if (p.test(t)) { dr = r; t = t.replace(p, ""); break; } }
  for (const p of PLATFORM_SUFFIXES) t = t.replace(p, "");
  t = t.replace(/\b(BRL|EUR|USD|GBP|AUD|CAD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|ARS|MXN|CLP|COP|PEN|JPY|KRW|CNY|INR|ZAR|SAR|AED|ILS|NZD|SGD|HKD|THB|MYR|PHP|IDR|VND|TWD|UYU|CRC|UAH|BGN|MVR)\s+(\d+(?:[.,]\d+)?)\b/gi, "$2 $1");
  // Reorder "{amount} {currency} CARD" → "CARD {amount} {currency}"
  t = t.replace(/(\d+(?:[.,]\d+)?)\s+(BRL|EUR|USD|GBP|AUD|CAD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|ARS|MXN|CLP|COP|PEN|JPY|KRW|CNY|INR|ZAR|SAR|AED|ILS|NZD|SGD|HKD|THB|MYR|PHP|IDR|VND|TWD|UYU|CRC|UAH|BGN|MVR)\s+CARD\b/gi, "CARD $1 $2");
  t = t.replace(/\s+/g, " ").replace(/[\s\-·•,]+$/, "").replace(/^[\s\-·•,]+/, "").trim();
  t = smartTC(t);
  const parts = [t]; if (platform) parts.push(platform);
  const fr = dr || dbRegion || "Global";
  if (fr && fr !== "Global") parts.push(fr);
  return { title: parts.join(" - "), region: fr };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KINGUIN_API = "https://gateway.kinguin.net/esa/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");
    if (!KINGUIN_API_KEY) throw new Error("KINGUIN_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify admin using anon client
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
    const { data: roleRows } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "super_admin"]);
    if (!roleRows || roleRows.length === 0) throw new Error("Admin access required");

    const body = await req.json().catch(() => ({}));
    const fixTitles = body.fixTitles === true;
    const fetchDescriptions = body.fetchDescriptions !== false; // default true
    const platformFilter: string | null = body.platformFilter || null;

    // Paginate to fetch kinguin_products (bypass 1000-row limit)
    // If platformFilter is set, only fetch products matching that platform
    const kinguinProducts: { allowed_product_id: string; kinguin_product_id: string }[] = [];
    const PAGE_SIZE = 1000;
    let offset = 0;

    if (platformFilter) {
      // First get allowed_product IDs matching the platform filter
      const matchingIds: string[] = [];
      let apOffset = 0;
      while (true) {
        const { data: apBatch, error: apErr } = await supabase
          .from("allowed_products")
          .select("id")
          .eq("platform", platformFilter)
          .range(apOffset, apOffset + PAGE_SIZE - 1);
        if (apErr) throw new Error(`Failed to filter by platform: ${apErr.message}`);
        if (!apBatch || apBatch.length === 0) break;
        matchingIds.push(...apBatch.map((a: any) => a.id));
        if (apBatch.length < PAGE_SIZE) break;
        apOffset += PAGE_SIZE;
      }

      // Then fetch kinguin_products for those IDs in chunks
      const CHUNK = 200;
      for (let c = 0; c < matchingIds.length; c += CHUNK) {
        const chunk = matchingIds.slice(c, c + CHUNK);
        const { data: kpBatch, error: kpErr } = await supabase
          .from("kinguin_products")
          .select("allowed_product_id, kinguin_product_id")
          .in("allowed_product_id", chunk);
        if (kpErr) throw new Error(`Failed to fetch kinguin products: ${kpErr.message}`);
        if (kpBatch) kinguinProducts.push(...kpBatch);
      }
    } else {
      while (true) {
        const { data: batch, error: kpError } = await supabase
          .from("kinguin_products")
          .select("allowed_product_id, kinguin_product_id")
          .range(offset, offset + PAGE_SIZE - 1);
        if (kpError) throw new Error(`Failed to fetch kinguin products: ${kpError.message}`);
        if (!batch || batch.length === 0) break;
        kinguinProducts.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    }
    if (!kinguinProducts || kinguinProducts.length === 0) {
      return new Response(JSON.stringify({ error: "No linked products found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current allowed_products data
    const apIds = kinguinProducts.map(kp => kp.allowed_product_id);
    let productsMap: Record<string, { platform: string; region: string }> = {};
    const missingDescIds = new Set<string>();

    // Paginate allowed_products to get platform/region and description status
    const AP_PAGE = 500;
    for (let apOff = 0; apOff < apIds.length; apOff += AP_PAGE) {
      const chunk = apIds.slice(apOff, apOff + AP_PAGE);
      const { data: apData } = await supabase
        .from("allowed_products")
        .select("id, platform, region, description")
        .in("id", chunk);
      if (apData) {
        for (const ap of apData) {
          productsMap[ap.id] = { platform: ap.platform, region: ap.region };
          if (!ap.description || ap.description.trim().length === 0) {
            missingDescIds.add(ap.id);
          }
        }
      }
    }

    // Stream progress via SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        const total = kinguinProducts.length;
        let updated = 0;
        let failed = 0;
        let titlesFixed = 0;
        let descriptionsAdded = 0;

        send({ type: "start", total });

        for (let i = 0; i < kinguinProducts.length; i++) {
          const kp = kinguinProducts[i];
          try {
            const url = `${KINGUIN_API}/products?productId=${kp.kinguin_product_id}&limit=1`;
            const res = await fetch(url, {
              headers: { "X-Api-Key": KINGUIN_API_KEY.trim(), Accept: "application/json" },
            });

            if (!res.ok) {
              failed++;
              if (res.status === 429) {
                await new Promise(r => setTimeout(r, 3000));
              }
            } else {
              const data = await res.json();
              const product = data.results?.[0];
              
              if (!product) {
                failed++;
              } else {
                // Parse system requirements from Kinguin API
                let sysReq: Record<string, unknown> | null = null;
                if (product.systemRequirements && Array.isArray(product.systemRequirements)) {
                  const minReq = product.systemRequirements.find((r: any) => r.system === "pc" && r.requirement === "minimum");
                  const recReq = product.systemRequirements.find((r: any) => r.system === "pc" && r.requirement === "recommended");
                  if (minReq || recReq) {
                    sysReq = {};
                    if (minReq) sysReq.minimum = minReq;
                    if (recReq) sysReq.recommended = recReq;
                  }
                }

                const updateData: Record<string, unknown> = {
                  developers: Array.isArray(product.developers) ? product.developers : [],
                  publishers: Array.isArray(product.publishers) ? product.publishers : [],
                  regional_limitations: product.regionalLimitations || null,
                  platform_details: product.platform || null,
                  languages: Array.isArray(product.languages) ? product.languages : [],
                  release_date: product.releaseDate || null,
                  ...(sysReq ? { system_requirements: sysReq } : {}),
                  ...(Array.isArray(product.genres) && product.genres.length > 0 ? { badges: product.genres } : {}),
                };

                // Add description if missing
                if (fetchDescriptions && missingDescIds.has(kp.allowed_product_id) && product.description) {
                  updateData.description = product.description;
                  descriptionsAdded++;
                }

                // Fix title using original Kinguin name
                if (fixTitles && product.name) {
                  const ap = productsMap[kp.allowed_product_id];
                  if (ap) {
                    const result = cleanTitle(product.name, ap.platform, ap.region);
                    updateData.title = result.title;
                    updateData.region = result.region;
                    titlesFixed++;
                  }
                }

                const { error: updateError } = await supabase
                  .from("allowed_products")
                  .update(updateData)
                  .eq("id", kp.allowed_product_id);

                if (updateError) {
                  failed++;
                } else {
                  updated++;
                }
              }
            }
          } catch {
            failed++;
          }

          send({ type: "progress", current: i + 1, total, updated, failed, titlesFixed, descriptionsAdded });

          await new Promise(r => setTimeout(r, 250));
        }

        send({ type: "done", updated, failed, total, titlesFixed, descriptionsAdded });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
