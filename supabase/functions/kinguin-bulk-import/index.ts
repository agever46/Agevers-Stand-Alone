import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Standardize Kinguin CDN image URLs to consistent 600x800 (3:4 portrait)
const STANDARD_IMG_WIDTH = 600;
const STANDARD_IMG_HEIGHT = 800;

function standardizeImageUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    // Kinguin uses Cloudflare CDN: /cdn-cgi/image/width=X,height=Y,.../path
    const cfMatch = url.match(/^(https?:\/\/[^/]+)\/cdn-cgi\/image\/([^/]+)\/(.+)$/);
    if (cfMatch) {
      const [, origin, , imagePath] = cfMatch;
      return `${origin}/cdn-cgi/image/width=${STANDARD_IMG_WIDTH},height=${STANDARD_IMG_HEIGHT},fit=contain,format=auto,quality=85/${imagePath}`;
    }
    // For non-CF URLs, return as-is
    return url;
  } catch {
    return url;
  }
}

// Region detection from country/region codes in title
const REGION_CODES: Record<string, string> = {
  // Multi-word regions FIRST (matched before sub-strings like "ASIA")
  "SOUTHEAST ASIA": "Southeast Asia", "SOUTH EAST ASIA": "Southeast Asia",
  "ASIA/OCEANIA": "Asia", "ASIA PACIFIC": "Asia", "ASIA-PACIFIC": "Asia",
  "ASIA": "Asia", "OCEANIA": "Australia",
  "EU": "Europe", "EUROPE": "Europe",
  "NA": "North America", "US": "United States", "USA": "United States",
  "UK": "United Kingdom", "GB": "United Kingdom",
  "FR": "France", "DE": "Germany", "IT": "Italy", "ES": "Spain",
  "PL": "Poland", "CZ": "Czech Republic", "RU": "Russia", "RUS": "Russia",
  "TR": "Turkey", "AR": "Argentina", "BR": "Brazil", "BG": "Bulgaria",
  "AU": "Australia", "JP": "Japan", "KR": "South Korea",
  "CN": "China", "IN": "India", "LATAM": "Latin America",
  "MENA": "Middle East", "SEA": "Southeast Asia",
  "ROW": "Rest of World", "WW": "Worldwide",
  "GLOBAL": "Global",
  "HK": "Hong Kong", "SA": "Saudi Arabia", "AE": "UAE",
  "PT": "Portugal", "NL": "Netherlands", "RO": "Romania", "HU": "Hungary",
  "NO": "Norway", "SE": "Sweden", "DK": "Denmark", "FI": "Finland",
  "CH": "Switzerland", "BE": "Belgium", "SK": "Slovakia", "GR": "Greece",
  "IL": "Israel", "ZA": "South Africa", "SG": "Singapore",
  "NZ": "New Zealand", "MX": "Mexico", "CA": "Canada",
  "CL": "Chile", "CO": "Colombia", "PE": "Peru",
  "AT": "Austria", "IE": "Ireland", "HR": "Croatia",
  "RS": "Serbia", "SI": "Slovenia", "LT": "Lithuania",
  "LV": "Latvia", "EE": "Estonia", "TW": "Taiwan",
  "TH": "Thailand", "MY": "Malaysia", "PH": "Philippines",
  "ID": "Indonesia", "VN": "Vietnam", "MV": "Maldives",
  "UA": "Ukraine", "UY": "Uruguay", "CR": "Costa Rica", "LU": "Luxembourg",
  "PK": "Pakistan", "BZ": "Belize", "SD": "Sudan",
  "TN": "Tunisia", "LY": "Libya", "MA": "Morocco",
  "DZ": "Algeria", "YE": "Yemen", "EC": "Ecuador",
  "BO": "Bolivia", "PY": "Paraguay", "AZ": "Azerbaijan",
  "BT": "Bhutan", "LK": "Sri Lanka", "BD": "Bangladesh", "NP": "Nepal",
  "VE": "Venezuela", "SR": "Suriname", "GY": "Guyana", "AM": "Armenia",
  "PA": "Panama", "HN": "Honduras", "GT": "Guatemala", "NI": "Nicaragua",
  "MD": "Moldova", "TM": "Turkmenistan", "BY": "Belarus", "SV": "El Salvador",
  "GE": "Georgia", "TJ": "Tajikistan",
  "KSA": "Saudi Arabia", "KUW": "Kuwait", "QAT": "Qatar", "UAE": "United Arab Emirates",
  "BAH": "Bahrain", "OMN": "Oman",
  // Currency codes → region
  "CLP": "Chile", "COP": "Colombia", "IDR": "Indonesia", "MVR": "Maldives",
  "VND": "Vietnam", "CRC": "Costa Rica", "UYU": "Uruguay", "UAH": "Ukraine",
  "BRL": "Brazil", "ARS": "Argentina", "MXN": "Mexico", "PEN": "Peru",
  "JPY": "Japan", "KRW": "South Korea", "CNY": "China", "INR": "India",
  "ZAR": "South Africa", "SAR": "Saudi Arabia", "AED": "UAE", "ILS": "Israel",
  "NZD": "New Zealand", "HKD": "Hong Kong", "SGD": "Singapore",
  "THB": "Thailand", "MYR": "Malaysia", "PHP": "Philippines", "TWD": "Taiwan",
  "BGN": "Bulgaria",
};

// Currency codes → region mapping (for gift cards with currency in title)
const CURRENCY_REGION_MAP: Record<string, string> = {
  "USD": "United States", "EUR": "Europe", "GBP": "United Kingdom",
  "AUD": "Australia", "CAD": "Canada", "BRL": "Brazil",
  "TRY": "Turkey", "PLN": "Poland", "CZK": "Czech Republic",
  "HUF": "Hungary", "SEK": "Sweden", "NOK": "Norway",
  "DKK": "Denmark", "CHF": "Switzerland", "JPY": "Japan",
  "KRW": "South Korea", "TWD": "Taiwan", "HKD": "Hong Kong",
  "SGD": "Singapore", "MYR": "Malaysia", "THB": "Thailand",
  "INR": "India", "ARS": "Argentina", "MXN": "Mexico",
  "ZAR": "South Africa", "SAR": "Saudi Arabia", "AED": "UAE",
  "QAR": "Qatar", "KWD": "Kuwait", "BHD": "Bahrain",
  "OMR": "Oman", "UAH": "Ukraine", "NZD": "New Zealand",
  "PHP": "Philippines", "IDR": "Indonesia", "VND": "Vietnam",
  "ILS": "Israel", "EGP": "Egypt", "RON": "Romania",
  "BGN": "Bulgaria", "RUB": "Russia", "PEN": "Peru",
  "CLP": "Chile", "COP": "Colombia", "MVR": "Maldives",
  "UYU": "Uruguay", "CRC": "Costa Rica",
};

function detectRegion(name: string): string {
  const upper = name.toUpperCase();
  for (const [code, region] of Object.entries(REGION_CODES)) {
    const patterns = [
      new RegExp(`[\\(\\[\\s\\-/]${code}[\\)\\]\\s\\-/,]`, "i"),
      new RegExp(`^${code}\\s`, "i"),
      new RegExp(`\\s${code}$`, "i"),
    ];
    if (patterns.some((p) => p.test(` ${upper} `))) return region;
  }
  for (const [currency, region] of Object.entries(CURRENCY_REGION_MAP)) {
    if (new RegExp(`\\b\\d+\\s*${currency}\\b`, "i").test(name)) return region;
  }
  return "Global";
}

// Blocked title keywords - products we never sell
const BLOCKED_KEYWORDS = ["ACCOUNT", "ALTERGIFT", "ALTER GIFT", "STEAM GIFT", "VOUCHER"];

// Brand names and specific product-line phrases only — deliberately no bare
// "antivirus"/"internet security"/"total security" catch-alls, since those
// false-positived on an unrelated Steam game ("Antivirus Girl").
const ANTIVIRUS_KEYWORDS = [
  "AVAST", "MCAFEE", "TREND MICRO", "NORTON", "BITDEFENDER", "KASPERSKY",
  "MALWAREBYTES", "WEBROOT", "AVIRA", "PANDA SECURITY", "F-SECURE", "SOPHOS",
  "ESET INTERNET SECURITY", "ESET NOD32", "ESET SMART SECURITY", "ESET ANTIVIRUS", "ESET HOME SECURITY",
  "AVG ANTIVIRUS", "AVG INTERNET SECURITY", "AVG ULTIMATE", "TOTAL AV",
];

const AI_KEYWORDS = ["PERPLEXITY", "CHATGPT", "OPENAI", "CLAUDE", "MIDJOURNEY", "COPILOT", "GEMINI AI", "DALL-E", "DALLE", "SUNO", "CURSOR", "GITHUB COPILOT", "JASPER AI", "GRAMMARLY", "NOTION AI", "ADOBE FIREFLY", "STABLE DIFFUSION", "RUNWAY", "SYNTHESIA", "ELEVENLABS", "MURF AI", "WRITESONIC", "COPY.AI"];

// Streaming service keywords for Media & Streaming category
const STREAMING_KEYWORDS = ["NETFLIX", "SPOTIFY", "HULU", "DISNEY PLUS", "DISNEY+", "HBO MAX", "HBO GO", "APPLE TV", "APPLE MUSIC", "APPLE ARCADE", "YOUTUBE PREMIUM", "YOUTUBE MUSIC", "PARAMOUNT PLUS", "PARAMOUNT+", "PEACOCK", "CRUNCHYROLL", "FUNIMATION", "DEEZER", "TIDAL", "DAZN", "MUBI", "CURIOSITYSTREAM", "CURIOSITY STREAM", "SHUDDER", "BRITBOX", "HAYU", "STARZ", "SHOWTIME", "AUDIBLE", "KINDLE UNLIMITED"];

function detectPlatformAndStore(kinguinPlatform: string, name: string, categoryOverride?: string): { platform: string; store: string; category: string } {
  // If caller specified a category override, use it
  if (categoryOverride) {
    const overrideMap: Record<string, { platform: string; store: string; category: string }> = {
      "in-game-items": { platform: "PC", store: "In-Game Items", category: "in-game-items" },
      "gift-cards": { platform: "Gift Cards", store: "Gift Cards", category: "gift-cards" },
      "media-streaming": { platform: "Media & Streaming", store: "Media & Streaming", category: "media-streaming" },
      "software": { platform: "Software", store: "Software", category: "software" },
      "pre-orders": { platform: "PC", store: "Pre-Orders", category: "pre-orders" },
      "windows": { platform: "Software", store: "Windows", category: "software" },
      "office": { platform: "Software", store: "Office", category: "software" },
      "antivirus": { platform: "Software", store: "Antivirus & Utilities", category: "software" },
    };
    if (overrideMap[categoryOverride]) return overrideMap[categoryOverride];
  }

  const upper = name.toUpperCase();
  const plat = kinguinPlatform?.toUpperCase() || "";

  // Roblox / Robux → In-Game Items
  if (upper.includes("ROBLOX") || upper.includes("ROBUX")) {
    return { platform: "PC", store: "In-Game Items", category: "in-game-items" };
  }

  // Streaming / Media detection
  if (STREAMING_KEYWORDS.some((kw) => upper.includes(kw))) {
    return { platform: "Media & Streaming", store: "Media & Streaming", category: "media-streaming" };
  }

  // Gift Cards detection - generic brands (non-gaming gift cards)
  const GIFT_CARD_BRANDS = [
    "JUST EAT", "AMAZON", "GOOGLE PLAY", "APPLE STORE", "ITUNES", "APP STORE",
    "EBAY", "WALMART", "TARGET", "STARBUCKS", "UBER", "UBER EATS", "LYFT",
    "AIRBNB", "BOOKING", "DOORDASH", "GRUBHUB", "ZALANDO", "ASOS", "H&M",
    "IKEA", "SEPHORA", "ULTA", "BEST BUY", "HOME DEPOT", "LOWE'S", "COSTCO",
    "MASTERCARD", "VISA", "PAYSAFECARD", "PAYSAFE", "NEOSURF", "FLEXEPIN",
    "RAZER GOLD", "BITNOVO", "TRANSCASH", "TONEO", "CASHLIB", "MYNTRA",
    "FLIPKART", "LIFESTYLE", "BIGBASKET", "ZOMATO", "SWIGGY", "BURGER KING",
    "MCDONALD", "KFC", "DOMINO", "PIZZA HUT", "SUBWAY", "DUNKIN",
    "PRIMARK", "TOYS R US", "TOYWORLD", "DECATHLON", "FNAC", "MEDIAMARKT",
    "SAKS", "MACY", "NORDSTROM", "JCPENNEY", "KOHLS", "BURBERRY", "ZARA",
    "ETSY", "SHEIN", "ALIEXPRESS", "WISH", "SHOPIFY",
  ];
  const isLikelyGiftCard = upper.includes("GIFT CARD") || upper.includes("GIFTCARD") || upper.includes("E-GIFT") || upper.includes("EGIFT") || upper.includes("GIFT VOUCHER");
  if (GIFT_CARD_BRANDS.some((b) => upper.includes(b))) {
    return { platform: "Gift Cards", store: "Gift Cards", category: "gift-cards" };
  }
  // Generic "Gift Card" in title without known gaming platform → Gift Cards
  if (isLikelyGiftCard && !plat.includes("XBOX") && !plat.includes("PLAYSTATION") && !plat.includes("PSN") && !plat.includes("NINTENDO") && !upper.includes("XBOX") && !upper.includes("PLAYSTATION") && !upper.includes("PSN") && !upper.includes("NINTENDO") && !upper.includes("STEAM")) {
    return { platform: "Gift Cards", store: "Gift Cards", category: "gift-cards" };
  }

  // Software / Antivirus detection — run before AI so an AV suite with an
  // AI-branded feature name doesn't get misrouted.
  if (ANTIVIRUS_KEYWORDS.some((kw) => upper.includes(kw))) {
    return { platform: "Software", store: "Antivirus & Utilities", category: "software" };
  }

  // Software / AI detection
  if (AI_KEYWORDS.some((kw) => upper.includes(kw))) {
    return { platform: "Software", store: "AI", category: "ai" };
  }

  // Xbox
  if (plat.includes("XBOX") || upper.includes("XBOX")) {
    if (upper.includes("GAME PASS") || upper.includes("SUBSCRIPTION") || upper.includes("XBOX LIVE GOLD") || upper.includes("EA PLAY")) return { platform: "Xbox", store: "Subscriptions", category: "subscriptions" };
    if (upper.includes("GIFT CARD") || upper.includes("PREPAID") || upper.includes("TOP UP") || upper.includes("TOPUP") || upper.includes("WALLET")) return { platform: "Xbox", store: "Top Ups", category: "top-ups" };
    return { platform: "Xbox", store: "Games", category: "games" };
  }
  // PlayStation
  if (plat.includes("PLAYSTATION") || plat.includes("PSN") || upper.includes("PLAYSTATION") || upper.includes("PSN") || upper.includes("PS PLUS") || upper.includes("PS5") || upper.includes("PS4")) {
    if (upper.includes("PS PLUS") || upper.includes("PS+") || upper.includes("PLAYSTATION PLUS") || upper.includes("SUBSCRIPTION") || upper.includes("EA PLAY")) return { platform: "PlayStation", store: "Subscriptions", category: "subscriptions" };
    if (upper.includes("GIFT CARD") || upper.includes("PREPAID") || upper.includes("WALLET") || upper.includes("TOP UP") || upper.includes("TOPUP") || upper.includes("PSN CARD")) return { platform: "PlayStation", store: "Top Ups", category: "top-ups" };
    return { platform: "PlayStation", store: "Games", category: "games" };
  }
  // Nintendo
  if (plat.includes("NINTENDO") || upper.includes("NINTENDO") || upper.includes("SWITCH")) {
    if (upper.includes("ONLINE") || upper.includes("SUBSCRIPTION") || upper.includes("MEMBERSHIP")) return { platform: "Nintendo", store: "Subscriptions", category: "subscriptions" };
    if (upper.includes("ESHOP") || upper.includes("GIFT CARD") || upper.includes("TOP UP") || upper.includes("TOPUP")) return { platform: "Nintendo", store: "Top Ups", category: "top-ups" };
    return { platform: "Nintendo", store: "Games", category: "games" };
  }
  // PC platforms
  if (upper.includes("EPIC GAMES") || upper.includes("EPIC STORE")) return { platform: "PC", store: "Epic Games", category: "games" };
  if (upper.includes("GOG")) return { platform: "PC", store: "GOG", category: "games" };
  if (upper.includes("UBISOFT") || upper.includes("UPLAY")) return { platform: "PC", store: "Ubisoft", category: "games" };
  if (upper.includes("EA APP") || plat.includes("ORIGIN") || plat === "EA" || (upper.includes("EA PLAY") && !upper.includes("XBOX") && !upper.includes("PS"))) return { platform: "PC", store: "EA Games", category: "games" };
  if (upper.includes("BATTLE.NET") || upper.includes("BLIZZARD") || upper.includes("BATTLENET")) return { platform: "PC", store: "Blizzard", category: "games" };
  if (upper.includes("ROCKSTAR") || upper.includes("SOCIAL CLUB")) return { platform: "PC", store: "Rockstar", category: "games" };
  if (upper.includes("WINDOWS STORE") || upper.includes("MICROSOFT STORE") || upper.includes("WINDOWS KEY") || upper.includes("WINDOWS CD KEY") || upper.includes("WINDOWS 10") || upper.includes("WINDOWS 11")) return { platform: "PC", store: "Microsoft Store", category: "games" };
  // Game Pass for PC
  if (upper.includes("GAME PASS") && upper.includes("PC")) return { platform: "Xbox", store: "Subscriptions", category: "subscriptions" };
  if (upper.includes("GAME PASS")) return { platform: "Xbox", store: "Subscriptions", category: "subscriptions" };
  // Steam Wallet / Top Ups
  if (upper.includes("STEAM WALLET") || upper.includes("STEAM GIFT CARD") || (upper.includes("STEAM") && (upper.includes("TOP UP") || upper.includes("TOPUP") || upper.includes("PREPAID") || upper.includes("WALLET")))) return { platform: "PC", store: "Steam", category: "topups" };
  // Non-gaming gift cards (has CARD/GIFT/VOUCHER + currency pattern, no known gaming platform)
  // Run BEFORE the Steam default so gift cards aren't misclassified as Steam Games
  if ((upper.includes(" CARD") || upper.startsWith("CARD ") || upper.includes("GIFT") || upper.includes("VOUCHER") || upper.includes("TOP UP") || upper.includes("PREPAID")) && /\b\d+(?:\.\d+)?\s*(USD|EUR|GBP|CAD|AUD|BRL|ARS|MXN|CLP|PEN|JPY|KRW|CNY|INR|ZAR|SAR|AED|ILS|NZD|HKD|THB|MYR|PHP|IDR|VND|TWD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|BGN|SGD|UAH|UYU|CRC|COP)\b/i.test(name)) {
    return { platform: "Gift Cards", store: "Gift Cards", category: "gift-cards" };
  }
  // Default to Steam for PC
  if (plat.includes("PC") || plat.includes("STEAM") || upper.includes("STEAM")) return { platform: "PC", store: "Steam", category: "games" };
  return { platform: "PC", store: "Steam", category: "games" };
}

// Title cleaning logic
const TITLE_JUNK = [/\s*\(?CD KEY\)?/gi, /\s*\(?STEAM KEY\)?/gi, /\s*\(VALID UNTIL[^)]*\)/gi, /\s*\(WITHOUT[^)]*\)/gi, /\s*\bKINGUIN\b\s*/gi];

const TITLE_CURRENCY_REGIONS: [string, string][] = [
  ["MVR","Maldives"],["UAH","Ukraine"],["UYU","Uruguay"],["CRC","Costa Rica"],["COP","Colombia"],["SGD","Singapore"],
  ["BRL","Brazil"],["ARS","Argentina"],["MXN","Mexico"],["CLP","Chile"],["PEN","Peru"],
  ["JPY","Japan"],["KRW","South Korea"],["CNY","China"],["INR","India"],["ZAR","South Africa"],
  ["SAR","Saudi Arabia"],["AED","UAE"],["ILS","Israel"],["NZD","New Zealand"],["HKD","Hong Kong"],
  ["THB","Thailand"],["MYR","Malaysia"],["PHP","Philippines"],["IDR","Indonesia"],["VND","Vietnam"],
  ["TWD","Taiwan"],["EUR","Europe"],["GBP","United Kingdom"],["USD","United States"],["CAD","Canada"],
  ["AUD","Australia"],["CHF","Switzerland"],["SEK","Sweden"],["NOK","Norway"],["DKK","Denmark"],
  ["PLN","Poland"],["CZK","Czech Republic"],["HUF","Hungary"],["RON","Romania"],["TRY","Turkey"],["BGN","Bulgaria"],
];

const TWO_LETTER_CODES: [string, string][] = [
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
  ["BD","Bangladesh"], ["BT","Bhutan"], ["LK","Sri Lanka"], ["NP","Nepal"], ["MV","Maldives"],
  ["LU","Luxembourg"], ["PK","Pakistan"], ["BZ","Belize"], ["SD","Sudan"], ["TN","Tunisia"], ["LY","Libya"],
  ["MA","Morocco"], ["DZ","Algeria"], ["YE","Yemen"], ["EC","Ecuador"], ["BO","Bolivia"], ["PY","Paraguay"],
  ["AZ","Azerbaijan"], ["VE","Venezuela"], ["SR","Suriname"], ["GY","Guyana"], ["AM","Armenia"], ["PA","Panama"],
  ["HN","Honduras"], ["GT","Guatemala"], ["NI","Nicaragua"], ["MD","Moldova"], ["TM","Turkmenistan"], ["BY","Belarus"],
  ["SV","El Salvador"], ["GE","Georgia"], ["TJ","Tajikistan"],
];

// Full country names (checked FIRST)
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

const TITLE_REGIONS: [RegExp, string][] = [
  [/EU\/NA/i,"EU/NA"],[/EMEA/i,"EMEA"],[/LATAM/i,"Latin America"],
  [/MENA/i,"Middle East"],[/SEA/i,"Southeast Asia"],[/ROW/i,"Global"],
  [/EUROPE/i,"Europe"],[/GLOBAL/i,"Global"],
  // Full country names FIRST
  ...COUNTRY_NAME_REGIONS.map(([name, region]) => [new RegExp(`\\b${name}\\b`, "i"), region] as [RegExp, string]),
  // Two-letter country codes
  ...TWO_LETTER_CODES.flatMap(([code, region]) => [
    [new RegExp(`\s\b${code}\b(?=\s+(PC|XBOX|PS|NINTENDO|STEAM|$))`, "i"), region] as [RegExp, string],
    [new RegExp(`\s\b${code}\b\s*$`, "i"), region] as [RegExp, string],
  ]),
  ...TITLE_CURRENCY_REGIONS.map(([code, region]) => [new RegExp(`\b${code}\b(?!\s*\d)`, "i"), region] as [RegExp, string]),
];


const TITLE_PLAT_SUFFIXES = [/\s+PC\s+STEAM\b/gi, /\s+PC\s+EPIC\s+GAMES\b/gi, /\s+PC\s+EPIC\b/gi, /\s+PC\s+GOG(?:\.COM)?\b/gi, /\s+EPIC\s+GAMES\b/gi, /\s+STEAM\b/gi, /\s+XBOX ONE\s*\/?\s*XBOX SERIES X\|S/gi, /\s+XBOX ONE\b/gi, /\s+XBOX SERIES X\|S\b/gi, /\s+XBOX SERIES\b/gi, /\s+PS4\s*\/?\s*PS5/gi, /\s+PS[45]\b/gi, /\s+NINTENDO SWITCH\b/gi, /\s+PC\s*$/gi];
const LC_WORDS = new Set(["of","the","at","in","on","for","and","or","to","a","an","by","with","from","as","but","nor","so","yet","vs"]);
const UC_WORDS = new Set(["DLC","RPG","VR","II","III","IV","VI","VII","VIII","IX","XI","XII","XIII","XIV","XV","XVI","XVII","XX","EA","FC","GTA","FIFA","NBA","NFL","MLB","NHL","WWE","TOTY","GOTY","HD","3D","2D","PUBG","MMO","MMORPG","FPS","RTS","JRPG","ARPG","REMAKE","GOG","PSN","UC","USD","EUR","GBP","CAD","AUD","CHF","SEK","NOK","DKK","PLN","CZK","HUF","RON","TRY","BRL","ARS","MXN","CLP","COP","PEN","JPY","KRW","CNY","INR","ZAR","SAR","AED","ILS","NZD","SGD","HKD","THB","MYR","PHP","IDR","VND","TWD","BGN","UAH","UYU","CRC","MVR"]);
const BRAND_CASING: Record<string, string> = { "PLAYSTATION": "PlayStation", "XBOX": "Xbox", "NINTENDO": "Nintendo", "ESHOP": "eShop", "BATTLENET": "Battle.net", "ITUNES": "iTunes", "ROBLOX": "Roblox", "V-BUCKS": "V-Bucks", "MINECRAFT": "Minecraft", "FORTNITE": "Fortnite" };

const COUNTRY_CODES_SET = new Set(["US","UK","GB","FR","DE","IT","ES","AT","BE","NL","PT","GR","IE","FI","LU","NO","SE","DK","PL","CZ","HU","RO","BG","HR","SI","SK","CY","CA","MX","BR","AU","JP","KR","CN","IN","SG","HK","RU","TR","ZA","SA","AE","KW","BH","OM","QA","LB","JO","IQ","EG","IL","NZ","TW","TH","MY","PH","ID","VN","CL","CO","PE","UA","UY","CR","EU","NA","AR","BD","BT","LK","NP","MV","PK","BZ","SD","TN","LY","MA","DZ","YE","EC","BO","PY","AZ","VE","SR","GY","AM","PA","HN","GT","NI","MD","TM","BY","SV","GE","TJ"]);

function smartTitle(text: string): string {
  const words = text.split(" "); let ac = false;
  return words.map((w, i) => {
    const u = w.toUpperCase(); const first = i === 0 || ac;
    if (w.endsWith(":")) ac = true; else ac = false;
    if (UC_WORDS.has(u)) return u;
    if (BRAND_CASING[u]) return BRAND_CASING[u];
    if (UC_WORDS.has(u.replace(":", ""))) return u.charAt(0).toUpperCase() + u.slice(1).toLowerCase();
    if (/^[IVXLCDM]+$/.test(u) && u.length <= 5) return u;
    if (/^\d/.test(w)) return w;
    if (!first && LC_WORDS.has(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}

function cleanTitle(name: string, platform: string, region: string): string {
  let t = name.toUpperCase();
  t = t.replace(/\bGIFT\s+CARD\b/gi, "CARD");
  t = t.replace(/\bGIT\s+CARD\b/gi, "CARD");
  for (const p of TITLE_JUNK) t = t.replace(p, "");
  let dr = "";
  for (const [p, r] of TITLE_REGIONS) { if (p.test(t)) { dr = r; t = t.replace(p, ""); break; } }
  for (const p of TITLE_PLAT_SUFFIXES) t = t.replace(p, "");
  t = t.replace(/\s+/g, " ").replace(/[\s\-·•,\/]+$/, "").replace(/^[\s\-·•,\/]+/, "").trim();
  // Strip trailing 2-letter country codes that duplicate the region suffix
  const trailingCodeMatch = t.match(/\s+([A-Z]{2})\s*$/);
  if (trailingCodeMatch && COUNTRY_CODES_SET.has(trailingCodeMatch[1])) {
    t = t.replace(/\s+[A-Z]{2}\s*$/, "");
  }
  // Swap "CUR 123" → "123 CUR"
  t = t.replace(/\b(BRL|EUR|USD|GBP|AUD|CAD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|ARS|MXN|CLP|COP|PEN|JPY|KRW|CNY|INR|ZAR|SAR|AED|ILS|NZD|SGD|HKD|THB|MYR|PHP|IDR|VND|TWD|UYU|CRC|UAH|BGN|MVR)\s+(\d+(?:[.,]\d+)?)\b/gi, "$2 $1");
  // Reorder "{amount} {currency} CARD" → "CARD {amount} {currency}"
  t = t.replace(/(\d+(?:[.,]\d+)?)\s+(BRL|EUR|USD|GBP|AUD|CAD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|ARS|MXN|CLP|COP|PEN|JPY|KRW|CNY|INR|ZAR|SAR|AED|ILS|NZD|SGD|HKD|THB|MYR|PHP|IDR|VND|TWD|UYU|CRC|UAH|BGN|MVR)\s+CARD\b/gi, "CARD $1 $2");
  t = smartTitle(t);
  const parts = [t];
  if (platform && !t.toLowerCase().includes(platform.toLowerCase())) parts.push(platform);
  const fr = dr || region || "";
  if (fr) parts.push(fr);
  return parts.join(" - ");
}

function detectExpirationDate(text: string): string | null {
  if (!text) return null;
  // Patterns with day (e.g. "October 15th, 2026")
  const dayPatterns = [
    /must be redeemed by\s+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
    /valid until\s+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
    /expires?\s+(?:on\s+)?([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
    /redeemed before\s+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
    /must be (?:activated|used) by\s+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
    /valid (?:through|till)\s+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
  ];
  for (const p of dayPatterns) {
    const m = text.match(p);
    if (m) {
      const cleaned = m[1].replace(/(st|nd|rd|th),?/gi, ',');
      const d = new Date(cleaned);
      if (!isNaN(d.getTime()) && d > new Date()) return d.toISOString();
    }
  }
  // Month-year only patterns (e.g. "Valid until Oct 2026", "expires Dec 2025")
  const monthYearPatterns = [
    /valid\s+(?:until|through|till)\s+([A-Za-z]+),?\s+(\d{4})/i,
    /expires?\s+(?:on\s+)?([A-Za-z]+),?\s+(\d{4})/i,
    /must be redeemed by\s+([A-Za-z]+),?\s+(\d{4})/i,
    /redeemed before\s+([A-Za-z]+),?\s+(\d{4})/i,
    /must be (?:activated|used) by\s+([A-Za-z]+),?\s+(\d{4})/i,
  ];
  for (const p of monthYearPatterns) {
    const m = text.match(p);
    if (m) {
      // "valid until April 2027" means expires end of March (the month BEFORE)
      const d = new Date(`${m[1]} 1, ${m[2]}`);
      if (!isNaN(d.getTime())) {
        // Set to last day of previous month (day 0 of the stated month)
        d.setDate(0);
        d.setHours(23, 59, 59);
        if (d > new Date()) return d.toISOString();
      }
    }
  }
  return null;
}

// Dynamic pricing using DB rules - fetched at runtime
const KINGUIN_MARKUP = 0.0735;

function applyKinguinMarkup(cost: number): number {
  return cost * (1 + KINGUIN_MARKUP);
}

function calculateSellPriceWithRules(
  cost: number,
  rules: { max_cost: number; margin_pct: number }[],
  settings: { fixed_fee: number; platform_pct: number }
): number {
  const adjustedCost = applyKinguinMarkup(cost);
  const sorted = [...rules].sort((a, b) => a.max_cost - b.max_cost);
  let margin = 0.04;
  for (const rule of sorted) {
    if (adjustedCost <= rule.max_cost) { margin = rule.margin_pct; break; }
  }
  const rawPrice = (adjustedCost + settings.fixed_fee) / (1 - settings.platform_pct - margin);
  return Math.ceil(rawPrice * 100) / 100;
}

// Fallback if DB rules can't be fetched
function calculateSellPrice(cost: number): number {
  return calculateSellPriceWithRules(cost, [
    { max_cost: 2, margin_pct: 0.10 },
    { max_cost: 50, margin_pct: 0.065 },
    { max_cost: 150, margin_pct: 0.055 },
    { max_cost: 99999, margin_pct: 0.04 },
  ], { fixed_fee: 0.50, platform_pct: 0.05 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KINGUIN_API_KEY = Deno.env.get("KINGUIN_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!KINGUIN_API_KEY) throw new Error("KINGUIN_API_KEY not configured");

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

    const body = await req.json();
    const { 
      query = "", maxPages = 5, skipParaphrase = false, 
      platform, tags, sortBy, sortType, updatedSince, updatedTo, genre,
      categoryOverride,  // optional category override (e.g. "in-game-items", "gift-cards", "media-streaming")
      kinguinProductId,  // optional: import a single product by Kinguin ID directly
      platformOverride,  // optional: force platform (e.g. "In-Game Items") — set from admin suggestion row
      storeOverride,     // optional: force sub-platform / store (e.g. "Fortnite")
    } = body;
    if (!query && !platform && !tags && !kinguinProductId) throw new Error("Query, platform, tags, or kinguinProductId required");

    // Fetch dynamic pricing rules from DB
    const [rulesRes, settingsRes] = await Promise.all([
      supabase.from("pricing_rules").select("max_cost, margin_pct").order("tier_order"),
      supabase.from("pricing_settings").select("fixed_fee, platform_pct").eq("id", 1).single(),
    ]);
    const pricingRules = rulesRes.data?.length ? rulesRes.data : null;
    const pricingSettings = settingsRes.data || null;
    
    const calcPrice = (cost: number) => {
      if (pricingRules && pricingSettings) {
        return calculateSellPriceWithRules(cost, pricingRules, pricingSettings);
      }
      return calculateSellPrice(cost);
    };

    const KINGUIN_API = "https://gateway.kinguin.net/esa/api/v1";
    const allProducts: any[] = [];

    const fetchProductsBySearch = async () => {
      const searchResults: any[] = [];
      for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams();
        if (query) params.set("name", query);
        params.set("page", String(page));
        params.set("limit", "50");
        if (platform) params.set("platform", platform);
        if (tags) params.set("tags", tags);
        if (sortBy) { params.set("sortBy", sortBy); params.set("sortType", sortType || "desc"); }
        else { params.set("sortBy", "updatedAt"); params.set("sortType", "desc"); }
        if (updatedSince) params.set("updatedSince", updatedSince);
        if (updatedTo) params.set("updatedTo", updatedTo);
        if (genre) params.set("genre", genre);

        const url = `${KINGUIN_API}/products?${params.toString()}`;
        const res = await fetch(url, {
          headers: { "X-Api-Key": KINGUIN_API_KEY.trim(), Accept: "application/json" },
        });
        if (!res.ok) break;
        const data = await res.json();
        if (!data.results?.length) break;
        searchResults.push(...data.results);
        if (data.results.length < 50) break;
      }
      return searchResults;
    };

    if (kinguinProductId) {
      const res = await fetch(`${KINGUIN_API}/products/${kinguinProductId}`, {
        headers: { "X-Api-Key": KINGUIN_API_KEY.trim(), Accept: "application/json" },
      });

      if (!res.ok) {
        const errorText = await res.text();
        // Suggestions store Kinguin's numeric `kinguinId`, while the product detail
        // endpoint often requires the hex `productId`. If direct fetch 404s, search
        // by the title and import the exact matching result instead of falsely
        // marking every numeric-id suggestion as unavailable.
        if (res.status === 404) {
          const searchedProducts = query ? await fetchProductsBySearch() : [];
          const requestedId = String(kinguinProductId);
          const exactMatch = searchedProducts.find((p) =>
            String(p.kinguinId || "") === requestedId ||
            String(p.productId || "") === requestedId ||
            (query && String(p.name || "").trim().toLowerCase() === String(query).trim().toLowerCase())
          );

          if (exactMatch) {
            allProducts.push(exactMatch);
          } else {
          await supabase
            .from("kinguin_product_suggestions")
            .update({ status: "unavailable", admin_note: "Product no longer available on Kinguin (404)", reviewed_at: new Date().toISOString() })
            .eq("kinguin_product_id", String(kinguinProductId));

          return new Response(
            JSON.stringify({
              added: 0,
              skipped: 1,
              blocked: 0,
              unavailable: true,
              message: `Product ${kinguinProductId} is no longer available on Kinguin and was marked as unavailable.`,
              results: [{ name: `Kinguin #${kinguinProductId}`, status: "unavailable: removed from Kinguin catalog" }],
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
          }
        } else {
          throw new Error(`Direct product fetch failed for ${kinguinProductId}: ${res.status} ${errorText}`);
        }
      } else {
        const product = await res.json();
        if (!product?.productId && !product?.kinguinId) {
          throw new Error(`Product ${kinguinProductId} was not returned by Kinguin`);
        }

        allProducts.push(product);
      }
    } else {
      // Fetch multiple pages via search
      allProducts.push(...await fetchProductsBySearch());
    }

    console.log(`Found ${allProducts.length} products for query "${query}" platform="${platform || ''}" tags="${tags || ''}" categoryOverride="${categoryOverride || ''}"`);

    let added = 0;
    let skipped = 0;
    let blocked = 0;
    const results: { name: string; status: string; sellPrice?: number; allowed_product_id?: string }[] = [];

    for (const product of allProducts) {
      const upperName = product.name?.toUpperCase() || "";
      
      // SAFETY: Block prohibited product types (accounts, etc.)
      if (BLOCKED_KEYWORDS.some(kw => upperName.includes(kw))) {
        blocked++;
        results.push({ name: product.name, status: "blocked: prohibited product type" });
        continue;
      }
      
      // Also check description for "account" selling
      const upperDesc = (product.description || "").toUpperCase();
      if (upperDesc.includes("SELLING ACCOUNT") || upperDesc.includes("ACCOUNT ACCESS") || upperDesc.includes("LOGIN CREDENTIALS")) {
        blocked++;
        results.push({ name: product.name, status: "blocked: account product detected in description" });
        continue;
      }

      const detected = detectPlatformAndStore(product.platform || "", product.name, categoryOverride);
      // Admin explicit override from the suggestions UI takes highest priority.
      if (platformOverride) detected.platform = platformOverride;
      if (storeOverride) detected.store = storeOverride;
      const region = detectRegion(product.name);
      const name = cleanTitle(product.name, detected.platform, region);

      // Auto-detect tab_category from title / release date
      const upperForCat = (product.name || "").toUpperCase();
      const releaseTs = product.releaseDate ? new Date(product.releaseDate).getTime() : NaN;
      const isFutureRelease = !Number.isNaN(releaseTs) && releaseTs > Date.now();
      let tabCategory: string | null = null;
      if (/\bPRE[\s-]?ORDER\b/i.test(product.name || "") || isFutureRelease) {
        tabCategory = "pre-orders";
      } else if (/\bDLC\b|\bADD[- ]?ON\b|\bCONTENT\s+PACK\b|\bSEASON\s+PASS\b|\bEXPANSION\b/.test(upperForCat)) {
        tabCategory = "dlc";
      } else if (detected.store === "Gift Cards") {
        tabCategory = "gift-cards";
      } else if (detected.store === "In-Game Items") {
        tabCategory = "in-game-items";
      } else if (detected.store === "Top Ups") {
        tabCategory = "topups";
      } else if (detected.store === "Subscriptions") {
        tabCategory = "subscriptions";
      } else if (detected.category && !["games", "software", "office", "windows"].includes(detected.category)) {
        tabCategory = detected.category;
      }

      const price = typeof product.price === "number" ? product.price : (product.price?.lowestOffer ?? 0);
      const sellPrice = calcPrice(price);
      const rawImageUrl = product.images?.cover?.url || product.images?.cover?.thumbnail || null;
      const imageUrl = standardizeImageUrl(rawImageUrl);
      const screenshots: string[] = (product.images?.screenshots || [])
        .map((s: any) => standardizeImageUrl(s.url || s.thumbnail))
        .filter(Boolean) as string[];
      const videoUrl = Array.isArray(product.videos) && product.videos.length > 0
        ? (product.videos[0].url || product.videos[0].video_id ? `https://www.youtube.com/watch?v=${product.videos[0].video_id}` : null)
        : null;
      const productId = product.productId || product.kinguinId?.toString() || "";

      // Paraphrase description if available, or use original
      let description: string | null = product.description || null;
      if (!skipParaphrase && product.description && GEMINI_API_KEY) {
        await new Promise((r) => setTimeout(r, 2000));
        
        let aiSuccess = false;
        for (let aiAttempt = 0; aiAttempt < 3 && !aiSuccess; aiAttempt++) {
          if (aiAttempt > 0) {
            await new Promise((r) => setTimeout(r, Math.pow(2, aiAttempt + 1) * 1500));
          }
          try {
            const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "gemini-3.5-flash-lite",
                messages: [
                  { role: "system", content: `You are a professional game store copywriter. Rewrite the following product description in your own words. Rules: Keep the same information and key features, use different sentence structures and vocabulary, make it sound professional and appealing, do NOT mention "Kinguin" or any marketplace name, keep it concise (max 3-4 paragraphs), write in English, output the description directly without prefixes. CRITICAL: If this is a bundle/edition/pack that includes specific items, DLCs, expansions, skins, maps, or any listed contents — you MUST preserve and list ALL included items exactly. Never omit, summarize, or generalize the bundle contents.` },
                  { role: "user", content: `Product: "${name}"\n\nOriginal:\n${product.description}` },
                ],
                temperature: 0.8,
                max_tokens: 800,
              }),
            });
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              description = aiData.choices?.[0]?.message?.content?.trim() || null;
              aiSuccess = true;
            } else if (aiRes.status === 429) {
              console.warn(`AI rate limited for "${name}", attempt ${aiAttempt + 1}`);
            } else {
              console.error(`AI error ${aiRes.status} for "${name}"`);
              break;
            }
          } catch (e) {
            console.error("Paraphrase failed for", name, e);
          }
        }
        if (!aiSuccess && product.description) {
          description = product.description;
        }
      }

      // Detect expiration from description or name
      const expirationDate = detectExpirationDate(product.description || "") || detectExpirationDate(product.name || "");

      // Extract metadata
      const developers = Array.isArray(product.developers) ? product.developers : [];
      const publishers = Array.isArray(product.publishers) ? product.publishers : [];
      const genres = Array.isArray(product.genres) ? product.genres : [];
      const regionalLimitations = product.regionalLimitations || null;
      const platformDetails = product.platform || null;
      const languages = Array.isArray(product.languages) ? product.languages : [];
      const releaseDate = product.releaseDate || null;

      // Parse system requirements
      let systemRequirements: Record<string, unknown> | null = null;
      if (product.systemRequirements && Array.isArray(product.systemRequirements)) {
        const minReq = product.systemRequirements.find((r: any) => r.system === "pc" && r.requirement === "minimum");
        const recReq = product.systemRequirements.find((r: any) => r.system === "pc" && r.requirement === "recommended");
        if (minReq || recReq) {
          systemRequirements = {};
          if (minReq) systemRequirements.minimum = minReq;
          if (recReq) systemRequirements.recommended = recReq;
        }
      }

      // Check for existing product
      const titleForDb = name; // Use proper-cased title
      const titleUpper = name.toUpperCase();
      const titleWithoutGlobal = titleUpper.replace(/\s*-\s*GLOBAL\s*$/i, "").trim();
      const titlesToCheck = [titleForDb, titleUpper];
      if (titleWithoutGlobal !== titleUpper) titlesToCheck.push(titleWithoutGlobal);
      else titlesToCheck.push(`${titleUpper} - GLOBAL`);

      const { data: existingProducts } = await supabase
        .from("allowed_products")
        .select("id, title")
        .or(titlesToCheck.map(t => `title.ilike.${t}`).join(","));

      if (existingProducts && existingProducts.length > 0) {
        const existingProduct = existingProducts[0];
        const { data: existingLink } = await supabase
          .from("kinguin_products")
          .select("id")
          .eq("allowed_product_id", existingProduct.id)
          .maybeSingle();

        if (!existingLink) {
          await supabase.from("kinguin_products").insert({
            allowed_product_id: existingProduct.id,
            kinguin_product_id: productId,
            kinguin_price: price,
            sell_price: sellPrice,
            is_active: true,
            kinguin_stock: product.qty ?? product.totalQty ?? 0,
            last_stock_check: new Date().toISOString(),
          });
          // Update metadata on existing product if missing
          const metadataUpdate: Record<string, unknown> = {};
          if (releaseDate) metadataUpdate.release_date = releaseDate;
          if (expirationDate) metadataUpdate.expiration_date = expirationDate;
          if (description && !skipParaphrase) metadataUpdate.description = description;
          if (imageUrl) metadataUpdate.image_url = imageUrl;
          if (screenshots.length > 0) metadataUpdate.screenshots = screenshots;
          if (videoUrl) metadataUpdate.video_url = videoUrl;
          if (developers.length > 0) metadataUpdate.developers = developers;
          if (publishers.length > 0) metadataUpdate.publishers = publishers;
          if (regionalLimitations) metadataUpdate.regional_limitations = regionalLimitations;
          if (languages.length > 0) metadataUpdate.languages = languages;
          if (genres.length > 0) metadataUpdate.badges = genres;
          if (systemRequirements) metadataUpdate.system_requirements = systemRequirements;
          if (tabCategory) metadataUpdate.tab_category = tabCategory;
          if (Object.keys(metadataUpdate).length > 0) {
            await supabase.from("allowed_products").update(metadataUpdate).eq("id", existingProduct.id);
          }
          results.push({ name, status: "linked to existing", sellPrice, allowed_product_id: existingProduct.id });
          added++;
        } else {
          skipped++;
          results.push({ name, status: "duplicate", allowed_product_id: existingProduct.id });
        }
        continue;
      }

      // Insert into allowed_products
      const { data: allowedData, error: allowedError } = await supabase
        .from("allowed_products")
        .insert({
          title: titleForDb,
          original_title: product.name,
          product_type: (() => {
            // Gift Cards / In-Game Items / Gaming Accessories / Software family
            // are differentiated by Platform/Sub-Platform, not a Game/DLC/Edition
            // "Type" — never default these to "Game".
            const NO_TYPE_STORES = new Set(["Gift Cards", "In-Game Items", "Gaming Accessories", "Software", "Windows", "Office", "Antivirus & Utilities"]);
            if (NO_TYPE_STORES.has(detected.store)) return null;
            const src = (product.name || "").toUpperCase();
            if (/\bPRE[\s-]?ORDER\s+BONUS\b/.test(src)) return "PRE ORDER BONUS";
            if (/\b(DELUXE|GOLD\s+EDITION|ULTIMATE|PREMIUM|COMPLETE|GOTY|DEFINITIVE|COLLECTOR'?S|LEGENDARY|ANNIVERSARY|DIGITAL\s+DELUXE|SUPER\s+DELUXE|STANDARD\s+EDITION)\b/.test(src)) return "Edition";
            if (/\bSEASON\s+PASS\b/.test(src)) return "Season Pass";
            if (/\bEXPANSION\b/.test(src)) return "Expansion";
            if (/\bDLC\b|\bADD[- ]?ON\b|\bCONTENT\s+PACK\b/.test(src)) return "DLC";
            if (/\b(SKINS?|OUTFIT|COSMETIC|CHARACTER\s+PACK)\b/.test(src)) return "Skin";
            if (/\b(COINS?|GEMS?|V-?BUCKS|ROBUX|CREDITS?|POINTS?|GOLD|CASH|TOKENS?)\b/.test(src)) return "Currency";
            if (/\bBUNDLE\b/.test(src)) return "Bundle";
            return "Game";
          })(),
          platform: detected.platform,
          store: detected.store,
          tab_category: tabCategory,
          image_url: imageUrl,
          screenshots,
          video_url: videoUrl,
          description,
          region,
          expiration_date: expirationDate,
          developers,
          publishers,
          regional_limitations: regionalLimitations,
          platform_details: platformDetails,
          languages,
          release_date: releaseDate,
          ...(genres.length > 0 ? { badges: genres } : {}),
          ...(systemRequirements ? { system_requirements: systemRequirements } : {}),
        })
        .select()
        .single();

      if (allowedError) {
        if (allowedError.code === "23505") {
          // A row with this title already exists (case/whitespace variation the
          // earlier ilike lookup missed). Look it up and link the Kinguin offer
          // to it instead of failing the import.
          const { data: dupProduct } = await supabase
            .from("allowed_products")
            .select("id")
            .ilike("title", titleForDb)
            .maybeSingle();
          if (dupProduct?.id) {
            const { data: existingLink } = await supabase
              .from("kinguin_products")
              .select("id")
              .eq("allowed_product_id", dupProduct.id)
              .maybeSingle();
            if (!existingLink) {
              await supabase.from("kinguin_products").insert({
                allowed_product_id: dupProduct.id,
                kinguin_product_id: productId,
                kinguin_price: price,
                sell_price: sellPrice,
                is_active: true,
                kinguin_stock: product.qty ?? product.totalQty ?? 0,
                last_stock_check: new Date().toISOString(),
              });
              added++;
              results.push({ name, status: "linked to existing", sellPrice, allowed_product_id: dupProduct.id });
            } else {
              skipped++;
              results.push({ name, status: "duplicate", allowed_product_id: dupProduct.id });
            }
          } else {
            skipped++;
            results.push({ name, status: `duplicate: ${allowedError.message}` });
          }
        } else {
          results.push({ name, status: `error: ${allowedError.message}` });
        }
        continue;
      }

      // Link to kinguin_products
      const { error: linkError } = await supabase.from("kinguin_products").insert({
        allowed_product_id: allowedData.id,
        kinguin_product_id: productId,
        kinguin_price: price,
        sell_price: sellPrice,
        is_active: true,
        kinguin_stock: product.qty ?? product.totalQty ?? 0,
        last_stock_check: new Date().toISOString(),
      });

      if (linkError) {
        results.push({ name, status: `linked-error: ${linkError.message}`, allowed_product_id: allowedData.id });
      } else {
        added++;
        results.push({ name, status: "added", sellPrice, allowed_product_id: allowedData.id });

        // Auto-assign Roblox products to the "roblox" collection
        if (product.name?.toUpperCase().includes("ROBLOX") || product.name?.toUpperCase().includes("ROBUX")) {
          const { data: robloxCol } = await supabase
            .from("collections")
            .select("id")
            .eq("slug", "roblox")
            .maybeSingle();
          if (robloxCol) {
            await supabase.from("collection_products").upsert({
              collection_id: robloxCol.id,
              allowed_product_id: allowedData.id,
              display_order: 0,
            }, { onConflict: "collection_id,allowed_product_id" });
          }
        }
      }
    }

    return new Response(JSON.stringify({ total: allProducts.length, added, skipped, blocked, results }), {
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
