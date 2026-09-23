/**
 * Auto-classify a product into game item types based on its title.
 * Used by AdminGameGroups when suggesting items to add to a group.
 */
export type GameItemType = "base" | "dlc" | "skin" | "currency" | "edition";

export const classifyGameItem = (title: string): GameItemType => {
  const upper = title.toUpperCase();

  // Currency: coins, gems, v-bucks, robux, credits, points, gold, cash
  // Bare singular forms (POINT, GEM, COIN, CREDIT, TOKEN) are AMBIGUOUS — they appear
  // in many game titles (e.g. "Rogue Point", "Cosmos Point", "Gem and Tarot"). Only
  // classify as Currency when plural OR with explicit numeric / pack / bundle context.
  if (
    /\b(COINS|GEMS|CREDITS|POINTS|TOKENS|MINUTES|V-?BUCKS|ROBUX)\b/.test(upper) ||
    /\b\d[\d,.]*\s*(COIN|GEM|CREDIT|POINT|TOKEN|GOLD|CASH)S?\b/.test(upper) ||
    /\b(GOLD|CASH|COIN|GEM|CREDIT|POINT|TOKEN)\s+(COINS?|PACK|BUNDLE|TOKENS?|CREDITS?|POINTS?)\b/.test(upper)
  ) {
    return "currency";
  }
  // Skin
  if (/\b(SKINS?|OUTFIT|COSMETIC|CHARACTER PACK)\b/.test(upper)) {
    return "skin";
  }
  // DLC indicators
  // For Steam Gift Cards/Wallet top-ups, we explicitly check for keywords to avoid "Game" misclassification
  if (/\b(DLC|SEASON PASS|EXPANSION|CONTENT PACK|ADD-?ON|PACK)\b/.test(upper)) {
    return "dlc";
  }
  // Editions (Deluxe / Gold / Ultimate / Premium / Complete / GOTY / Definitive)
  if (/\b(DELUXE|GOLD EDITION|ULTIMATE|PREMIUM|COMPLETE|GOTY|DEFINITIVE|COLLECTOR'?S|LEGENDARY|ANNIVERSARY|STANDARD EDITION|DIGITAL DELUXE|KIT)\b/.test(upper)) {
    return "edition";
  }
  return "base";
};

export const isPreOrderBonusProduct = (title: string, description: string = "") => {
  const combined = `${title} ${description}`.toUpperCase();

  return /\bPRE[ -]?ORDER\s+BONUS\b/.test(combined);
};

/**
 * Detects products that are regular pre-orders (NOT bonus add-ons and NOT
 * "game + bonus" packs). These are full base games being offered for early
 * purchase before release date.
 */
export const isPreOrderProduct = (
  title: string,
  originalTitle: string = "",
  description: string = "",
) => {
  const src = `${originalTitle || ""} ${title}`;
  // Skip if it's a bonus or game+bonus product (handled separately)
  if (isPreOrderBonusProduct(src, description)) return false;
  if (isGamePlusBonusProduct(src, description)) return false;
  // Match "PRE-ORDER:" prefix, "- Pre-order", or standalone "Pre-order" token.
  return /\bPRE[\s-]?ORDER\b/i.test(src);
};

/**
 * Detects products that bundle the full base game together with bonus
 * content (e.g. titles like "Game Name + Pre-Order Bonus"). These are
 * standalone playable products, NOT add-ons.
 */
export const isGamePlusBonusProduct = (title: string, description: string = "") => {
  // Title patterns: "Game + Bonus", "Game + Pre-Order Bonus"
  if (/\+\s*(pre[\s-]?order\s+)?bonus\b/i.test(title)) return true;
  // Description explicitly states the base game is included alongside a bonus
  const desc = description || "";
  // Match many phrasings that imply the base game ships with the product:
  // "Includes: Base Game", "includes the base game", "getting the base game",
  // "you also get the base game", "base game included", "full game included", etc.
  const mentionsBaseIncluded =
    /\b(includes?|including|contains?|comes with|get(ting)?|receive|securing)\b[^.]{0,80}\bbase\s+game\b/i.test(desc)
    || /\bbase\s+game\b[^.]{0,40}\b(included|inclus)\b/i.test(desc)
    || /\bfull\s+game\s+included\b/i.test(desc)
    || /\bnot\s+just\s+(getting|the)\b[^.]{0,40}\bbase\s+game\b/i.test(desc);
  const mentionsBonus = /\b(pre[\s-]?order\s+)?bonus\b/i.test(desc) || /\bbonus\b/i.test(title);
  return mentionsBaseIncluded && mentionsBonus;
};

export const getDisplayProductTitle = (
  title: string,
  description: string = "",
  originalTitle?: string | null,
) => {
  if (!title) return title;

  // Strip leftover leading punctuation (e.g. ": Game Name" after PRE-ORDER BONUS prefix removal)
  let cleanedTitle = title
    .replace(/^\s*PRE[\s-]?ORDER\s+BONUS\s*[:\-–—]?\s*/i, "")
    .replace(/^[\s:\-–—]+/, "")
    .trim();

  if (isGamePlusBonusProduct(title, description)) {
    return /\+\s*(pre[\s-]?order\s+)?bonus\b/i.test(cleanedTitle)
      ? cleanedTitle
      : `${cleanedTitle} + Bonus`;
  }

  // Detect pre-order bonus from the original supplier title (keywords may have been stripped from cleaned title)
  const sourceForDetection = `${originalTitle || ""} ${title} ${description}`;
  if (/\bPRE[\s-]?ORDER\s+BONUS\b/i.test(sourceForDetection)) {
    // Avoid duplicating if cleaned title already mentions it
    if (/pre[\s-]?order\s+bonus/i.test(cleanedTitle)) return cleanedTitle;
    return `Pre-Order Bonus: ${cleanedTitle}`;
  }

  // Return cleaned (no leading colon) version
  return cleanedTitle || title;
};

// Stores/categories differentiated by Platform + Sub-Platform rather than a
// Game/DLC/Edition "Type" — older import/backfill logic defaulted product_type
// to "Game" on these rows even though it never applied.
const NO_TYPE_STORES = new Set([
  "gift cards", "in-game items", "gaming accessories",
  "software", "windows", "office", "antivirus & utilities",
]);
const NO_TYPE_CATEGORIES = new Set([
  "gift-cards", "in-game-items", "gaming-accessories", "software",
]);

export const isNoTypeProduct = (p: { store?: string | null; category?: string | null }): boolean => {
  const store = (p.store || "").trim().toLowerCase();
  const category = (p.category || "").trim().toLowerCase();
  return NO_TYPE_STORES.has(store) || NO_TYPE_CATEGORIES.has(category);
};

export const getProductTypeLabel = ({
  title,
  originalTitle,
  description,
  category,
  store,
  productType,
}: {
  title: string;
  originalTitle?: string | null;
  description?: string | null;
  category?: string | null;
  store?: string | null;
  productType?: string | null;
}): string | null => {
  // Gift Cards / In-Game Items / Gaming Accessories / Software (+ subpages) are
  // differentiated by Platform/Sub-Platform — a Game/DLC/Edition "Type" doesn't
  // apply, regardless of what's stored in product_type (often a stale "Game").
  if (isNoTypeProduct({ store, category })) {
    return null;
  }

  // Helper: extract specific edition keyword (e.g. "Definitive", "Deluxe") from
  // the original supplier title and format as "GAME - <KEYWORD> EDITION".
  const buildEditionLabel = (): string => {
    const titleSrc = (originalTitle && originalTitle.trim() ? originalTitle : title).toUpperCase();
    // To avoid false positives (e.g. "Legacy of the Dark Knight" matching "LEGACY"),
    // we ONLY accept edition keywords that are immediately followed by the word
    // "EDITION" in the source title (with optional separators). The keywords are
    // ordered so multi-word variants are checked before single-word ones.
    const keywords = [
      "GAME OF THE YEAR", "DIGITAL DELUXE", "SUPER DELUXE",
      "DEFINITIVE", "DELUXE", "ULTIMATE", "GOLD", "PREMIUM",
      "COLLECTOR'?S?", "LIMITED", "LEGACY", "COMPLETE",
      "LEGENDARY", "CHAMPION", "ENHANCED", "ANNIVERSARY", "STANDARD",
    ];
    for (const kw of keywords) {
      const re = new RegExp(`\\b(${kw})\\s+EDITION\\b`, "i");
      const match = titleSrc.match(re);
      if (match) {
        const found = match[1].toUpperCase().replace(/'/g, "'");
        return `GAME - ${found} EDITION`;
      }
    }
    // GOTY abbreviation is unambiguous on its own
    if (/\bGOTY\b/.test(titleSrc)) return "GAME - GOTY EDITION";
    return "Edition";
  };

  // PRIORITY 0: Detect Pre-Order Bonus from the supplier title / description even
  // when the stored product_type is wrong (e.g. "Game"). This keeps the displayed
  // TYPE consistent with the displayed title prefix ("Pre-Order Bonus: ...").
  const bonusSrc = `${originalTitle || ""} ${title} ${description || ""}`;
  if (
    /\bPRE[\s-]?ORDER\s+BONUS\b/i.test(bonusSrc) &&
    !isGamePlusBonusProduct(title, description || "")
  ) {
    return "PRE ORDER BONUS";
  }

  // PRIORITY 1: Use stored product_type if available (set by backfill / import).
  // For "Edition" we expand to the specific edition variant pulled from the title.
  if (productType && productType.trim()) {
    const ptLower = productType.trim().toLowerCase();
    // GAME + BONUS detection ALWAYS wins over a mistaken "PRE ORDER BONUS"
    // classification when the title clearly describes a base-game-plus-bonus
    // product (e.g. "Game Name + Pre-Order Bonus").
    if (ptLower === "pre order bonus" && isGamePlusBonusProduct(title, description || "")) {
      return "GAME + BONUS";
    }
    // OVERRIDE: if the title explicitly says it's a DLC / Season Pass / Expansion
    // / Add-on / Skin / Currency, that wins over a stored "Edition" classification
    // that came from the BASE game name (e.g. "Ultimate Fishing Simulator - Amazon
    // River DLC" should be "DLC", not "Edition" because of the word "Ultimate").
    const titleSrc = (originalTitle && originalTitle.trim() ? originalTitle : title).toUpperCase();
    if (ptLower === "edition") {
      if (/\bDLC\b|\bADD[- ]?ON\b|\bCONTENT\s+PACK\b/.test(titleSrc)) return "DLC";
      if (/\bSEASON\s+PASS\b/.test(titleSrc)) return "Season Pass";
      if (/\bEXPANSION\b/.test(titleSrc)) return "Expansion";
      if (/\b(SKINS?|OUTFIT|COSMETIC|CHARACTER\s+PACK)\b/.test(titleSrc)) return "Skin";
      if (/\b(V-?BUCKS|ROBUX|GEMS?|TOKENS?)\b/.test(titleSrc)) return "Currency";
    }
    // OVERRIDE: stored DLC types whose titles are actually Edition Upgrades
    if (ptLower === "dlc" && /\b(EDITION\s+UPGRADE|UPGRADE\s+(PACK|EDITION|DLC))\b/.test(titleSrc)) {
      return "Upgrade";
    }
    if (ptLower === "edition") {
      return buildEditionLabel();
    }
    return productType;
  }

  if (isGamePlusBonusProduct(title, description || "")) {
    return "GAME + BONUS";
  }

  if (isPreOrderBonusProduct(title, description || "")) {
    return "PRE ORDER BONUS";
  }

  if (isPreOrderProduct(title, originalTitle || "", description || "")) {
    return "Pre-Order";
  }

  if (store === "Subscriptions") {
    return "Subscription";
  }

  if (category === "topups" || store === "Top Ups") {
    return "Top Up";
  }

  // CRITICAL: Only scan the ORIGINAL supplier title for classification keywords.
  // Never scan the description (causes false positives like "Season Pass" mentioned in
  // the description of a Definitive Edition that already includes the season pass).
  const titleUpper = (originalTitle && originalTitle.trim() ? originalTitle : title).toUpperCase();

  // Full-game editions: only treat as an Edition when an edition keyword is
  // immediately followed by the word "EDITION" (or it's the unambiguous "GOTY").
  // This prevents false positives like "Legacy of the Dark Knight" matching "LEGACY".
  if (
    /\b(DELUXE|GOLD|ULTIMATE|PREMIUM|COMPLETE|DEFINITIVE|COLLECTOR'?S?|LEGENDARY|ANNIVERSARY|DIGITAL\s+DELUXE|SUPER\s+DELUXE|STANDARD|LEGACY|LIMITED|CHAMPION|ENHANCED|GAME\s+OF\s+THE\s+YEAR)\s+EDITION\b/.test(titleUpper)
    || /\bGOTY\b/.test(titleUpper)
  ) {
    return buildEditionLabel();
  }

  if (/\bSEASON\s+PASS\b/.test(titleUpper)) return "Season Pass";
  if (/\bEXPANSION\b/.test(titleUpper)) return "Expansion";
  // Edition Upgrades (e.g. "Deluxe Edition Upgrade", "Vault Edition Upgrade")
  // are upgrades for existing owners, NOT plain DLC. Detect BEFORE the DLC check
  // because supplier titles often include "DLC" alongside "Upgrade".
  if (/\b(EDITION\s+UPGRADE|UPGRADE\s+(PACK|EDITION|DLC)|EDITION\s+UPGRADE\s+PACK)\b/.test(titleUpper)) return "Upgrade";
  if (/\bDLC\b|\bADD[- ]?ON\b|\bCONTENT\s+PACK\b/.test(titleUpper)) return "DLC";
  if (/\b(SKINS?|OUTFIT|COSMETIC|CHARACTER\s+PACK)\b/.test(titleUpper)) return "Skin";
  // Bare singular forms (POINT, GEM, COIN, CREDIT) and "GOLD"/"CASH" alone are
  // common in real game titles (e.g. "Rogue Point", "Gem and Tarot"). Only treat
  // as Currency when plural OR with explicit numeric / pack context.
  if (
    /\b(COINS|GEMS|CREDITS|POINTS|TOKENS|V-?BUCKS|ROBUX)\b/.test(titleUpper) ||
    /\b\d[\d,.]*\s*(COIN|GEM|CREDIT|POINT|TOKEN|GOLD|CASH)S?\b/.test(titleUpper) ||
    /\b(GOLD|CASH|COIN|GEM|CREDIT|POINT|TOKEN)\s+(COINS?|PACK|BUNDLE|TOKENS?|CREDITS?|POINTS?)\b/.test(titleUpper)
  ) return "Currency";
  if (/\bBUNDLE\b/.test(titleUpper)) return "Bundle";

  return "Game";
};

/**
 * List of product-type keywords that should NEVER appear in genre/badge tags.
 * Used by the badge filter to strip classification-related words from AI-generated badges.
 */
export const PRODUCT_TYPE_KEYWORDS = [
  "legendary", "deluxe", "ultimate", "premium", "complete", "goty",
  "definitive", "collector", "anniversary", "gold edition", "season pass",
  "expansion", "dlc", "add-on", "addon", "content pack", "skin", "outfit",
  "cosmetic", "currency", "bundle", "edition", "pre-order", "preorder",
  "pre order bonus", "standard edition",
];

/**
 * Removes product-type/classification words from a list of badges so that only
 * genre tags (Action, RPG, Story-rich, etc.) remain.
 */
export const filterGenreBadges = (badges: string[] | null | undefined): string[] => {
  if (!badges || badges.length === 0) return [];
  return badges.filter((badge) => {
    const lower = badge.toLowerCase().trim();
    return !PRODUCT_TYPE_KEYWORDS.some((kw) => lower === kw || lower.includes(kw));
  });
};

export const ITEM_TYPE_LABELS: Record<GameItemType, string> = {
  base: "Base Game",
  dlc: "DLC",
  skin: "Skin",
  currency: "Currency",
  edition: "Edition",
};

export const ITEM_TYPE_COLORS: Record<GameItemType, string> = {
  base: "bg-blue-500/15 text-blue-400 border-blue-500/40",
  dlc: "bg-purple-500/15 text-purple-400 border-purple-500/40",
  skin: "bg-pink-500/15 text-pink-400 border-pink-500/40",
  currency: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  edition: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
};

/**
 * Returns true if the product is an add-on (DLC, Skin, Currency, Bundle,
 * Season Pass, Expansion, Pre-Order Bonus) that REQUIRES the base game to be
 * activated. Returns false for full games and standalone editions.
 */
export const isAddonRequiringBaseGame = (params: {
  title: string;
  originalTitle?: string | null;
  description?: string | null;
  category?: string | null;
  store?: string | null;
  productType?: string | null;
}) => {
  const label = getProductTypeLabel(params);
  return (
    label === "DLC" ||
    label === "Skin" ||
    label === "Currency" ||
    label === "Season Pass" ||
    label === "Expansion" ||
    label === "PRE ORDER BONUS"
  );
};

/**
 * Extract the base-game name from an add-on title by stripping common add-on
 * suffixes/prefixes (DLC, Season Pass, edition keywords, platform/region tags).
 */
export const extractBaseGameName = (title: string): string => {
  let name = title;

  // Strip "PRE-ORDER BONUS:" prefix
  name = name.replace(/^\s*PRE[\s-]?ORDER\s+BONUS\s*[:\-–—]?\s*/i, "");
  name = name.replace(/^\s*PRE[\s-]?ORDER\s*[:\-–—]?\s*/i, "");
  // Strip leading classification prefixes ("DLC:", "Skin:", "Currency:", etc.)
  name = name.replace(/^\s*(DLC|SKIN|CURRENCY|SEASON\s+PASS|EXPANSION|ADD[\s-]?ON|BUNDLE)\s*[:\-–—]\s*/i, "");

  // PRIMARY HEURISTIC: most add-on titles follow the pattern
  //   "<Base Game> - <Add-on Name> [DLC|Pack|...] - <Platform> - <Region>"
  // Take everything before the FIRST " - " separator as the base game name.
  // Colons inside the base game name (e.g. "Call of Duty: Black Ops 6") are kept.
  const firstDashIdx = name.search(/\s[-–—]\s/);
  if (firstDashIdx > 0) {
    name = name.slice(0, firstDashIdx);
    // SECONDARY HEURISTIC: many add-ons use the pattern
    //   "<Base Game>: <Add-on Name>"  (e.g. "The Sims 4: Cool Kitchen Stuff")
    // If the segment after the LAST colon looks like an add-on (Stuff, Pack,
    // Expansion, Kit, Bundle, DLC, Skin, Bonus, ...) drop everything from
    // that colon onwards. Otherwise keep the colon (e.g.
    // "Call of Duty: Black Ops 6" stays intact).
    const lastColonIdx = name.lastIndexOf(":");
    if (lastColonIdx > 0) {
      const after = name.slice(lastColonIdx + 1).trim();
      const addonRegex = /\b(stuff(?:\s+pack)?|game\s+pack|expansion(?:\s+pack)?|kit|bundle|dlc|skin(s)?|bonus|season\s+pass|content\s+pack|character\s+pack|outfit|cosmetic|upgrade|add[\s-]?on)\b/i;
      if (addonRegex.test(after)) {
        name = name.slice(0, lastColonIdx);
      }
    }
    return name.trim();
  }

  // Strip platform/region trailing tags ("- Nintendo - Europe", "- Steam - Global", etc.)
  name = name.replace(/\s*[-–—]\s*(Nintendo|Steam|Xbox|PlayStation|PSN|PS4|PS5|Epic Games|Epic|Origin|Ubisoft|EA|Battle\.net|GOG|Rockstar|PC)(\s*[-–—]\s*[A-Za-z ]+)*$/i, "");
  name = name.replace(/\s*[-–—]\s*(Global|Europe|EU|US|USA|Worldwide|Region\s*Free|NA|UK|JP|Japan|Asia|LATAM)$/i, "");

  // Strip add-on type keywords and everything after them
  const cutKeywords = [
    "PRE[\\s-]?ORDER\\s+BONUS",
    "SEASON\\s+PASS",
    "EXPANSION\\s+PASS",
    "EXPANSION",
    "DLC",
    "ADD[\\s-]?ON",
    "CONTENT\\s+PACK",
    "CHARACTER\\s+PACK",
    "SKIN(S)?",
    "OUTFIT",
    "COSMETIC",
    "BUNDLE",
    "DELUXE\\s+UPGRADE",
    "ULTIMATE\\s+UPGRADE",
    "UPGRADE",
  ];
  const cutRegex = new RegExp(`\\s*[-–—:]?\\s*\\b(${cutKeywords.join("|")})\\b.*$`, "i");
  name = name.replace(cutRegex, "");

  return name.trim().replace(/[\s\-–—:]+$/g, "").trim();
};