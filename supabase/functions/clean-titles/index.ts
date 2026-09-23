import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Suffixes/junk to remove from Kinguin titles
const JUNK_PATTERNS = [
  /\s*\(?CD KEY\)?/gi,
  /\s*\(?STEAM KEY\)?/gi,
  /\s*\(VALID UNTIL[^)]*\)/gi,
  /\s*\(WITHOUT[^)]*\)/gi,
  /\s*\bKINGUIN\b\s*/gi,
];

// 3-letter currency codes → region (checked before 2-letter country codes)
const CURRENCY_TO_REGION: [string, string][] = [
  ["MVR", "Maldives"], ["UAH", "Ukraine"], ["UYU", "Uruguay"], ["CRC", "Costa Rica"],
  ["COP", "Colombia"], ["SGD", "Singapore"], ["BRL", "Brazil"],
  ["ARS", "Argentina"], ["MXN", "Mexico"], ["CLP", "Chile"],
  ["PEN", "Peru"], ["JPY", "Japan"], ["KRW", "South Korea"],
  ["CNY", "China"], ["INR", "India"], ["ZAR", "South Africa"],
  ["SAR", "Saudi Arabia"], ["AED", "UAE"], ["ILS", "Israel"],
  ["NZD", "New Zealand"], ["HKD", "Hong Kong"], ["THB", "Thailand"],
  ["MYR", "Malaysia"], ["PHP", "Philippines"], ["IDR", "Indonesia"],
  ["VND", "Vietnam"], ["TWD", "Taiwan"], ["EUR", "Europe"],
  ["GBP", "United Kingdom"], ["USD", "United States"], ["CAD", "Canada"],
  ["AUD", "Australia"], ["CHF", "Switzerland"], ["SEK", "Sweden"],
  ["NOK", "Norway"], ["DKK", "Denmark"], ["PLN", "Poland"],
  ["CZK", "Czech Republic"], ["HUF", "Hungary"], ["RON", "Romania"],
  ["TRY", "Turkey"], ["BGN", "Bulgaria"],
];

// Full country names → region (checked FIRST)
const COUNTRY_NAME_REGIONS: [string, string][] = [
  ["United States","United States"],["United Kingdom","United Kingdom"],["North America","North America"],
  ["South Korea","South Korea"],["New Zealand","New Zealand"],["Hong Kong","Hong Kong"],
  ["South Africa","South Africa"],["Saudi Arabia","Saudi Arabia"],["Czech Republic","Czech Republic"],
  ["Costa Rica","Costa Rica"],["Sri Lanka","Sri Lanka"],["El Salvador","El Salvador"],
  ["Luxembourg","Luxembourg"],["Bangladesh","Bangladesh"],["Switzerland","Switzerland"],
  ["Netherlands","Netherlands"],["Philippines","Philippines"],["Argentina","Argentina"],
  ["Australia","Australia"],["Austria","Austria"],["Azerbaijan","Azerbaijan"],["Bahrain","Bahrain"],
  ["Belarus","Belarus"],["Belgium","Belgium"],["Belize","Belize"],["Bhutan","Bhutan"],
  ["Bolivia","Bolivia"],["Brazil","Brazil"],["Bulgaria","Bulgaria"],["Canada","Canada"],
  ["Chile","Chile"],["China","China"],["Colombia","Colombia"],["Croatia","Croatia"],
  ["Denmark","Denmark"],["Ecuador","Ecuador"],["Egypt","Egypt"],["Estonia","Estonia"],
  ["Finland","Finland"],["France","France"],["Georgia","Georgia"],["Germany","Germany"],
  ["Greece","Greece"],["Guatemala","Guatemala"],["Guyana","Guyana"],["Honduras","Honduras"],
  ["Hungary","Hungary"],["India","India"],["Indonesia","Indonesia"],["Iraq","Iraq"],
  ["Ireland","Ireland"],["Israel","Israel"],["Italy","Italy"],["Japan","Japan"],
  ["Jordan","Jordan"],["Kuwait","Kuwait"],["Latvia","Latvia"],["Lebanon","Lebanon"],
  ["Libya","Libya"],["Lithuania","Lithuania"],["Malaysia","Malaysia"],["Maldives","Maldives"],
  ["Mexico","Mexico"],["Moldova","Moldova"],["Morocco","Morocco"],["Nepal","Nepal"],
  ["Nicaragua","Nicaragua"],["Norway","Norway"],["Oman","Oman"],["Pakistan","Pakistan"],
  ["Panama","Panama"],["Paraguay","Paraguay"],["Peru","Peru"],["Poland","Poland"],
  ["Portugal","Portugal"],["Qatar","Qatar"],["Romania","Romania"],["Russia","Russia"],
  ["Serbia","Serbia"],["Singapore","Singapore"],["Slovakia","Slovakia"],["Slovenia","Slovenia"],
  ["Spain","Spain"],["Sudan","Sudan"],["Suriname","Suriname"],["Sweden","Sweden"],
  ["Taiwan","Taiwan"],["Tajikistan","Tajikistan"],["Thailand","Thailand"],["Tunisia","Tunisia"],
  ["Turkey","Turkey"],["Turkmenistan","Turkmenistan"],["Ukraine","Ukraine"],["Uruguay","Uruguay"],
  ["Venezuela","Venezuela"],["Vietnam","Vietnam"],["Yemen","Yemen"],["Algeria","Algeria"],
  ["Armenia","Armenia"],
];

const REGION_EXTRACTIONS: [RegExp, string][] = [
  [/\bEU\/NA\b/i, "EU/NA"],
  [/\bEMEA\b/i, "EMEA"],
  [/\bLATAM\b/i, "Latin America"],
  [/\bMENA\b/i, "Middle East"],
  [/\bSEA\b/i, "Southeast Asia"],
  [/\bROW\b/i, "Global"],
  [/\bEUROPE\b/i, "Europe"],
  [/\bGLOBAL\b/i, "Global"],
  // Full country names FIRST
  ...COUNTRY_NAME_REGIONS.map(([name, region]) => [
    new RegExp(`\\b${name}\\b`, "i"), region
  ] as [RegExp, string]),
  // Two-letter country codes (so "10 USD BD" → Bangladesh, not United States)
  ...[
    ["EU", "Europe"], ["US", "United States"], ["UK", "United Kingdom"],
    ["GB", "United Kingdom"], ["FR", "France"], ["DE", "Germany"],
    ["IT", "Italy"], ["ES", "Spain"], ["PL", "Poland"], ["CZ", "Czech Republic"],
    ["RU", "Russia"], ["TR", "Turkey"], ["AR", "Argentina"], ["BR", "Brazil"],
    ["BG", "Bulgaria"], ["AU", "Australia"], ["JP", "Japan"], ["KR", "South Korea"],
    ["CN", "China"], ["IN", "India"], ["CA", "Canada"], ["MX", "Mexico"],
    ["NZ", "New Zealand"], ["HK", "Hong Kong"], ["DK", "Denmark"],
    ["FI", "Finland"], ["NO", "Norway"], ["SE", "Sweden"], ["CH", "Switzerland"],
    ["BE", "Belgium"], ["NL", "Netherlands"], ["ZA", "South Africa"],
    ["SG", "Singapore"], ["SA", "Saudi Arabia"], ["AE", "UAE"],
    ["KW", "Kuwait"], ["BH", "Bahrain"], ["OM", "Oman"], ["QA", "Qatar"],
    ["LB", "Lebanon"], ["JO", "Jordan"], ["IQ", "Iraq"], ["EG", "Egypt"],
    ["IL", "Israel"], ["GR", "Greece"], ["HU", "Hungary"], ["PT", "Portugal"],
    ["RO", "Romania"], ["SK", "Slovakia"], ["AT", "Austria"], ["IE", "Ireland"],
    ["HR", "Croatia"], ["RS", "Serbia"], ["SI", "Slovenia"],
    ["LT", "Lithuania"], ["LV", "Latvia"], ["EE", "Estonia"],
    ["TW", "Taiwan"], ["TH", "Thailand"], ["MY", "Malaysia"],
    ["PH", "Philippines"], ["ID", "Indonesia"], ["VN", "Vietnam"],
    ["CL", "Chile"], ["CO", "Colombia"], ["PE", "Peru"],
    ["UA", "Ukraine"], ["UY", "Uruguay"], ["CR", "Costa Rica"],
    ["BD", "Bangladesh"], ["BT", "Bhutan"], ["LK", "Sri Lanka"],
    ["NP", "Nepal"], ["MV", "Maldives"], ["LU", "Luxembourg"],
    ["PK", "Pakistan"], ["BZ", "Belize"], ["SD", "Sudan"],
    ["TN", "Tunisia"], ["LY", "Libya"], ["MA", "Morocco"],
    ["DZ", "Algeria"], ["YE", "Yemen"], ["EC", "Ecuador"],
    ["BO", "Bolivia"], ["PY", "Paraguay"], ["AZ", "Azerbaijan"],
    ["VE", "Venezuela"], ["SR", "Suriname"], ["GY", "Guyana"],
    ["AM", "Armenia"], ["PA", "Panama"], ["HN", "Honduras"],
    ["GT", "Guatemala"], ["NI", "Nicaragua"], ["MD", "Moldova"],
    ["TM", "Turkmenistan"], ["BY", "Belarus"], ["SV", "El Salvador"],
    ["GE", "Georgia"], ["TJ", "Tajikistan"],
  ].flatMap(([code, region]) => [
    [new RegExp(`\\s\\b${code}\\b(?=\\s+(PC|XBOX|PS|NINTENDO|STEAM|$))`, "i"), region] as [RegExp, string],
    [new RegExp(`\\s\\b${code}\\b\\s*$`, "i"), region] as [RegExp, string],
  ]),
  // 3-letter currency codes (fallback after country codes)
  ...CURRENCY_TO_REGION.map(([code, region]) => [
    new RegExp(`\\b${code}\\b(?!\\s*\\d)`, "i"), region
  ] as [RegExp, string]),
];

const PLATFORM_SUFFIXES = [
  /\s+PC\s+STEAM\b/gi,
  /\s+PC\s+EPIC\b/gi,
  /\s+PC\s+GOG\b/gi,
  /\s+STEAM\b/gi,
  /\s+XBOX ONE\s*\/?\s*XBOX SERIES X\|S/gi,
  /\s+XBOX ONE\b/gi,
  /\s+XBOX SERIES X\|S\b/gi,
  /\s+XBOX SERIES\b/gi,
  /\s+PS4\s*\/?\s*PS5/gi,
  /\s+PS[45]\b/gi,
  /\s+NINTENDO SWITCH\b/gi,
  /\s+PC\s*$/gi,
];

// Words that should stay lowercase in title case
const LOWERCASE_WORDS = new Set(["of", "the", "at", "in", "on", "for", "and", "or", "to", "a", "an", "by", "with", "from", "as", "but", "nor", "so", "yet", "vs"]);

// Known acronyms/brands that should stay uppercase
const UPPERCASE_WORDS = new Set(["DLC", "RPG", "VR", "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XX", "EA", "FC", "GTA", "FIFA", "NBA", "NFL", "MLB", "NHL", "WWE", "TOTY", "GOTY", "HD", "3D", "2D", "PUBG", "MMO", "MMORPG", "FPS", "RTS", "JRPG", "ARPG", "REMAKE", "GOG", "PSN", "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "TRY", "BRL", "ARS", "MXN", "CLP", "COP", "PEN", "JPY", "KRW", "CNY", "INR", "ZAR", "SAR", "AED", "ILS", "NZD", "SGD", "HKD", "THB", "MYR", "PHP", "IDR", "VND", "TWD", "BGN", "UAH", "UYU", "CRC", "MVR"]);
const BRAND_CASING: Record<string, string> = { "PLAYSTATION": "PlayStation", "XBOX": "Xbox", "NINTENDO": "Nintendo", "ESHOP": "eShop", "BATTLENET": "Battle.net" };

function smartTitleCase(text: string): string {
  // Split by spaces but handle colons specially - capitalize after colon
  const words = text.split(" ");
  let afterColon = false;
  
  return words.map((word, idx) => {
    const upper = word.toUpperCase();
    const isFirstOrAfterColon = idx === 0 || afterColon;
    
    // Check if this word ends with colon
    if (word.endsWith(":")) afterColon = true;
    else afterColon = false;
    
    // Keep known acronyms
    if (UPPERCASE_WORDS.has(upper)) return upper;
    if (BRAND_CASING[upper]) return BRAND_CASING[upper];
    if (UPPERCASE_WORDS.has(upper.replace(":", ""))) return upper.charAt(0).toUpperCase() + upper.slice(1).toLowerCase();
    // Keep Roman numerals
    if (/^[IVXLCDM]+$/.test(upper) && upper.length <= 5) return upper;
    // Keep numbers and alphanumeric codes
    if (/^\d/.test(word)) return word;
    // Lowercase common words (except first word or after colon)
    if (!isFirstOrAfterColon && LOWERCASE_WORDS.has(word.toLowerCase())) {
      return word.toLowerCase();
    }
    // Title case
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
}

function cleanTitle(originalTitle: string, platform: string, dbRegion: string): { title: string; region: string } {
  let title = originalTitle.trim();
  
  // If title already looks cleaned (contains " - Platform" suffix), strip it first
  const alreadyCleanedPattern = new RegExp(`\\s*-\\s*${platform.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*-\\s*.+)?$`, "i");
  title = title.replace(alreadyCleanedPattern, "");
  
  title = title.toUpperCase();
  
  // Normalize "GIFT CARD" → "CARD"
  title = title.replace(/\bGIFT\s+CARD\b/gi, "CARD");
  title = title.replace(/\bGIT\s+CARD\b/gi, "CARD");
  
  // Remove junk patterns
  for (const pattern of JUNK_PATTERNS) {
    title = title.replace(pattern, "");
  }
  
  // Strip "- Other -" or "- Other" platform/region suffixes
  title = title.replace(/\s*-\s*OTHER\s*-\s*/gi, " - ").replace(/\s*-\s*OTHER\s*$/gi, "").trim();
  
  // Extract region from title
  let detectedRegion = "";
  for (const [pattern, region] of REGION_EXTRACTIONS) {
    if (pattern.test(title)) {
      detectedRegion = region;
      title = title.replace(pattern, "");
      break;
    }
  }
  
  // Remove platform suffixes
  for (const pattern of PLATFORM_SUFFIXES) {
    title = title.replace(pattern, "");
  }
  
  // Swap "CUR 123" → "123 CUR"
  title = title.replace(/\b(BRL|EUR|USD|GBP|AUD|CAD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|ARS|MXN|CLP|COP|PEN|JPY|KRW|CNY|INR|ZAR|SAR|AED|ILS|NZD|SGD|HKD|THB|MYR|PHP|IDR|VND|TWD|UYU|CRC|UAH|BGN|MVR)\s+(\d+(?:[.,]\d+)?)\b/gi, "$2 $1");
  // Reorder "{amount} {currency} CARD" → "CARD {amount} {currency}"
  title = title.replace(/(\d+(?:[.,]\d+)?)\s+(BRL|EUR|USD|GBP|AUD|CAD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|ARS|MXN|CLP|COP|PEN|JPY|KRW|CNY|INR|ZAR|SAR|AED|ILS|NZD|SGD|HKD|THB|MYR|PHP|IDR|VND|TWD|UYU|CRC|UAH|BGN|MVR)\s+CARD\b/gi, "CARD $1 $2");
  
  // Clean up extra spaces and trailing punctuation
  title = title.replace(/\s+/g, " ").replace(/[\s\-·•,\/]+$/, "").replace(/^[\s\-·•,\/]+/, "").trim();
  
  // Smart title case
  title = smartTitleCase(title);
  
  // Build final title: Name - Platform - Region
  const parts = [title];
  // Only add platform suffix if the title doesn't already contain the platform name
  if (platform && !title.toLowerCase().includes(platform.toLowerCase())) {
    parts.push(platform);
  }
  const finalRegion = detectedRegion || dbRegion || "Global";
  if (finalRegion && finalRegion !== "Global") parts.push(finalRegion);
  
  return { title: parts.join(" - "), region: finalRegion };
}

// Export for use by other functions
export { cleanTitle };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { data: roleRows } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "super_admin"]);
    if (!roleRows || roleRows.length === 0) throw new Error("Admin access required");

    const { dryRun = false, batchStart = 0, batchLimit = 300 } = await req.json().catch(() => ({}));

    // Fetch batch of allowed products
    const { data: allProducts, error: fetchErr } = await supabase
      .from("allowed_products")
      .select("id, title, platform, store, region")
      .range(batchStart, batchStart + batchLimit - 1);
    if (fetchErr) throw fetchErr;
    if (!allProducts || allProducts.length === 0) {
      return new Response(JSON.stringify({ total: 0, changed: 0, updated: 0, done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing batch of ${allProducts.length} products (offset ${batchStart})`);

    const results: { id: string; old: string; new: string }[] = [];
    let updated = 0;

    // Process and update concurrently in small batches
    const updates: Promise<void>[] = [];
    for (const product of allProducts) {
      const result = cleanTitle(product.title, product.platform, product.region || "Global");
      
      if (result.title !== product.title || result.region !== (product.region || "Global")) {
        results.push({ id: product.id, old: product.title, new: result.title });
        
        if (!dryRun) {
          updates.push(
            supabase
              .from("allowed_products")
              .update({ title: result.title, region: result.region })
              .eq("id", product.id)
              .then(({ error }) => { if (!error) updated++; })
          );
        }
      }
    }
    
    // Execute all updates concurrently
    await Promise.all(updates);

    return new Response(JSON.stringify({ 
      total: allProducts.length, 
      changed: results.length, 
      updated,
      dryRun,
      hasMore: allProducts.length >= batchLimit,
      nextStart: batchStart + batchLimit,
      samples: results.slice(0, 10) 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
