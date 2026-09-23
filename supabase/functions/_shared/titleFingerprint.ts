// Shared title fingerprint used to detect that a Kinguin suggestion is really
// the same product as one already in the catalog.
//
// Kinguin raw titles ("Steam Gift Card 20 EUR Global CD Key") and the cleaned
// catalog titles ("Steam Card 20 EUR - Gift Cards - Global") differ in word
// order, punctuation and boilerplate, so a plain string compare misses them.
// The fingerprint drops boilerplate tokens and sorts the rest, which makes the
// comparison order-independent.
//
// IMPORTANT: region / platform / edition words are NOT noise — they separate
// genuinely different products ("... 20 EUR Global" vs "... 20 EUR UK"), so
// they are kept and only normalized to a canonical form.

// Pure boilerplate: words that never distinguish one product from another.
const NOISE_TOKENS = new Set([
  "gift", "card", "cards", "giftcard", "giftcards",
  "cd", "key", "keys", "activation", "code", "codes",
  "download", "voucher", "prepaid", "topup", "top", "up", "recharge",
  "official", "store", "only",
]);

// Region / platform synonyms collapsed to one canonical token so that wording
// differences don't create false "new" products, while real region variants
// still produce different fingerprints.
const SYNONYMS: Record<string, string> = {
  worldwide: "global",
  ww: "global",
  row: "global",
  europe: "eu",
  european: "eu",
  usa: "us",
  "united": "",     // handled by phrase pass below
  states: "us",
  kingdom: "uk",
  gb: "uk",
};

export function titleFingerprint(raw: string | null | undefined): string {
  const normalized = (raw || "")
    .toLowerCase()
    .replace(/\bunited states\b/g, "us")
    .replace(/\bunited kingdom\b/g, "uk");

  const tokens = normalized
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean)
    // normalize numbers like "20.00" / "020" → "20"
    .map((t) => (/^\d+$/.test(t) ? String(parseInt(t, 10)) : t))
    .map((t) => (t in SYNONYMS ? SYNONYMS[t] : t))
    .filter(Boolean)
    .filter((t) => !NOISE_TOKENS.has(t));

  if (tokens.length === 0) return "";
  return [...new Set(tokens)].sort().join(" ");
}
