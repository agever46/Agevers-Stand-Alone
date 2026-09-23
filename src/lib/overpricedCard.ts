// Detects overpriced gift cards by comparing the projected sell price
// to the card's face value parsed from its title. Mirrors the logic in
// supabase/functions/scan-overpriced-cards/index.ts so the Kinguin import
// list can warn admins BEFORE importing a card.

const FX: Record<string, number> = {
  EUR: 1.0, USD: 0.92, GBP: 1.17, HKD: 0.118, ZAR: 0.050,
  HUF: 0.0025, AUD: 0.60, CZK: 0.040, PLN: 0.23, TRY: 0.028,
  BRL: 0.17, MXN: 0.050, CAD: 0.67, JPY: 0.0061, KRW: 0.00067,
  TWD: 0.029, SGD: 0.68, AED: 0.25, SAR: 0.24, CHF: 1.05,
  SEK: 0.087, NOK: 0.087, DKK: 0.134, RUB: 0.010, ILS: 0.25,
  NZD: 0.55, INR: 0.011, THB: 0.026, PHP: 0.016, IDR: 0.000058,
  MYR: 0.20, VND: 0.000036, RON: 0.20, BGN: 0.51, HRK: 0.13,
};

const SYMBOL_CCY: Record<string, string> = { "$": "USD", "£": "GBP", "€": "EUR", "¥": "JPY" };

const CARD_KEYWORDS = [
  "gift card", "network card", "psn", "xbox", "steam wallet", "google play",
  "itunes", "app store", "nintendo eshop", "amazon", "razer gold", "netflix card",
  "spotify", "roblox", "minecoins",
];

interface MarkupTier { maxFaceEur: number; maxMarkupPct: number; label: string }
const TIERS: MarkupTier[] = [
  { maxFaceEur: 5,        maxMarkupPct: 40, label: "≤ €5" },
  { maxFaceEur: 10,       maxMarkupPct: 30, label: "€5–€10" },
  { maxFaceEur: 25,       maxMarkupPct: 20, label: "€10–€25" },
  { maxFaceEur: 50,       maxMarkupPct: 15, label: "€25–€50" },
  { maxFaceEur: 100,      maxMarkupPct: 10, label: "€50–€100" },
  { maxFaceEur: Infinity, maxMarkupPct: 7,  label: "> €100" },
];

function tierFor(faceEur: number): MarkupTier {
  for (const t of TIERS) if (faceEur <= t.maxFaceEur) return t;
  return TIERS[TIERS.length - 1];
}

function isCardLike(title: string): boolean {
  const lower = title.toLowerCase();
  return CARD_KEYWORDS.some((k) => lower.includes(k));
}

function parseFace(title: string): { faceValue: number; faceCcy: string } | null {
  const m1 = title.match(/(\d+(?:[.,]\d+)?)\s*(EUR|USD|GBP|HKD|ZAR|HUF|AUD|CZK|PLN|TRY|BRL|MXN|CAD|JPY|KRW|TWD|SGD|AED|SAR|CHF|SEK|NOK|DKK|RUB|ILS|NZD|INR|THB|PHP|IDR|MYR|VND|RON|BGN|HRK)\b/i);
  if (m1) return { faceValue: parseFloat(m1[1].replace(",", ".")), faceCcy: m1[2].toUpperCase() };
  const m2 = title.match(/([\$£€¥])\s*(\d+(?:[.,]\d+)?)/);
  if (m2) return { faceValue: parseFloat(m2[2].replace(",", ".")), faceCcy: SYMBOL_CCY[m2[1]] || "USD" };
  return null;
}

export interface OverpricedInfo {
  isOverpriced: boolean;
  markupPct: number;
  capPct: number;
  faceEur: number;
  tierLabel: string;
}

/**
 * Evaluate a gift-card-like product. Returns null when the product is not
 * a recognisable gift card (no face value in title or no card keyword).
 */
export function evaluateOverpricedCard(title: string, sellPrice: number): OverpricedInfo | null {
  if (!title || !(sellPrice > 0)) return null;
  if (!isCardLike(title)) return null;
  const parsed = parseFace(title);
  if (!parsed) return null;
  const rate = FX[parsed.faceCcy];
  if (!rate) return null;
  const faceEur = parsed.faceValue * rate;
  if (!(faceEur > 0)) return null;
  const markupPct = (sellPrice / faceEur - 1) * 100;
  const tier = tierFor(faceEur);
  return {
    isOverpriced: markupPct > tier.maxMarkupPct,
    markupPct,
    capPct: tier.maxMarkupPct,
    faceEur,
    tierLabel: tier.label,
  };
}