import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// New format target: "Name - Sub-Title (Type) - Platform - Region"
// Type values per memory: Game, Subscription, Top Up, Edition, Season Pass, Expansion,
//                         DLC, Skin, Currency, Bundle, Game + Bonus, PRE ORDER BONUS

// --- Type detection (mirrors backfill-product-types but adds "Game + Bonus") ---
function detectType(originalTitle: string, title: string, store: string | null, description: string | null): string {
  const src = ((originalTitle?.trim() ? originalTitle : title) || "").toUpperCase();
  const desc = (description || "").toLowerCase();

  if (store === "Subscriptions") return "Subscription";
  if (store === "Top Ups") return "Top Up";

  // Game + Bonus: full base game bundled with pre-order bonus
  const isBundleWithBonus =
    /\+\s*(PRE[\s-]?ORDER\s+)?BONUS/.test(src) ||
    /full\s+(base\s+)?game/.test(desc) ||
    /(includes?|including|comes with|contains?)[^.]{0,80}(base\s+game|full\s+game)/.test(desc);

  if (/\bPRE[\s-]?ORDER\s+BONUS\b/.test(src) && !isBundleWithBonus) return "PRE ORDER BONUS";
  if (isBundleWithBonus) return "Game + Bonus";

  if (/\b(DELUXE|GOLD\s+EDITION|ULTIMATE|PREMIUM|COMPLETE|GOTY|DEFINITIVE|COLLECTOR'?S|LEGENDARY|ANNIVERSARY|DIGITAL\s+DELUXE|SUPER\s+DELUXE|STANDARD\s+EDITION)\b/.test(src)) return "Edition";
  if (/\bSEASON\s+PASS\b/.test(src)) return "Season Pass";
  if (/\bEXPANSION\b/.test(src)) return "Expansion";
  if (/\bDLC\b|\bADD[- ]?ON\b|\bCONTENT\s+PACK\b/.test(src)) return "DLC";
  if (/\b(SKINS?|OUTFIT|COSMETIC|CHARACTER\s+PACK)\b/.test(src)) return "Skin";
  if (/\b(COINS?|GEMS?|V-?BUCKS|ROBUX|CREDITS?|POINTS?|GOLD|CASH|TOKENS?)\b/.test(src)) return "Currency";
  if (/\bBUNDLE\b/.test(src)) return "Bundle";
  return "Game";
}

// --- Title parser: split current title into name + sub-title ---
// Current titles look like: "{Name} - {Platform} - {Region}" OR
// "{Name}: {Edition} - {Platform} - {Region}" OR similar.
// Goal: produce "{Name} - {Sub-Title} (Type) - Platform - Region"

function stripPlatformRegionSuffix(title: string, platform: string, region: string): string {
  // Strip trailing " - <platform> - <region>" or " - <platform>" or " - <region>"
  let t = title.trim();
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`\\s*-\\s*${escape(platform)}\\s*-\\s*${escape(region)}\\s*$`, "i"),
    new RegExp(`\\s*-\\s*${escape(platform)}\\s*$`, "i"),
    new RegExp(`\\s*-\\s*${escape(region)}\\s*$`, "i"),
  ];
  for (const p of patterns) t = t.replace(p, "");
  return t.trim();
}

// Edition keywords we want to surface as the Sub-Title
const EDITION_KEYWORDS = [
  "Deluxe Edition", "Digital Deluxe", "Super Deluxe", "Gold Edition",
  "Ultimate Edition", "Premium Edition", "Complete Edition",
  "Definitive Edition", "Collector's Edition", "Anniversary Edition",
  "Legendary Edition", "Standard Edition", "GOTY Edition",
  "Game of the Year Edition", "Director's Cut", "Remastered",
];

function extractSubTitle(name: string, type: string): { base: string; sub: string } {
  // 1) Anything after a ":" or " - " is candidate sub-title
  // Prefer ":" (works for "Game Name: Edition Name")
  const colonMatch = name.match(/^(.+?):\s*(.+)$/);
  if (colonMatch) {
    return { base: colonMatch[1].trim(), sub: colonMatch[2].trim() };
  }

  // 2) Detect known edition keyword inside name
  for (const kw of EDITION_KEYWORDS) {
    const re = new RegExp(`\\s*[-–—]?\\s*${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i");
    const m = name.match(re);
    if (m && m.index !== undefined && m.index > 0) {
      const base = name.slice(0, m.index).trim().replace(/[-–—:]+$/, "").trim();
      const sub = name.slice(m.index).trim().replace(/^[-–—:]+/, "").trim();
      return { base, sub };
    }
  }

  // 3) Currency / Top-Up / Gift Card patterns: keep whole name as base, no sub
  if (type === "Currency" || type === "Top Up" || type === "Subscription") {
    return { base: name, sub: "" };
  }

  // 4) DLC / Bonus: anything after "—" or " - "
  const dashMatch = name.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dashMatch && (type === "DLC" || type === "Skin" || type === "Season Pass" || type === "Expansion" || type === "PRE ORDER BONUS" || type === "Game + Bonus")) {
    return { base: dashMatch[1].trim(), sub: dashMatch[2].trim() };
  }

  return { base: name, sub: "" };
}

function reformat(p: { title: string; original_title: string | null; platform: string; region: string; store: string | null; description: string | null }): { newTitle: string; type: string; confidence: "high" | "medium" | "low" } {
  const type = detectType(p.original_title || "", p.title, p.store, p.description);
  const cleaned = stripPlatformRegionSuffix(p.title, p.platform || "", p.region || "");
  const { base, sub } = extractSubTitle(cleaned, type);

  // Confidence heuristic
  let confidence: "high" | "medium" | "low" = "high";
  if (!sub && (type === "Edition" || type === "DLC" || type === "Game + Bonus" || type === "Season Pass" || type === "Expansion" || type === "PRE ORDER BONUS")) {
    confidence = "low"; // expected a sub-title but couldn't extract one
  } else if (sub && sub.length > 80) {
    confidence = "medium";
  }

  // Build: "Base - Sub (Type) - Platform - Region"  (omit "(Game)" for plain games)
  const parts: string[] = [base];
  const tail: string[] = [];
  if (sub) tail.push(sub);
  if (type !== "Game") {
    if (sub) parts[parts.length - 1] = `${base} - ${sub} (${type})`;
    else parts[0] = `${base} (${type})`;
  } else if (sub) {
    parts[0] = `${base} - ${sub}`;
  }

  const platform = p.platform || "";
  const region = p.region || "";
  const out = [parts[0]];
  if (platform) out.push(platform);
  if (region) out.push(region);

  return { newTitle: out.join(" - "), type, confidence };
}

// --- Apply learned correction rules (regex pattern -> replacement template) ---
// Replacement may include $1..$9 for capture groups, plus tokens {platform} {region} {type}.
function applyCorrectionRules(
  oldTitle: string,
  baseProposal: { newTitle: string; type: string; confidence: "high" | "medium" | "low" },
  rules: Array<{ pattern: string; replacement: string; type_hint: string | null }>,
  platform: string,
  region: string,
): { newTitle: string; type: string; confidence: "high" | "medium" | "low"; matchedRule: boolean } {
  for (const rule of rules) {
    try {
      const re = new RegExp(rule.pattern, "i");
      const m = oldTitle.match(re);
      if (!m) continue;
      let out = rule.replacement;
      for (let i = 1; i < m.length; i++) {
        out = out.replace(new RegExp("\\$" + i, "g"), m[i] ?? "");
      }
      out = out
        .replace(/\{platform\}/gi, platform || "")
        .replace(/\{region\}/gi, region || "")
        .replace(/\{type\}/gi, rule.type_hint || baseProposal.type || "");
      return {
        newTitle: out.trim(),
        type: rule.type_hint || baseProposal.type,
        confidence: "high",
        matchedRule: true,
      };
    } catch {
      continue;
    }
  }
  return { ...baseProposal, matchedRule: false };
}

// --- Derive a regex+replacement rule from a manual edit ---
// Strategy: replace the exact dynamic parts (the parts of the OLD title that
// changed in the NEW title) with capture groups. We tokenize on " - " and
// numbers / region / platform tokens.
function deriveRuleFromEdit(oldTitle: string, newTitle: string, platform: string, region: string): { pattern: string; replacement: string } | null {
  if (!oldTitle || !newTitle || oldTitle === newTitle) return null;

  // Escape regex special chars
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Build a pattern by abstracting:
  //  - any number sequence -> (\d+)
  //  - the platform/region literal stays literal so the rule is targeted.
  // Then the replacement uses the *new* title with the captured number(s)
  // re-injected in order ($1, $2, ...) at the matching numeric positions.

  const numbersInOld = oldTitle.match(/\d+/g) || [];
  const numbersInNew = newTitle.match(/\d+/g) || [];

  // Only auto-generalize if the same numbers appear in both (very common: "50 EUR")
  const sharedNumbers = numbersInOld.filter((n) => numbersInNew.includes(n));

  let patternStr = esc(oldTitle);
  let replacement = newTitle;

  if (sharedNumbers.length > 0) {
    // Replace each shared number with a capture group, in order, in BOTH strings.
    let groupIdx = 0;
    const used = new Set<string>();
    for (const num of sharedNumbers) {
      if (used.has(num)) continue;
      used.add(num);
      groupIdx++;
      const escNum = esc(num);
      // Replace first occurrence in pattern with capture group
      patternStr = patternStr.replace(new RegExp(escNum), "(\\d+)");
      // Replace first occurrence in replacement with $N reference
      replacement = replacement.replace(new RegExp(escNum), "$" + groupIdx);
    }
  }

  // Anchor to start so we don't accidentally match substrings of unrelated titles
  patternStr = "^" + patternStr + "$";

  return { pattern: patternStr, replacement };
}

// AI refinement removed — reformatting is fully deterministic (rules + parser).

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

    const body = await req.json().catch(() => ({}));
    const {
      mode = "preview",            // "preview" | "apply"
      batchStart = 0,
      batchLimit = 100,
      useAI = false,
      filterType = null,           // optional: limit to a product_type
      ids = null,                  // optional: explicit ids array (used for "apply selected")
      overrides = null,            // optional: {id: newTitle} from manual edits
    } = body as Record<string, unknown> & { ids?: string[] | null; overrides?: Record<string, string> | null };

    // --- APPLY mode: trust client-supplied id→title map ---
    if (mode === "apply" && overrides && typeof overrides === "object") {
      const entries = Object.entries(overrides);
      let updated = 0;
      // Optional learning payload from client: [{id, oldTitle, proposed, finalTitle, platform, region, typeHint}]
      const learn = (body as any).learn as Array<{
        id: string; oldTitle: string; proposed: string; finalTitle: string;
        platform: string; region: string; typeHint?: string | null;
      }> | undefined;

      await Promise.all(entries.map(async ([id, newTitle]) => {
        const t = String(newTitle || "").trim();
        if (!t) return;
        const { error } = await supabase.from("allowed_products").update({ title: t }).eq("id", id);
        if (!error) updated++;
      }));

      // Learn from edits where user changed the auto-proposed value
      let rulesLearned = 0;
      if (Array.isArray(learn)) {
        for (const item of learn) {
          if (!item?.oldTitle || !item?.finalTitle) continue;
          // Only learn if user manually edited (final differs from what the parser proposed)
          if (item.proposed === item.finalTitle) continue;
          const derived = deriveRuleFromEdit(item.oldTitle, item.finalTitle, item.platform, item.region);
          if (!derived) continue;
          const { error: upErr } = await supabase
            .from("title_correction_rules")
            .upsert(
              {
                pattern: derived.pattern,
                replacement: derived.replacement,
                type_hint: item.typeHint ?? null,
                example_old: item.oldTitle,
                example_new: item.finalTitle,
                hits: 1,
                is_active: true,
                created_by: user.id,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "pattern" },
            );
          if (!upErr) rulesLearned++;
        }
      }

      return new Response(JSON.stringify({ applied: updated, rulesLearned }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- PREVIEW mode: compute proposals for a batch ---
    let q = supabase.from("allowed_products").select("id, title, original_title, platform, region, store, description, product_type");
    if (Array.isArray(ids) && ids.length > 0) q = q.in("id", ids);
    else {
      if (filterType && typeof filterType === "string") q = q.eq("product_type", filterType);
      q = q.range(Number(batchStart), Number(batchStart) + Number(batchLimit) - 1);
    }

    const { data: products, error } = await q;
    if (error) throw error;
    if (!products?.length) {
      return new Response(JSON.stringify({ proposals: [], hasMore: false, nextStart: batchStart }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load active correction rules ordered by hits (most-hit rules tried first)
    const { data: rules } = await supabase
      .from("title_correction_rules")
      .select("pattern, replacement, type_hint, hits")
      .eq("is_active", true)
      .order("hits", { ascending: false })
      .limit(500);

    const proposals = products.map((p: any) => {
      const baseR = reformat(p);
      const ruled = applyCorrectionRules(p.title, baseR, rules || [], p.platform || "", p.region || "");
      return {
        id: p.id,
        old: p.title,
        new: ruled.newTitle,
        type: ruled.type,
        confidence: ruled.confidence,
        platform: p.platform,
        region: p.region,
        changed: ruled.newTitle !== p.title,
        ruleMatched: ruled.matchedRule,
      };
    });

    // AI pass removed — `useAI` flag is accepted but ignored.

    return new Response(JSON.stringify({
      proposals,
      hasMore: products.length >= Number(batchLimit),
      nextStart: Number(batchStart) + Number(batchLimit),
      total: products.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});