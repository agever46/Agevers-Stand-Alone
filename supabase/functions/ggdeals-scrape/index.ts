import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Product type detection ──────────────────────────────────────────
// Detects the product type from a title string.
// Order matters: check specific patterns before generic ones.
function detectProductType(title: string): string {
  const t = title.toLowerCase();

  // Gift cards / top-ups / currency
  if (/gift\s*card|prepaid|wallet\s*(code|card)|psn\s*card|xbox\s*gift|nintendo\s*eshop\s*card|steam\s*wallet/i.test(t)) return "gift-card";
  if (/\b\d+\s*(coins?|gems?|gold|points?|credits?|v-?bucks|robux|riot\s*points?|platinum|silver|crowns?|atoms?|doubloons?)\b/i.test(t)) return "currency";
  if (/\b(top[\s-]?up|currency\s*pack|coin\s*pack|point\s*pack)\b/i.test(t)) return "currency";

  // Subscriptions / memberships
  if (/\b(xbox\s*game\s*pass|ea\s*play|ps\s*plus|playstation\s*plus|nintendo\s*switch\s*online|ubisoft\s*\+|humble\s*choice)\b/i.test(t)) return "subscription";
  if (/\b(\d+\s*(day|month|year)s?\s*(membership|subscription|access))\b/i.test(t)) return "subscription";

  // Season pass / DLC / expansion
  if (/\bseason\s*pass\b/i.test(t)) return "dlc";
  if (/\b(dlc|expansion|add[\s-]?on|content\s*pack|booster\s*pack|character\s*pack|map\s*pack|skin\s*pack|weapon\s*pack|cosmetic\s*pack|battle\s*pass|starter\s*pack)\b/i.test(t)) return "dlc";

  // Specific editions (must come before generic "edition" check)
  if (/\b(deluxe|ultimate|gold|premium|collector'?s?|legendary|champion|digital\s*deluxe|super\s*deluxe|enhanced|definitive|complete|goty|game\s*of\s*the\s*year|remastered|anniversary|special)\s*(edition)?\b/i.test(t)
      && /edition|версия/i.test(t)) return "edition";
  // Also match when edition keywords appear without "edition" word but with clear edition names
  if (/\b(deluxe|ultimate|gold|premium|collector'?s?|legendary|champion|definitive|complete|goty|game\s*of\s*the\s*year)\b/i.test(t)) return "edition";

  // Bundles
  if (/\bbundle\b/i.test(t)) return "bundle";

  // In-game items
  if (/\b(skin|outfit|emote|mount|pet|cosmetic|loot\s*box|crate|key\s*capsule)\b/i.test(t)) return "in-game-item";

  // Software (non-game)
  if (/\b(windows|office|microsoft\s*365|adobe|antivirus|vpn|photoshop|autocad)\b/i.test(t)) return "software";

  // Default: base game
  return "game";
}

// ── Title cleaning helpers ──────────────────────────────────────────
// Strips region/platform suffixes that Kinguin adds to titles
function cleanTitleForSearch(title: string): string {
  return title
    .replace(/\s*-\s*(PC|Xbox|PlayStation|PS[45]|Nintendo|Switch|Mac|Linux)\s*-\s*(Global|Europe|North America|Latin America|Russia|Asia|Middle East|Africa|Oceania|Ru\/cis|United States|United Kingdom|Argentina|Turkey|India|Brazil|Japan|Korea|China|Australia|Germany|France|Italy|Spain|Canada|Mexico|Saudi Arabia|Egypt|South Africa|UAE|Worldwide)$/i, "")
    .replace(/\s*-\s*(Global|Europe|North America|Latin America|Russia|Asia|Middle East|Africa|Oceania|Ru\/cis|United States|United Kingdom|Argentina|Turkey|India|Brazil|Japan|Korea|China|Australia|Germany|France|Italy|Spain|Canada|Mexico|Saudi Arabia|Egypt|South Africa|UAE|Worldwide)$/i, "")
    .replace(/\s*-\s*(PC|Xbox|PlayStation|PS[45]|Nintendo|Switch|Mac|Linux)$/i, "")
    .trim();
}

// Extract the "base name" from a title — strip edition/DLC/currency qualifiers
// so we can compare against search results more precisely.
function extractBaseName(title: string): string {
  return title
    .replace(/\s*[-–:]\s*(deluxe|ultimate|gold|premium|collector'?s?|legendary|champion|digital\s*deluxe|super\s*deluxe|enhanced|definitive|complete|goty|game\s*of\s*the\s*year|remastered|anniversary|special)\s*(edition)?$/i, "")
    .replace(/\s*[-–:]\s*season\s*pass.*$/i, "")
    .replace(/\s*[-–:]\s*expansion.*$/i, "")
    .trim();
}

// ── Search result scoring ───────────────────────────────────────────
// Score how well a search result matches our product.
// Higher = better match.
function scoreResultMatch(
  resultUrl: string,
  resultTitle: string,
  searchTitle: string,
  productType: string,
  platformContext: string
): number {
  let score = 0;
  const url = resultUrl.toLowerCase();
  const rTitle = resultTitle.toLowerCase();
  const sTitle = searchTitle.toLowerCase();

  // Must be allkeyshop
  if (!url.includes("allkeyshop.com")) return -1000;

  // Prefer buy/cd-key/digital-download pages
  if (url.includes("/buy-") || url.includes("/cd-key") || url.includes("/digital-download")) score += 10;

  // Platform match in URL
  if (platformContext) {
    const platSlug = platformContext.toLowerCase().split(" ")[0];
    if (url.includes(platSlug)) score += 15;
  }

  // Product type consistency checks
  const resultType = detectProductType(resultTitle || url);

  if (resultType === productType) {
    score += 20; // Exact type match
  } else {
    // Penalize type mismatches heavily
    // e.g., searching for base game but result is DLC
    if (productType === "game" && (resultType === "dlc" || resultType === "edition" || resultType === "currency")) {
      score -= 30;
    }
    if (productType === "dlc" && resultType === "game") {
      score -= 30;
    }
    if (productType === "edition" && resultType === "game") {
      score -= 15; // Edition vs game is less severe
    }
    if (productType === "currency" && resultType !== "currency") {
      score -= 40;
    }
    if (productType !== "currency" && resultType === "currency") {
      score -= 40;
    }
  }

  // Title similarity: check if key words from search title appear in result
  const searchWords = sTitle.split(/\s+/).filter(w => w.length > 2);
  const matchedWords = searchWords.filter(w => rTitle.includes(w));
  score += (matchedWords.length / Math.max(searchWords.length, 1)) * 15;

  // Check for specific edition keywords matching
  const editionKeywords = ["deluxe", "ultimate", "gold", "premium", "goty", "definitive", "complete", "legendary", "collector"];
  const searchHasEdition = editionKeywords.find(k => sTitle.includes(k));
  const resultHasEdition = editionKeywords.find(k => rTitle.includes(k));

  if (searchHasEdition && resultHasEdition && searchHasEdition === resultHasEdition) {
    score += 25; // Exact edition match
  } else if (searchHasEdition && !resultHasEdition) {
    score -= 20; // We want a specific edition but result is standard
  } else if (!searchHasEdition && resultHasEdition) {
    score -= 20; // We want standard but result is an edition
  }

  // DLC name matching: if our title has DLC-specific words, check they appear
  if (productType === "dlc") {
    // The DLC name after the base game name should match
    const baseName = extractBaseName(sTitle);
    const dlcPart = sTitle.replace(baseName, "").trim().replace(/^[-–:]\s*/, "");
    if (dlcPart.length > 3) {
      const dlcWords = dlcPart.split(/\s+/).filter(w => w.length > 2);
      const dlcMatched = dlcWords.filter(w => rTitle.includes(w));
      score += (dlcMatched.length / Math.max(dlcWords.length, 1)) * 20;
      if (dlcMatched.length === 0) score -= 25; // DLC name doesn't match at all
    }
  }

  return score;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth check
    let userId: string | null = null;
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      const { data: userData, error: userError } = await adminClient.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = userData.user.id;
    } else {
      userId = claimsData.claims.sub as string;
    }

    // Admin check
    const { data: roleRows } = await adminClient
      .from("user_roles").select("role").eq("user_id", userId)
      .in("role", ["admin", "super_admin"]);
    if (!roleRows?.length) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, platform, store } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanTitle = cleanTitleForSearch(title);
    const productType = detectProductType(cleanTitle);

    // Map platform/store to AllKeyShop platform context
    const platformMap: Record<string, string> = {
      "Steam": "Steam CD Key",
      "Epic Games": "Epic Games CD Key",
      "GOG": "GOG CD Key",
      "Xbox": "Xbox Live",
      "PlayStation": "PlayStation Network",
      "Nintendo": "Nintendo Switch",
      "Battle.net": "Battle.net CD Key",
      "Ubisoft": "Ubisoft Connect CD Key",
      "EA App": "EA App CD Key",
      "Rockstar": "Rockstar CD Key",
      "Windows Store": "Windows Store",
    };

    const platformContext = platformMap[store] || platformMap[platform] || "";

    // Build a more specific search query based on product type
    let searchQuery = cleanTitle;
    if (platformContext) {
      searchQuery += ` ${platformContext}`;
    }
    // Add type-specific qualifiers to narrow results
    if (productType === "dlc") {
      searchQuery += " DLC";
    } else if (productType === "currency") {
      // Currency titles usually already contain the currency name
    } else if (productType === "edition" && !/edition/i.test(cleanTitle)) {
      searchQuery += " edition";
    }
    searchQuery += " site:allkeyshop.com";

    console.log(`Scraping AllKeyShop: query="${searchQuery}" | type="${productType}" | original="${title}"`);

    // Step 1: Search for the product page via Firecrawl search
    const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 8, // Fetch more results for better matching
      }),
    });

    const searchData = await searchRes.json();
    if (!searchRes.ok) {
      console.error("Firecrawl search error:", searchData);
      return new Response(JSON.stringify({ error: "Search failed", details: searchData }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = searchData?.data || searchData?.results || [];

    // Score and rank all results
    const scoredResults = results
      .map((r: any) => ({
        ...r,
        score: scoreResultMatch(
          r.url || "",
          r.title || r.description || "",
          cleanTitle,
          productType,
          platformContext
        ),
      }))
      .filter((r: any) => r.score > -100) // Filter out terrible matches
      .sort((a: any, b: any) => b.score - a.score);

    console.log("Scored results:", scoredResults.map((r: any) => ({
      url: r.url,
      title: (r.title || "").substring(0, 60),
      score: r.score,
      detectedType: detectProductType(r.title || r.url || ""),
    })));

    const productPageUrl = scoredResults[0]?.url || `https://www.allkeyshop.com/${cleanTitle.replace(/\s+/g, "+")}/`;
    const matchScore = scoredResults[0]?.score ?? 0;
    const matchConfidence = matchScore >= 30 ? "high" : matchScore >= 10 ? "medium" : "low";

    console.log(`Best match: ${productPageUrl} (score: ${matchScore}, confidence: ${matchConfidence})`);

    // Step 2: Scrape with extract
    const typeHint = productType === "dlc" ? "This is a DLC/add-on, NOT the base game." :
                     productType === "edition" ? "This is a specific edition of the game." :
                     productType === "currency" ? "This is an in-game currency/top-up." :
                     productType === "gift-card" ? "This is a gift card/prepaid card." :
                     "This is the standard/base version of the game.";

    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: productPageUrl,
        formats: ["markdown", "extract"],
        extract: {
          prompt: `Extract pricing from this AllKeyShop page. ${typeHint}

IMPORTANT: Make sure you're reading the price for the EXACT product "${cleanTitle}" on "${platformContext || "PC"}" platform.
- If the page shows multiple editions or versions, pick ONLY the one matching "${cleanTitle}".
- Do NOT confuse the base game price with a DLC price or vice versa.
- Do NOT confuse Standard Edition with Deluxe/Ultimate/Gold editions.
- Look at the merchant comparison table for keyshop and official store prices.
- Report the page_product_title exactly as shown on the page so we can verify the match.`,
          schema: {
            type: "object",
            properties: {
              page_product_title: { type: "string", description: "The exact product title shown on the AllKeyShop page" },
              cheapest_price: { type: "number", description: "The lowest price from keyshop merchants" },
              cheapest_merchant: { type: "string", description: "Name of the cheapest keyshop merchant" },
              official_store_price: { type: "number", description: "Lowest price from official stores (Steam, Epic, PSN, etc.)" },
              official_store_name: { type: "string", description: "Name of the official store" },
              currency: { type: "string", description: "3-letter currency code: USD, EUR, or GBP" },
              platform_found: { type: "string", description: "The platform/edition found on the page" },
              product_type_on_page: { type: "string", description: "What type of product the page is for: game, dlc, edition, currency, gift-card, bundle, subscription, software" },
            },
          },
        },
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeRes.json();
    if (!scrapeRes.ok) {
      console.error("Firecrawl scrape error:", scrapeData);
      return new Response(JSON.stringify({ error: "Scrape failed", details: scrapeData }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jsonData = scrapeData?.data?.extract || scrapeData?.extract || null;
    const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";

    // Verify the scraped page matches our product type
    const scrapedType = jsonData?.product_type_on_page ? jsonData.product_type_on_page.toLowerCase() : null;
    let typeMismatchWarning: string | null = null;

    if (scrapedType && scrapedType !== productType) {
      // Allow "game" ↔ "edition" as close enough in some cases
      const compatible =
        (productType === "game" && scrapedType === "edition") ||
        (productType === "edition" && scrapedType === "game");
      if (!compatible) {
        typeMismatchWarning = `Warning: searched for "${productType}" but page shows "${scrapedType}"`;
        console.warn(typeMismatchWarning);
      }
    }

    let prices;
    if (jsonData && (jsonData.cheapest_price || jsonData.official_store_price)) {
      console.log("Using structured extraction:", JSON.stringify(jsonData));
      prices = {
        lowestKeyshop: jsonData.cheapest_price || null,
        lowestRetail: jsonData.official_store_price || null,
        historicalLow: null,
        currency: jsonData.currency || detectCurrencyFromMarkdown(markdown) || "EUR",
        keyshopName: jsonData.cheapest_merchant || null,
        retailName: jsonData.official_store_name || null,
      };
    } else {
      console.log("Extraction empty, falling back to markdown parsing");
      prices = extractPricesFromMarkdown(markdown);
    }

    // Normalize currency
    const detectedCurrency = normalizeCurrencyCode(prices.currency || detectCurrencyFromMarkdown(markdown) || "EUR", markdown);
    prices.currency = detectedCurrency;

    // Convert to EUR if needed
    if (detectedCurrency !== "EUR") {
      console.log(`Prices are in ${detectedCurrency}, converting to EUR...`);
      try {
        const fxRes = await fetch(`https://api.frankfurter.dev/v1/latest?from=${detectedCurrency}&to=EUR`);
        const fxData = await fxRes.json();
        const rate = fxData?.rates?.EUR;
        if (rate) {
          console.log(`Exchange rate ${detectedCurrency}→EUR: ${rate}`);
          if (prices.lowestKeyshop) prices.lowestKeyshop = Math.round(prices.lowestKeyshop * rate * 100) / 100;
          if (prices.lowestRetail) prices.lowestRetail = Math.round(prices.lowestRetail * rate * 100) / 100;
          prices.originalCurrency = detectedCurrency;
          prices.exchangeRate = rate;
          prices.currency = "EUR";
        }
      } catch (fxErr) {
        console.error("Currency conversion failed:", fxErr);
      }
    }

    console.log("Final prices:", JSON.stringify(prices));

    return new Response(JSON.stringify({
      success: true,
      found: true,
      title: cleanTitle,
      url: productPageUrl,
      prices,
      source: "allkeyshop",
      productType,
      matchConfidence,
      matchScore,
      pageProductTitle: jsonData?.page_product_title || null,
      typeMismatchWarning,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AllKeyShop scrape error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function detectCurrencyFromMarkdown(markdown: string) {
  if (!markdown) return null;
  if (markdown.includes("€")) return "EUR";
  if (markdown.includes("$") || markdown.toLowerCase().includes(" usd")) return "USD";
  if (markdown.includes("£") || markdown.toLowerCase().includes(" gbp")) return "GBP";
  return null;
}

function normalizeCurrencyCode(currency: string, markdown: string) {
  const raw = currency.trim().toUpperCase();
  if (["EUR", "USD", "GBP", "SEK", "NOK", "DKK", "PLN", "CAD", "AUD"].includes(raw)) return raw;
  if (raw === "€") return "EUR";
  if (raw === "$" || raw === "US$") return "USD";
  if (raw === "£") return "GBP";
  return detectCurrencyFromMarkdown(markdown) || "EUR";
}

function extractPricesFromMarkdown(markdown: string) {
  const result = {
    lowestKeyshop: null as number | null,
    lowestRetail: null as number | null,
    historicalLow: null as number | null,
    currency: detectCurrencyFromMarkdown(markdown) || "EUR",
    keyshopName: null as string | null,
    retailName: null as string | null,
  };

  const priceRegex = result.currency === "USD"
    ? /\$\s*(\d{1,4}[.,]\d{2})/g
    : result.currency === "GBP"
    ? /£\s*(\d{1,4}[.,]\d{2})/g
    : /€\s*(\d{1,4}[.,]\d{2})/g;

  const allPrices: number[] = [];
  let match;
  while ((match = priceRegex.exec(markdown)) !== null) {
    const price = parseFloat(match[1].replace(",", "."));
    if (price > 0.5 && price < 5000) allPrices.push(price);
  }

  if (allPrices.length > 0) {
    allPrices.sort((a, b) => a - b);
    result.lowestKeyshop = allPrices[0];
    if (allPrices.length > 1) {
      result.lowestRetail = allPrices[1];
    }
  }

  return result;
}
