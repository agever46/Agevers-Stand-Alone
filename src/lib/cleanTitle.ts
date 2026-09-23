// Title cleaning utility - shared between frontend and edge functions
// Cleans Kinguin-style product titles into clean format: "Product Name - Platform - Region"

const JUNK_PATTERNS = [
  /\s*\(?CD KEY\)?/gi,
  /\s*\(?STEAM KEY\)?/gi,
  /\s*\(VALID UNTIL[^)]*\)/gi,
  /\s*\(WITHOUT[^)]*\)/gi,
  /\s*\bKINGUIN\b\s*/gi,
  /\s*\bCN\/TW\s+LANGUAGES\s+ONLY\b/gi,
  /\s*\bEU\/UK\b/gi,
  /\s*\bASIA\s+V2\b/gi,
  /\s+PC\s+UBISOFT\s+CONNECT\b/gi,
  /\s+PC\s+EA\s+APP\b/gi,
];

// 3-letter currency codes → region
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

// Full country names → region (checked FIRST, before 2-letter codes)
const COUNTRY_NAME_REGIONS: [string, string][] = [
  ["United States", "United States"], ["United Kingdom", "United Kingdom"],
  ["North America", "North America"], ["South Korea", "South Korea"],
  ["New Zealand", "New Zealand"], ["Hong Kong", "Hong Kong"],
  ["South Africa", "South Africa"], ["Saudi Arabia", "Saudi Arabia"],
  ["Czech Republic", "Czech Republic"], ["Costa Rica", "Costa Rica"],
  ["Sri Lanka", "Sri Lanka"], ["El Salvador", "El Salvador"],
  ["Luxembourg", "Luxembourg"], ["Bangladesh", "Bangladesh"],
  ["Switzerland", "Switzerland"], ["Netherlands", "Netherlands"],
  ["Philippines", "Philippines"], ["Afghanistan", "Afghanistan"],
  ["Argentina", "Argentina"], ["Australia", "Australia"],
  ["Austria", "Austria"], ["Azerbaijan", "Azerbaijan"],
  ["Bahrain", "Bahrain"], ["Belarus", "Belarus"],
  ["Belgium", "Belgium"], ["Belize", "Belize"],
  ["Bhutan", "Bhutan"], ["Bolivia", "Bolivia"],
  ["Brazil", "Brazil"], ["Bulgaria", "Bulgaria"],
  ["Cambodia", "Cambodia"], ["Canada", "Canada"],
  ["Chile", "Chile"], ["China", "China"],
  ["Colombia", "Colombia"], ["Croatia", "Croatia"],
  ["Denmark", "Denmark"], ["Ecuador", "Ecuador"],
  ["Egypt", "Egypt"], ["Estonia", "Estonia"],
  ["Finland", "Finland"], ["France", "France"],
  ["Georgia", "Georgia"], ["Germany", "Germany"],
  ["Greece", "Greece"], ["Guatemala", "Guatemala"],
  ["Guyana", "Guyana"], ["Honduras", "Honduras"],
  ["Hungary", "Hungary"], ["Iceland", "Iceland"],
  ["India", "India"], ["Indonesia", "Indonesia"],
  ["Iraq", "Iraq"], ["Ireland", "Ireland"],
  ["Israel", "Israel"], ["Italy", "Italy"],
  ["Japan", "Japan"], ["Jordan", "Jordan"],
  ["Kuwait", "Kuwait"], ["Latvia", "Latvia"],
  ["Lebanon", "Lebanon"], ["Libya", "Libya"],
  ["Lithuania", "Lithuania"], ["Malaysia", "Malaysia"],
  ["Maldives", "Maldives"], ["Mexico", "Mexico"],
  ["Moldova", "Moldova"], ["Morocco", "Morocco"],
  ["Nepal", "Nepal"], ["Nicaragua", "Nicaragua"],
  ["Norway", "Norway"], ["Oman", "Oman"],
  ["Pakistan", "Pakistan"], ["Panama", "Panama"],
  ["Paraguay", "Paraguay"], ["Peru", "Peru"],
  ["Poland", "Poland"], ["Portugal", "Portugal"],
  ["Qatar", "Qatar"], ["Romania", "Romania"],
  ["Russia", "Russia"], ["Serbia", "Serbia"],
  ["Singapore", "Singapore"], ["Slovakia", "Slovakia"],
  ["Slovenia", "Slovenia"], ["Spain", "Spain"],
  ["Sudan", "Sudan"], ["Suriname", "Suriname"],
  ["Sweden", "Sweden"], ["Taiwan", "Taiwan"],
  ["Tajikistan", "Tajikistan"], ["Thailand", "Thailand"],
  ["Tunisia", "Tunisia"], ["Turkey", "Turkey"],
  ["Turkmenistan", "Turkmenistan"], ["Ukraine", "Ukraine"],
  ["Uruguay", "Uruguay"], ["Venezuela", "Venezuela"],
  ["Vietnam", "Vietnam"], ["Yemen", "Yemen"],
  ["Algeria", "Algeria"], ["Armenia", "Armenia"],
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
  // Full country names FIRST (so "PlayStation Network Card €10 - Luxembourg" → Luxembourg)
  ...COUNTRY_NAME_REGIONS.map(([name, region]) => [
    new RegExp(`\\b${name}\\b`, "i"), region
  ] as [RegExp, string]),
  // Two-letter country codes (so "10 USD BD" → Bangladesh, not United States)
  ...[
    ["NA", "North America"], ["EU", "Europe"], ["US", "United States"], ["UK", "United Kingdom"],
    ["GB", "United Kingdom"], ["FR", "France"], ["DE", "Germany"],
    ["IT", "Italy"], ["ES", "Spain"], ["PL", "Poland"], ["CZ", "Czech Republic"],
    ["RU", "Russia"], ["TR", "Turkey"], ["AR", "Argentina"], ["BR", "Brazil"],
    ["BG", "Bulgaria"], ["AU", "Australia"], ["JP", "Japan"], ["KR", "South Korea"],
    ["CN", "China"], ["IN", "India"], ["CA", "Canada"], ["MX", "Mexico"],
    ["NZ", "New Zealand"], ["HK", "Hong Kong"], ["DK", "Denmark"],
    ["FI", "Finland"], ["NO", "Norway"], ["SE", "Sweden"], ["CH", "Switzerland"],
    ["BE", "Belgium"], ["NL", "Netherlands"], ["LU", "Luxembourg"], ["ZA", "South Africa"],
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
    ["NP", "Nepal"], ["MV", "Maldives"],
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
  /\s+PC\s+EPIC\s+GAMES\b/gi,
  /\s+PC\s+EPIC\b/gi,
  /\s+PC\s+GOG(?:\.COM)?\b/gi,
  /\s+EPIC\s+GAMES\b/gi,
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

const LOWERCASE_WORDS = new Set(["of", "the", "at", "in", "on", "for", "and", "or", "to", "a", "an", "by", "with", "from", "as", "but", "nor", "so", "yet", "vs"]);
const UPPERCASE_WORDS = new Set(["DLC", "RPG", "VR", "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XX", "EA", "FC", "GTA", "FIFA", "NBA", "NFL", "MLB", "NHL", "WWE", "TOTY", "GOTY", "HD", "3D", "2D", "PUBG", "MMO", "MMORPG", "FPS", "RTS", "JRPG", "ARPG", "REMAKE", "GOG", "PSN", "UC", "USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "TRY", "BRL", "ARS", "MXN", "CLP", "COP", "PEN", "JPY", "KRW", "CNY", "INR", "ZAR", "SAR", "AED", "ILS", "NZD", "SGD", "HKD", "THB", "MYR", "PHP", "IDR", "VND", "TWD", "BGN", "UAH", "UYU", "CRC", "MVR"]);
const BRAND_CASING: Record<string, string> = { "PLAYSTATION": "PlayStation", "XBOX": "Xbox", "NINTENDO": "Nintendo", "ESHOP": "eShop", "BATTLENET": "Battle.net", "ITUNES": "iTunes", "ROBLOX": "Roblox", "V-BUCKS": "V-Bucks", "MINECRAFT": "Minecraft", "FORTNITE": "Fortnite" };

function smartTitleCase(text: string): string {
  const words = text.split(" ");
  let afterColon = false;
  
  return words.map((word, idx) => {
    const upper = word.toUpperCase();
    const isFirstOrAfterColon = idx === 0 || afterColon;
    
    if (word.endsWith(":")) afterColon = true;
    else afterColon = false;
    
    if (UPPERCASE_WORDS.has(upper)) return upper;
    if (BRAND_CASING[upper]) return BRAND_CASING[upper];
    if (UPPERCASE_WORDS.has(upper.replace(":", ""))) return upper.charAt(0).toUpperCase() + upper.slice(1).toLowerCase();
    if (/^[IVXLCDM]+$/.test(upper) && upper.length <= 5) return upper;
    if (/^\d/.test(word)) return word;
    if (!isFirstOrAfterColon && LOWERCASE_WORDS.has(word.toLowerCase())) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
}

export function cleanTitle(originalTitle: string, platform: string, region: string = "Global", description: string = ""): string {
  let title = originalTitle.trim();
  
  // Strip Kinguin-style hex region/locale tags like [0b0a], [040c]
  title = title.replace(/\s*\[[0-9a-fA-F]{3,4}\]\s*/g, " ").trim();
  // Strip leading bracketed labels like "[Gold Edition]" that some Kinguin
  // titles carry as a prefix duplicating the actual edition keyword.
  title = title.replace(/^\s*\[[^\]]+\]\s*/, "").trim();
  // Strip stray leading punctuation (":", "-") that sometimes appears at the start
  title = title.replace(/^\s*[:\-–—]+\s*/, "").trim();

  // Detect Pre-order Bonus DLC items so we can prefix them clearly (prevents bonus DLCs from appearing as base games)
  // Check both title AND description — Kinguin sometimes labels bonus DLC products with a base-game title
  const isPreorderBonus =
    /pre-?order\s+bonus|preorder\s+bonus/i.test(title) ||
    /pre-?order\s+bonus\s+dlc|this\s+pre-?order\s+bonus/i.test(description);
  
  // Strip existing clean format suffix if re-cleaning
  const alreadyCleanedPattern = new RegExp(`\\s*-\\s*${platform.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s*-\\s*.+)?$`, "i");
  title = title.replace(alreadyCleanedPattern, "");
  
  title = title.toUpperCase();
  
  // Strip existing PRE-ORDER BONUS prefix and inline noise to avoid duplication
  title = title.replace(/^PRE-ORDER BONUS:\s*/i, "");
  title = title.replace(/\s*[-+]?\s*PRE-?ORDER\s+BONUS(\s+DLC)?(\s+\d+)?(\s+PRE-?ORDER)?\s*/gi, " ");

  // Strip plain "PRE-ORDER:" prefix and any standalone "Pre-order" / "Preorder"
  // token elsewhere in the title (avoids duplication like
  // "PRE-ORDER: ... Pre-order - PC - Global"). Only runs when this is NOT a
  // pre-order bonus product (those keep the BONUS: prefix added below).
  if (!isPreorderBonus) {
    title = title.replace(/^\s*PRE[\s-]?ORDER\s*[:\-–—]?\s*/i, "");
    title = title.replace(/\s*[-–—:+]?\s*\bPRE[\s-]?ORDER\b\s*/gi, " ");
  }
  
  // Normalize "GIFT CARD" → "CARD" for consistent formatting
  title = title.replace(/\bGIFT\s+CARD\b/gi, "CARD");
  // Normalize "GIT CARD" (typo) → "CARD"
  title = title.replace(/\bGIT\s+CARD\b/gi, "CARD");
  
  for (const pattern of JUNK_PATTERNS) {
    title = title.replace(pattern, "");
  }
  
  // Strip "- Other -" or "- Other" platform/region suffixes from Kinguin titles
  title = title.replace(/\s*-\s*OTHER\s*-\s*/gi, " - ").replace(/\s*-\s*OTHER\s*$/gi, "").trim();
  
  let detectedRegion = "";
  for (const [pattern, regionName] of REGION_EXTRACTIONS) {
    if (pattern.test(title)) {
      detectedRegion = regionName;
      title = title.replace(pattern, "");
      break;
    }
  }
  
  for (const pattern of PLATFORM_SUFFIXES) {
    title = title.replace(pattern, "");
  }
  
  title = title.replace(/\s+/g, " ").replace(/[\s\-·•,\/]+$/, "").replace(/^[\s\-·•,\/]+/, "").trim();
  
  // Strip trailing 2-letter country codes that duplicate the region suffix
  // e.g., "AIRBNB $100 GIFT CARD US" → "AIRBNB $100 GIFT CARD" (region already captured)
  const COUNTRY_CODES = new Set(["US","UK","GB","FR","DE","IT","ES","AT","BE","NL","LU","PT","GR","IE","FI","NO","SE","DK","PL","CZ","HU","RO","BG","HR","SI","SK","CY","CA","MX","BR","AU","JP","KR","CN","IN","SG","HK","RU","TR","ZA","SA","AE","KW","BH","OM","QA","LB","JO","IQ","EG","IL","NZ","TW","TH","MY","PH","ID","VN","CL","CO","PE","UA","UY","CR","EU","NA","AR","BD","BT","LK","NP","MV","PK","BZ","SD","TN","LY","MA","DZ","YE","EC","BO","PY","AZ","VE","SR","GY","AM","PA","HN","GT","NI","MD","TM","BY","SV","GE","TJ"]);
  const trailingCodeMatch = title.match(/\s+([A-Z]{2})\s*$/);
  if (trailingCodeMatch && COUNTRY_CODES.has(trailingCodeMatch[1])) {
    title = title.replace(/\s+[A-Z]{2}\s*$/, "");
  }
  
  // Swap "CUR 123" → "123 CUR" (e.g., "BRL 45" → "45 BRL", "EUR 50" → "50 EUR")
title = title.replace(/\b(BRL|EUR|USD|GBP|AUD|CAD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|ARS|MXN|CLP|COP|PEN|JPY|KRW|CNY|INR|ZAR|SAR|AED|ILS|NZD|SGD|HKD|THB|MYR|PHP|IDR|VND|TWD|MVR)\s+(\d+(?:[.,]\d+)?)\b/gi, "$2 $1");
  // Reorder "{amount} {currency} CARD" → "CARD {amount} {currency}"
  title = title.replace(/(\d+(?:[.,]\d+)?)\s+(BRL|EUR|USD|GBP|AUD|CAD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|ARS|MXN|CLP|COP|PEN|JPY|KRW|CNY|INR|ZAR|SAR|AED|ILS|NZD|SGD|HKD|THB|MYR|PHP|IDR|VND|TWD|MVR)\s+CARD\b/gi, "CARD $1 $2");
  title = smartTitleCase(title);
  
  const parts = [isPreorderBonus ? `PRE-ORDER BONUS: ${title}` : title];
  // Only add platform suffix if the title doesn't already contain the platform name
  if (platform && !title.toLowerCase().includes(platform.toLowerCase())) {
    parts.push(platform);
  }
  const finalRegion = detectedRegion || region || "";
  if (finalRegion) parts.push(finalRegion);
  
  return parts.join(" - ");
}
