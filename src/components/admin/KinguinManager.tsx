import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { pushImportQueueItem, updateImportQueueItem } from "@/lib/importQueueStore";
import { cleanTitle } from "@/lib/cleanTitle";
import { kinguinBuyPrice } from "@/lib/kinguinMarkup";
import { evaluateOverpricedCard } from "@/lib/overpricedCard";
import { usePricingRules } from "@/hooks/usePricingRules";

// Global metadata sync state — survives component unmount/remount
let globalMetadataSync: {
  running: boolean;
  aborted: boolean;
  progress: { current: number; total: number; updated: number; failed: number };
  lastUpdatedAt: number;
  runId: number;
  listeners: Set<(state: typeof globalMetadataSync) => void>;
} = {
  running: false,
  aborted: false,
  progress: { current: 0, total: 0, updated: 0, failed: 0 },
  lastUpdatedAt: Date.now(),
  runId: 0,
  listeners: new Set(),
};

const METADATA_SYNC_STALE_MS = 120_000;

function notifySyncListeners() {
  globalMetadataSync.lastUpdatedAt = Date.now();
  globalMetadataSync.listeners.forEach((fn) => fn({ ...globalMetadataSync }));
}

function isGlobalMetadataSyncStale() {
  return globalMetadataSync.running && Date.now() - globalMetadataSync.lastUpdatedAt > METADATA_SYNC_STALE_MS;
}

function resetGlobalMetadataSyncState() {
  globalMetadataSync.running = false;
  globalMetadataSync.aborted = false;
  globalMetadataSync.progress = { current: 0, total: 0, updated: 0, failed: 0 };
  notifySyncListeners();
}


import { standardizeImageUrl } from "@/lib/imageTransform";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, Plus, Unlink, Loader2, Filter, X, ArrowUp, ArrowDown, ArrowUpDown, CheckSquare, Square, Trash2, Pencil, Clock, Sparkles, Calendar, StopCircle, RefreshCw, Wallet, Ban } from "lucide-react";
import { usePlatformCategories } from "@/hooks/usePlatformCategories";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { classifyGameItem, ITEM_TYPE_LABELS, ITEM_TYPE_COLORS } from "@/lib/gameItemClassifier";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface KinguinProduct {
  kinguinId: number;
  productId: string;
  name: string;
  platform: string;
  price: number;
  qty: number;
  coverImageOriginal?: string;
  screenshots?: string[];
  videoUrl?: string;
  description?: string;
  releaseDate?: string;
  isPreorder?: boolean;
  isNew?: boolean;
  developers?: string[];
  publishers?: string[];
  languages?: string[];
  regionalLimitations?: string;
  platformDetails?: string;
}

function isNewProduct(releaseDate?: string): boolean {
  if (!releaseDate) return false;
  const release = new Date(releaseDate);
  const now = new Date();
  const diffDays = (now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 90; // Released within last 90 days
}

function formatReleaseYear(releaseDate?: string): string | null {
  if (!releaseDate) return null;
  const d = new Date(releaseDate);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear().toString();
}

function isDLC(name: string): boolean {
  return /\bDLC\b/i.test(name);
}

function hasExpiration(name: string): boolean {
  return /valid\s+(until|till|through)/i.test(name);
}

function ProductImage({ src, name, size = "w-10 h-10" }: { src?: string; name: string; size?: string }) {
  const dlc = isDLC(name);
  const exp = hasExpiration(name);
  if (!src) {
    return <div className={`${size} rounded bg-muted flex items-center justify-center text-xs text-muted-foreground relative`}>
      N/A
      {dlc && <span className="absolute top-0 left-0 bg-purple-600 text-white text-[8px] font-bold px-1 rounded-br rounded-tl leading-tight">DLC</span>}
      {exp && <span className="absolute bottom-0 right-0 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-tl rounded-br leading-tight shadow-lg border border-red-400">EXP</span>}
    </div>;
  }
  return (
    <div className={`${size} relative shrink-0`}>
      <img src={src} alt="" className={`${size} rounded object-cover`} />
      {dlc && <span className="absolute top-0 left-0 bg-purple-600 text-white text-[8px] font-bold px-1 rounded-br rounded-tl leading-tight">DLC</span>}
      {exp && <span className="absolute bottom-0 right-0 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-tl rounded-br leading-tight shadow-lg border border-red-400">EXP</span>}
    </div>
  );
}

function ProductBadges({ product }: { product: KinguinProduct }) {
  const year = formatReleaseYear(product.releaseDate);
  const itemType = classifyGameItem(product.name || "");
  const isExp = /valid\s+(until|till|through)|expires?\s+(on|at)/i.test(product.name || "");
  const isGiftCard = /gift\s*card/i.test(product.name || "");
  const isSub = /subscription|\b\d+\s*(day|month|year)s?\b/i.test(product.name || "");
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {product.isPreorder && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-400 bg-amber-500/10">
          <Clock className="h-2.5 w-2.5 mr-0.5" />PRE-ORDER
        </Badge>
      )}
      {product.isNew && !product.isPreorder && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
          <Sparkles className="h-2.5 w-2.5 mr-0.5" />NEW
        </Badge>
      )}
      {itemType !== "base" && (
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ITEM_TYPE_COLORS[itemType]}`}>
          {ITEM_TYPE_LABELS[itemType].toUpperCase()}
        </Badge>
      )}
      {isExp && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/50 text-red-400 bg-red-500/10">
          EXP
        </Badge>
      )}
      {isGiftCard && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-500/50 text-cyan-400 bg-cyan-500/10">
          GIFT CARD
        </Badge>
      )}
      {isSub && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-indigo-500/50 text-indigo-400 bg-indigo-500/10">
          SUB
        </Badge>
      )}
      {year && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground">
          <Calendar className="h-2.5 w-2.5 mr-0.5" />{year}
        </Badge>
      )}
    </div>
  );
}

// Kinguin's catalog is sorted by updatedAt while we page through it, so a
// product whose stock/price gets touched mid-scan can shift pages and come
// back in two separate page fetches — same productId, same everything.
// Collapse those before the UI ever sees them (selection state is keyed by
// productId, so a surviving duplicate pair toggles together).
function dedupeByProductId(products: KinguinProduct[]): KinguinProduct[] {
  const seen = new Set<string>();
  const out: KinguinProduct[] = [];
  for (const p of products) {
    if (seen.has(p.productId)) continue;
    seen.add(p.productId);
    out.push(p);
  }
  return out;
}

function parseKinguinResponse(responseData: any): KinguinProduct[] {
  const normalizeIncomingPlatform = (name: string, platform?: string) => {
    const upperName = (name || "").toUpperCase();
    if (upperName.includes("ROBLOX") || upperName.includes("ROBUX")) {
      return "In-Game Items";
    }
    if (upperName.includes("GOOGLE PLAY")) {
      return "Gift Cards";
    }
    return platform || "PC";
  };

  if (responseData.results) {
    return dedupeByProductId(responseData.results.map((product: any) => {
      const releaseDate = product.releaseDate || undefined;
      const isPreorder = product.isPreorder || product.preOrder || false;
      const screenshots: string[] = (product.images?.screenshots || [])
        .map((s: any) => s.url || s.thumbnail)
        .filter(Boolean);
      const videoUrl = Array.isArray(product.videos) && product.videos.length > 0
        ? (product.videos[0].url || (product.videos[0].video_id ? `https://www.youtube.com/watch?v=${product.videos[0].video_id}` : undefined))
        : undefined;
      return {
        kinguinId: product.kinguinId || 0,
        productId: product.productId || product.kinguinId?.toString() || '',
        name: product.name || '',
        platform: normalizeIncomingPlatform(product.name || '', product.platform),
        price: typeof product.price === 'number' ? product.price : (product.price?.lowestOffer ?? product.price?.amount ?? 0),
        qty: product.qty ?? product.totalQty ?? 0,
        coverImageOriginal: product.images?.cover?.url || product.images?.cover?.thumbnail || undefined,
        screenshots,
        videoUrl,
        description: product.description || product.regionSystemRequirements || undefined,
        releaseDate,
        isPreorder,
        isNew: !isPreorder && isNewProduct(releaseDate),
        developers: Array.isArray(product.developers) ? product.developers : [],
        publishers: Array.isArray(product.publishers) ? product.publishers : [],
        languages: Array.isArray(product.languages) ? product.languages : [],
        regionalLimitations: product.regionalLimitations || undefined,
        platformDetails: product.platform || undefined,
      };
    }));
  }
  if (responseData._embedded?.offerList) {
    return dedupeByProductId(responseData._embedded.offerList.map((offer: any) => ({
      kinguinId: 0,
      productId: offer.productId || offer.id,
      name: offer.name || '',
      platform: normalizeIncomingPlatform(offer.name || '', offer.productDetails?.platform?.name || 'Unknown'),
      price: (offer.price?.amount || 0) / 100,
      qty: offer.availableStock || offer.declaredStock || 0,
      coverImageOriginal: offer.productDetails?.imageUrl || undefined,
      description: offer.description || undefined,
    })));
  }
  return [];
}

interface LinkedProduct {
  kinguin_product_id: string;
}

interface AllowedProduct {
  id: string;
  title: string;
  platform: string;
  store: string;
}

interface ProductFilters {
  name: string;
  platform: string;
  region: string;
  minPrice: string;
  maxPrice: string;
  minStock: string;
  status: string; // "all" | "preorder" | "new" | ""
  type: string; // "" (all) | one of CATALOG_TYPES values
}

const emptyFilters: ProductFilters = { name: "", platform: "", region: "", minPrice: "", maxPrice: "", minStock: "", status: "", type: "" };

// One canonical product category per Kinguin listing, for the Type filter.
// Store-level categories (software / gift card / top-up / subscription /
// in-game item) win over the title-keyword classification, because they come
// from the platform+store detection and describe a whole different kind of
// product; only after those do we fall back to the game item type (DLC,
// edition, skin, currency) and finally plain "game".
const CATALOG_TYPES = [
  { value: "game", label: "Games" },
  { value: "dlc", label: "DLC" },
  { value: "edition", label: "Editions" },
  { value: "skin", label: "Skins" },
  { value: "currency", label: "Currency" },
  { value: "giftcard", label: "Gift Cards" },
  { value: "topup", label: "Top Ups" },
  { value: "subscription", label: "Subscriptions" },
  { value: "software", label: "Software" },
] as const;

const classifyCatalogType = (
  product: { name: string },
  detected: { platform: string; store: string },
): string => {
  const upper = (product.name || "").toUpperCase();
  if (detected.platform === "Software") return "software";
  if (detected.store === "Gift Cards" || /GIFT\s*CARD/.test(upper)) return "giftcard";
  if (detected.store === "Top Ups") return "topup";
  if (detected.store === "Subscriptions" || /\bSUBSCRIPTION\b|GAME PASS|PS PLUS/.test(upper)) return "subscription";
  if (detected.store === "In-Game Items") return "currency";

  const itemType = classifyGameItem(product.name || "");
  if (itemType !== "base") return itemType; // dlc | skin | currency | edition
  return "game";
};

const FilterBar = ({ filters, setFilters, onClear }: { filters: ProductFilters; setFilters: (f: ProductFilters) => void; onClear: () => void }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 p-3 rounded-lg bg-muted/30 border border-border">
    <Input placeholder="Filter by name..." value={filters.name} onChange={(e) => setFilters({ ...filters, name: e.target.value })} className="h-8 text-xs" />
    <select
      value={filters.type}
      onChange={(e) => setFilters({ ...filters, type: e.target.value })}
      className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
    >
      <option value="">All Types</option>
      {CATALOG_TYPES.map((t) => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>
    <Input placeholder="Platform..." value={filters.platform} onChange={(e) => setFilters({ ...filters, platform: e.target.value })} className="h-8 text-xs" />
    <Input placeholder="Region..." value={filters.region} onChange={(e) => setFilters({ ...filters, region: e.target.value })} className="h-8 text-xs" />
    <Input placeholder="Min price" type="number" step="0.01" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} className="h-8 text-xs" />
    <Input placeholder="Max price" type="number" step="0.01" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} className="h-8 text-xs" />
    <select
      value={filters.status}
      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
      className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
    >
      <option value="">All Status</option>
      <option value="preorder">Pre-Order</option>
      <option value="new">New (90 days)</option>
    </select>
    <div className="flex gap-1">
      <Input placeholder="Min stock" type="number" value={filters.minStock} onChange={(e) => setFilters({ ...filters, minStock: e.target.value })} className="h-8 text-xs flex-1" />
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClear}><X className="h-3 w-3" /></Button>
    </div>
  </div>
);

// Region detection from product name
const REGION_CODES: Record<string, string> = {
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
  "KW": "Kuwait", "QA": "Qatar", "BH": "Bahrain", "OM": "Oman",
  "LB": "Lebanon", "JO": "Jordan", "IQ": "Iraq", "EG": "Egypt",
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
  "BT": "Bhutan", "LK": "Sri Lanka", "VE": "Venezuela",
  "SR": "Suriname", "GY": "Guyana", "AM": "Armenia",
  "PA": "Panama", "HN": "Honduras", "GT": "Guatemala",
  "NI": "Nicaragua", "MD": "Moldova", "TM": "Turkmenistan",
  "BY": "Belarus", "SV": "El Salvador", "GE": "Georgia",
  "TJ": "Tajikistan",
  // Currency codes → region
  "CLP": "Chile", "COP": "Colombia", "IDR": "Indonesia", "MVR": "Maldives",
  "VND": "Vietnam", "CRC": "Costa Rica", "UYU": "Uruguay", "UAH": "Ukraine",
  "BRL": "Brazil", "ARS": "Argentina", "MXN": "Mexico", "PEN": "Peru",
  "JPY": "Japan", "KRW": "South Korea", "CNY": "China", "INR": "India",
  "ZAR": "South Africa", "SAR": "Saudi Arabia", "AED": "UAE", "ILS": "Israel",
  "NZD": "New Zealand", "HKD": "Hong Kong", "SGD": "Singapore",
  "THB": "Thailand", "MYR": "Malaysia", "PHP": "Philippines", "TWD": "Taiwan",
  "EUR": "Europe", "GBP": "United Kingdom", "USD": "United States",
  "CAD": "Canada", "AUD": "Australia", "CHF": "Switzerland",
  "SEK": "Sweden", "NOK": "Norway", "DKK": "Denmark",
  "PLN": "Poland", "CZK": "Czech Republic", "HUF": "Hungary",
  "RON": "Romania", "TRY": "Turkey", "BGN": "Bulgaria",
};

// calculateSellPrice is now defined inside the component using usePricingRules hook

const detectRegion = (name: string): string => {
  const upper = name.toUpperCase();
  // Check full country names FIRST (e.g., "Luxembourg", "Bangladesh")
  const COUNTRY_NAMES: Record<string, string> = {
    "UNITED STATES": "United States", "UNITED KINGDOM": "United Kingdom", "NORTH AMERICA": "North America",
    "SOUTH KOREA": "South Korea", "NEW ZEALAND": "New Zealand", "HONG KONG": "Hong Kong",
    "SOUTH AFRICA": "South Africa", "SAUDI ARABIA": "Saudi Arabia", "CZECH REPUBLIC": "Czech Republic",
    "COSTA RICA": "Costa Rica", "SRI LANKA": "Sri Lanka", "EL SALVADOR": "El Salvador",
    "LUXEMBOURG": "Luxembourg", "BANGLADESH": "Bangladesh", "SWITZERLAND": "Switzerland",
    "NETHERLANDS": "Netherlands", "PHILIPPINES": "Philippines", "ARGENTINA": "Argentina",
    "AUSTRALIA": "Australia", "AUSTRIA": "Austria", "AZERBAIJAN": "Azerbaijan", "BAHRAIN": "Bahrain",
    "BELARUS": "Belarus", "BELGIUM": "Belgium", "BELIZE": "Belize", "BHUTAN": "Bhutan",
    "BOLIVIA": "Bolivia", "BRAZIL": "Brazil", "BULGARIA": "Bulgaria", "CANADA": "Canada",
    "CHILE": "Chile", "CHINA": "China", "COLOMBIA": "Colombia", "CROATIA": "Croatia",
    "DENMARK": "Denmark", "ECUADOR": "Ecuador", "EGYPT": "Egypt", "ESTONIA": "Estonia",
    "FINLAND": "Finland", "FRANCE": "France", "GEORGIA": "Georgia", "GERMANY": "Germany",
    "GREECE": "Greece", "GUATEMALA": "Guatemala", "GUYANA": "Guyana", "HONDURAS": "Honduras",
    "HUNGARY": "Hungary", "INDIA": "India", "INDONESIA": "Indonesia", "IRAQ": "Iraq",
    "IRELAND": "Ireland", "ISRAEL": "Israel", "ITALY": "Italy", "JAPAN": "Japan",
    "JORDAN": "Jordan", "KUWAIT": "Kuwait", "LATVIA": "Latvia", "LEBANON": "Lebanon",
    "LIBYA": "Libya", "LITHUANIA": "Lithuania", "MALAYSIA": "Malaysia", "MALDIVES": "Maldives",
    "MEXICO": "Mexico", "MOLDOVA": "Moldova", "MOROCCO": "Morocco", "NEPAL": "Nepal",
    "NICARAGUA": "Nicaragua", "NORWAY": "Norway", "OMAN": "Oman", "PAKISTAN": "Pakistan",
    "PANAMA": "Panama", "PARAGUAY": "Paraguay", "PERU": "Peru", "POLAND": "Poland",
    "PORTUGAL": "Portugal", "QATAR": "Qatar", "ROMANIA": "Romania", "RUSSIA": "Russia",
    "SERBIA": "Serbia", "SINGAPORE": "Singapore", "SLOVAKIA": "Slovakia", "SLOVENIA": "Slovenia",
    "SPAIN": "Spain", "SUDAN": "Sudan", "SURINAME": "Suriname", "SWEDEN": "Sweden",
    "TAIWAN": "Taiwan", "TAJIKISTAN": "Tajikistan", "THAILAND": "Thailand", "TUNISIA": "Tunisia",
    "TURKEY": "Turkey", "TURKMENISTAN": "Turkmenistan", "UKRAINE": "Ukraine", "URUGUAY": "Uruguay",
    "VENEZUELA": "Venezuela", "VIETNAM": "Vietnam", "YEMEN": "Yemen", "ALGERIA": "Algeria",
    "ARMENIA": "Armenia",
  };
  for (const [countryName, region] of Object.entries(COUNTRY_NAMES)) {
    if (upper.includes(countryName)) return region;
  }
  // Check for explicit region patterns like (EU), [EU], - EU, EU Edition, EU Key
  for (const [code, region] of Object.entries(REGION_CODES)) {
    const patterns = [
      new RegExp(`[\\(\\[\\s\\-/]${code}[\\)\\]\\s\\-/,]`, "i"),
      new RegExp(`[\\(\\[\\s\\-/]${code}$`, "i"),
      new RegExp(`\\b${code}\\s+(Edition|Version|Key|Code|Steam|CD)\\b`, "i"),
    ];
    if (patterns.some((p) => p.test(` ${upper} `))) {
      return region;
    }
  }
  return "Global";
};

// Platform & store auto-detection from Kinguin platform field and product name
const detectPlatformAndStore = (kinguinPlatform: string, name: string, autoGroups?: { keyword: string; target_page: string }[]): { platform: string; store: string } => {
  const upper = name.toUpperCase();
  const plat = kinguinPlatform?.toUpperCase() || "";

  // Roblox / Robux → In-Game Items
  if (upper.includes("ROBLOX") || upper.includes("ROBUX")) {
    return { platform: "PC", store: "In-Game Items" };
  }

  // Windows OS keys → Software / Windows
  const windowsOSMarkers = [
    "RETAIL KEY", "PROFESSIONAL", " PRO ", "HOME", "ENTERPRISE", "EDUCATION",
    "OEM", "ACTIVATION", "LICENSE", "WINDOWS KEY", "WINDOWS CD KEY", "WINDOWS STORE",
  ];
  if (upper.includes("WINDOWS") && windowsOSMarkers.some((m) => upper.includes(m))) {
    return { platform: "Software", store: "Windows" };
  }

  // Anti-Virus detection
  const antivirusMarkers = ["ANTIVIRUS", "ANTI-VIRUS", "BITDEFENDER", "KASPERSKY", "NORTON", "AVAST", "ESET", "MCAFEE", "MALWAREBYTES"];
  if (antivirusMarkers.some(m => upper.includes(m))) {
    return { platform: "Software", store: "Anti-Virus" };
  }

  // Microsoft Office → Software / Office. Same rule AdminProductSuggestions
  // uses for Discover routing, so both import paths classify Office alike
  // (without it, Office lands in the catalog's "Games" type filter).
  if (/\bOFFICE\b/.test(upper) && /\b(MICROSOFT|MS|PRO|PROFESSIONAL|HOME|STUDENT|PLUS|STANDARD|2016|2019|2021|2024|365)\b/.test(upper)) {
    return { platform: "Software", store: "Office" };
  }

  // PlayStation
  if (plat.includes("PLAYSTATION") || plat.includes("PSN") || plat.includes("PS4") || plat.includes("PS5") ||
      upper.includes("PSN") || upper.includes("PS4") || upper.includes("PS5") || upper.includes("PLAYSTATION")) {
    if (
      upper.includes("TOP UP") ||
      upper.includes("TOPUP") ||
      upper.includes("WALLET") ||
      upper.includes("GIFT CARD") ||
      upper.includes("PSN CARD") ||
      upper.includes("NETWORK CARD") ||
      upper.includes("PS STORE CARD")
    ) {
      return { platform: "PlayStation", store: "Top Ups" };
    }
    if (upper.includes("PS PLUS") || upper.includes("PS+") || upper.includes("PLAYSTATION PLUS") || upper.includes("SUBSCRIPTION") || upper.includes("EA PLAY")) {
      return { platform: "PlayStation", store: "Subscriptions" };
    }
    return { platform: "PlayStation", store: "Games" };
  }

  // Xbox
  if (plat.includes("XBOX") || upper.includes("XBOX")) {
    if (upper.includes("TOP UP") || upper.includes("TOPUP") || upper.includes("GIFT CARD") || upper.includes("WALLET")) {
      return { platform: "Xbox", store: "Top Ups" };
    }
    if (upper.includes("GAME PASS") || upper.includes("SUBSCRIPTION") || upper.includes("EA PLAY") || upper.includes("XBOX LIVE GOLD")) {
      return { platform: "Xbox", store: "Subscriptions" };
    }
    return { platform: "Xbox", store: "Games" };
  }

  // Nintendo
  if (plat.includes("NINTENDO") || plat.includes("SWITCH") || upper.includes("NINTENDO") || upper.includes("SWITCH")) {
    if (upper.includes("TOP UP") || upper.includes("TOPUP") || upper.includes("ESHOP") || upper.includes("GIFT CARD")) {
      return { platform: "Nintendo", store: "Top Ups" };
    }
    if (upper.includes("ONLINE") || upper.includes("SUBSCRIPTION") || upper.includes("MEMBERSHIP")) {
      return { platform: "Nintendo", store: "Subscriptions" };
    }
    return { platform: "Nintendo", store: "Games" };
  }

  // PC platforms
  if (upper.includes("EPIC GAMES") || upper.includes("EPIC STORE")) return { platform: "PC", store: "Epic Games" };
  if (upper.includes("GOG")) return { platform: "PC", store: "GOG" };
  if (upper.includes("UBISOFT") || upper.includes("UPLAY")) return { platform: "PC", store: "Ubisoft" };
  if (upper.includes("EA APP") || upper.includes("EA PLAY") || plat.includes("ORIGIN") || plat === "EA") return { platform: "PC", store: "EA Games" };
  if (upper.includes("BATTLE.NET") || upper.includes("BLIZZARD") || upper.includes("BATTLENET")) return { platform: "PC", store: "Blizzard" };
  if (upper.includes("ROCKSTAR") || upper.includes("SOCIAL CLUB")) return { platform: "PC", store: "Rockstar" };
  if (upper.includes("MICROSOFT STORE")) return { platform: "PC", store: "Microsoft Store" };

  // Default to Steam for PC
  if (plat.includes("PC") || plat.includes("STEAM") || upper.includes("STEAM")) {
    return { platform: "PC", store: "Steam" };
  }

  // DB-driven auto-groups detection — fallback only, so base games on
  // Xbox/PS/Nintendo/Steam are never misclassified by a brand keyword
  // (e.g. "Minecraft" auto-group shouldn't turn Xbox Minecraft Legends into In-Game Items).
  if (autoGroups) {
    for (const ag of autoGroups) {
      if (upper.includes(ag.keyword.toUpperCase())) {
        return { platform: ag.target_page, store: ag.target_page };
      }
    }
  }

  return { platform: kinguinPlatform || "PC", store: "Steam" };
};

const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\$/g, " usd ")
    .replace(/€/g, " eur ")
    .replace(/£/g, " gbp ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STRICT_FILTER_TERMS = new Set([
  "us", "eu", "uk", "usd", "eur", "gbp", "aed", "sar", "qa", "kw", "bh", "om", "lb", "jo", "iq", "eg",
]);

// Aliases so short codes also match full country/region names in cleaned titles
const TERM_ALIASES: Record<string, string[]> = {
  "us": ["united", "states"],
  "uk": ["united", "kingdom"],
  "eu": ["europe"],
  "sa": ["saudi", "arabia"],
  "ae": ["uae"],
  "uae": ["ae"],
};

const matchesSearchQuery = (name: string, query: string): boolean => {
  const normalizedName = normalizeSearchText(name);
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const tokenSet = new Set(normalizedName.split(" ").filter(Boolean));

  return terms.every((term) => {
    if (term.length <= 2 || STRICT_FILTER_TERMS.has(term)) {
      // Check exact token match OR alias expansion
      if (tokenSet.has(term)) return true;
      const aliases = TERM_ALIASES[term];
      if (aliases) return aliases.every((a) => normalizedName.includes(a));
      return false;
    }
    return tokenSet.has(term) || normalizedName.includes(term);
  });
};

type SortKey = "name" | "platform" | "price" | "qty" | "releaseYear";
type SortDir = "asc" | "desc";
interface SortState { key: SortKey; dir: SortDir }

const applyFilters = (products: KinguinProduct[], filters: ProductFilters, autoGroups?: { keyword: string; target_page: string }[]): KinguinProduct[] => {
  return products.filter((p) => {
    const detected = detectPlatformAndStore(p.platform, p.name, autoGroups);
    const platformLabel = `${detected.platform} ${detected.store}`.toLowerCase();
    const rawPlatform = (p.platform || "").toLowerCase();

    if (filters.name && !matchesSearchQuery(p.name, filters.name)) return false;
    if (filters.platform) {
      const platformFilter = filters.platform.toLowerCase();
      if (!platformLabel.includes(platformFilter) && !rawPlatform.includes(platformFilter)) return false;
    }
    if (filters.region) {
      const region = detectRegion(p.name).toLowerCase();
      if (!region.includes(filters.region.toLowerCase())) return false;
    }
    if (filters.type && classifyCatalogType(p, detected) !== filters.type) return false;
    if (filters.minPrice && p.price < parseFloat(filters.minPrice)) return false;
    if (filters.maxPrice && p.price > parseFloat(filters.maxPrice)) return false;
    if (filters.minStock && p.qty < parseInt(filters.minStock)) return false;
    if (filters.status === "preorder" && !p.isPreorder) return false;
    if (filters.status === "new" && !p.isNew) return false;
    return true;
  });
};

const applySorting = (products: KinguinProduct[], sort: SortState | null): KinguinProduct[] => {
  if (!sort) return products;
  const sorted = [...products].sort((a, b) => {
    if (sort.key === "releaseYear") {
      const yearA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const yearB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return sort.dir === "asc" ? yearA - yearB : yearB - yearA;
    }
    const valA = a[sort.key];
    const valB = b[sort.key];
    if (typeof valA === "string" && typeof valB === "string") {
      return sort.dir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sort.dir === "asc" ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
  });
  return sorted;
};

export const KinguinManager = () => {
  const { categories: PLATFORM_CATEGORIES, getSubPlatforms } = usePlatformCategories();
  const { calculate, getMargin, loading: pricingLoading } = usePricingRules();
  
  const calculateSellPrice = useCallback((kinguinCost: number): number => {
    const result = calculate(kinguinBuyPrice(kinguinCost));
    return result.finalPrice;
  }, [calculate]);

  const getMarginLabel = useCallback((kinguinCost: number): string => {
    const adjustedCost = kinguinBuyPrice(kinguinCost);
    const margin = getMargin(adjustedCost);
    return `${(margin * 100).toFixed(1)}%`;
  }, [getMargin]);

  const [generatingDescriptions, setGeneratingDescriptions] = useState(false);
  const [paraphraseProgress, setParaphraseProgress] = useState({ pending: 0, processing: 0, completed: 0, failed: 0, total: 0 });
  const [missingDescCount, setMissingDescCount] = useState(0);
  const [lastImportIds, setLastImportIds] = useState<string[]>([]);
  const [activeParaphraseBatchId, setActiveParaphraseBatchId] = useState<string | null>(null);
  const [syncingMetadata, setSyncingMetadata] = useState(globalMetadataSync.running);
  const [metadataPlatformFilter, setMetadataPlatformFilter] = useState<string>("all");
  const [metadataProgress, setMetadataProgress] = useState(globalMetadataSync.progress);
  const [metadataSyncStats, setMetadataSyncStats] = useState<{ full: number; partial: number; none: number } | null>(null);
  const [loadingSyncStats, setLoadingSyncStats] = useState(false);

  // Subscribe to global sync state changes
  useEffect(() => {
    const handler = (state: typeof globalMetadataSync) => {
      setSyncingMetadata(state.running);
      setMetadataProgress({ ...state.progress });
    };
    globalMetadataSync.listeners.add(handler);
    if (isGlobalMetadataSyncStale()) {
      resetGlobalMetadataSyncState();
    }
    // Sync current state on mount
    if (globalMetadataSync.running) {
      setSyncingMetadata(true);
      setMetadataProgress({ ...globalMetadataSync.progress });
    }
    return () => { globalMetadataSync.listeners.delete(handler); };
  }, []);

  const fetchMetadataSyncStats = useCallback(async () => {
    setLoadingSyncStats(true);
    try {
      const { data: fullData, count: fullCount } = await supabase
        .from("allowed_products")
        .select("id", { count: "exact", head: true })
        .eq("metadata_sync_status", "full");
      const { data: partialData, count: partialCount } = await supabase
        .from("allowed_products")
        .select("id", { count: "exact", head: true })
        .eq("metadata_sync_status", "partial_kinguin");
      const { data: noneData, count: noneCount } = await supabase
        .from("allowed_products")
        .select("id", { count: "exact", head: true })
        .or("metadata_sync_status.is.null,metadata_sync_status.eq.partial_error");
      setMetadataSyncStats({
        full: fullCount ?? 0,
        partial: partialCount ?? 0,
        none: noneCount ?? 0,
      });
    } catch (e) {
      console.error("Failed to fetch sync stats", e);
    } finally {
      setLoadingSyncStats(false);
    }
  }, []);

  useEffect(() => { fetchMetadataSyncStats(); }, [fetchMetadataSyncStats]);

  const queuePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialSearchQuery = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("q") || ""
    : "";
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<KinguinProduct[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const [catalogProducts, setCatalogProducts] = useState<KinguinProduct[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotalCount, setCatalogTotalCount] = useState(0);
  const [linkedProducts, setLinkedProducts] = useState<LinkedProduct[]>([]);
  const [allowedProducts, setAllowedProducts] = useState<AllowedProduct[]>([]);
  const [autoGroupRules, setAutoGroupRules] = useState<{ keyword: string; target_page: string }[]>([]);
  const [kinguinBalance, setKinguinBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [manuallyBlockedIds, setManuallyBlockedIds] = useState<Set<string>>(new Set());
  const [importingSoftware, setImportingSoftware] = useState<null | "windows" | "office" | "anti-virus">(null);

  const importSoftwareCatalog = useCallback(async (kind: "windows" | "office" | "anti-virus") => {
    setImportingSoftware(kind);
    try {
      const queries = kind === "windows"
        ? ["Windows 11", "Windows 10", "Microsoft Windows"]
        : kind === "office"
        ? ["Microsoft Office 2021", "Microsoft Office 2019", "Microsoft Office 365"]
        : ["Bitdefender", "Kaspersky", "Norton", "Avast Antivirus", "ESET"];
      let totalAdded = 0;
      let totalSkipped = 0;
      let totalBlocked = 0;
      for (const query of queries) {
        const { data, error } = await supabase.functions.invoke("kinguin-bulk-import", {
          body: { query, maxPages: 3, skipParaphrase: true, categoryOverride: kind },
        });
        if (error) throw error;
        totalAdded += (data as any)?.added ?? 0;
        totalSkipped += (data as any)?.skipped ?? 0;
        totalBlocked += (data as any)?.blocked ?? 0;
      }
      toast.success(
        `${kind === "windows" ? "Windows" : kind === "office" ? "Office" : "Anti-Virus"} import complete — added ${totalAdded}, skipped ${totalSkipped}, blocked ${totalBlocked}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      toast.error(msg);
    } finally {
      setImportingSoftware(null);
    }
  }, []);

  // Fetch Kinguin balance
  const fetchBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('kinguin-balance');
      if (error) throw error;
      if (data?.balance !== undefined) setKinguinBalance(data.balance);
    } catch (err) {
      console.error('Failed to fetch Kinguin balance:', err);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  // Fetch auto-group rules from DB
  useEffect(() => {
    supabase
      .from("collections")
      .select("auto_group_keyword, target_page")
      .eq("is_active", true)
      .not("auto_group_keyword", "is", null)
      .then(({ data }) => {
        if (data) {
          setAutoGroupRules(
            (data as any[])
              .filter((c) => c.auto_group_keyword?.trim())
              .map((c) => ({ keyword: c.auto_group_keyword, target_page: c.target_page }))
          );
        }
      });
    fetchBalance();
  }, []);

  // Wrapper that injects auto-groups
  const detect = useCallback((kinguinPlatform: string, name: string) => {
    return detectPlatformAndStore(kinguinPlatform, name, autoGroupRules);
  }, [autoGroupRules]);

  const [saving, setSaving] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addProduct, setAddProduct] = useState<KinguinProduct | null>(null);
  const [addName, setAddName] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addExpiration, setAddExpiration] = useState("");
  const [catalogPageSize, setCatalogPageSize] = useState(50);
  const CATALOG_PAGE_SIZE = catalogPageSize;
  const SEARCH_PAGE_SIZE = catalogPageSize;

  const [catalogFilters, setCatalogFilters] = useState<ProductFilters>(emptyFilters);
  const [searchFilters, setSearchFilters] = useState<ProductFilters>(emptyFilters);
  const [showCatalogFilters, setShowCatalogFilters] = useState(false);
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const [catalogSort, setCatalogSort] = useState<SortState | null>(null);
  const [searchSort, setSearchSort] = useState<SortState | null>(null);

  // Multi-select state
  const [selectedCatalog, setSelectedCatalog] = useState<Set<string>>(new Set());
  const [selectedSearch, setSelectedSearch] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
   const [hideAdded, setHideAdded] = useState(false);
  const [hideBlocked, setHideBlocked] = useState(false);
  const [hideDlc, setHideDlc] = useState(false);
  const [hideOverpriced, setHideOverpriced] = useState(false);
  // Bulk import override controls
  const [bulkPlatform, setBulkPlatform] = useState("");
  const [bulkStore, setBulkStore] = useState("");
  const [bulkTab, setBulkTab] = useState("");
  const [bulkCollection, setBulkCollection] = useState("");
  const [availableCollections, setAvailableCollections] = useState<{id: string; name: string}[]>([]);
  const [fullCatalogCache, setFullCatalogCache] = useState<KinguinProduct[] | null>(null);
  const [fullCatalogLoading, setFullCatalogLoading] = useState(false);

  const toggleSelection = (set: Set<string>, setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllSelection = (ids: string[], selected: Set<string>, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const allSelected = ids.every((id) => selected.has(id));
    if (allSelected) {
      setter(new Set());
    } else {
      setter(new Set(ids));
    }
  };

  const toggleSort = (setter: React.Dispatch<React.SetStateAction<SortState | null>>, key: SortKey) => {
    setter((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
    setDisplayPage(1);
  };

  const SortIcon = ({ sortState, column }: { sortState: SortState | null; column: SortKey }) => {
    if (!sortState || sortState.key !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortState.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchManuallyBlocked = useCallback(async () => {
    const { data } = await supabase.from("blocked_kinguin_products" as any).select("kinguin_product_id");
    if (data) setManuallyBlockedIds(new Set((data as any[]).map((d: any) => d.kinguin_product_id)));
  }, []);

  const handleManualBlock = async (product: KinguinProduct) => {
    const { error } = await supabase.from("blocked_kinguin_products" as any).insert({
      kinguin_product_id: product.productId,
      product_name: product.name,
    } as any);
    if (error) {
      if (error.message.includes("duplicate")) toast.info("Already blocked");
      else toast.error("Failed to block");
      return;
    }
    toast.success(`"${product.name}" blocked`);
    setManuallyBlockedIds(prev => new Set(prev).add(product.productId));
  };

  const handleManualUnblock = async (productId: string) => {
    const { error } = await supabase.from("blocked_kinguin_products" as any).delete().eq("kinguin_product_id", productId);
    if (error) { toast.error("Failed to unblock"); return; }
    toast.success("Product unblocked");
    setManuallyBlockedIds(prev => { const next = new Set(prev); next.delete(productId); return next; });
  };

  useEffect(() => {
    fetchLinked();
    fetchAllowed();
    fetchManuallyBlocked();
    // Fetch collections for bulk import
    supabase.from("collections").select("id, name").order("name").then(({ data }) => {
      if (data) setAvailableCollections(data);
    });
    loadKinguinCatalog();
    fetchMissingDescCount();
    pollQueueStatus();
    return () => {
      if (queuePollRef.current) clearInterval(queuePollRef.current);
    };
  }, []);

  // Detect if sort/filter is active on catalog (not search)
  const hasCatalogSortOrFilter = hideAdded || hideBlocked || hideDlc || hideOverpriced || catalogSort !== null ||
    catalogFilters.name !== "" || catalogFilters.platform !== "" ||
    catalogFilters.region !== "" || catalogFilters.minPrice !== "" ||
    catalogFilters.maxPrice !== "" || catalogFilters.minStock !== "" ||
    catalogFilters.status !== "" || catalogFilters.type !== "";

  // Load full catalog when sort/filter is active
  useEffect(() => {
    if (!hasCatalogSortOrFilter) {
      setFullCatalogCache(null);
      return;
    }
    if (fullCatalogCache || fullCatalogLoading) return;
    const loadFullCatalog = async () => {
      setFullCatalogLoading(true);
      try {
        const { data: responseData, error } = await supabase.functions.invoke("kinguin-search", {
          body: { fullScan: true, limit: 100 },
        });
        if (error) throw error;
        if (responseData?.error) throw new Error(responseData.error);
        const parsed = parseKinguinResponse(responseData);
        setFullCatalogCache(parsed);
        toast.success(`Loaded ${parsed.length.toLocaleString()} products for cross-page filtering`);
      } catch (err: any) {
        console.error("Failed to load full catalog:", err.message);
        toast.error("Failed to load full catalog for filtering");
      } finally {
        setFullCatalogLoading(false);
      }
    };
    loadFullCatalog();
  }, [hasCatalogSortOrFilter, hideAdded]);

  // Debounced auto-search: trigger search 500ms after user stops typing
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      // Clear results when search is emptied or too short
      if (results.length > 0 && !searchQuery.trim()) {
        setResults([]);
        setSearchTotalCount(0);
        setSearchPage(1);
        setSelectedSearch(new Set());
        setDisplayPage(1);
      }
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      handleSearch();
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  // Re-run search with full loading when any hide-filter is toggled on during an active search
  useEffect(() => {
    if ((hideAdded || hideDlc || hideBlocked || hideOverpriced) && results.length > 0 && searchTotalCount > results.length && searchQuery.trim()) {
      handleSearch(1, true);
    }
  }, [hideAdded, hideDlc, hideBlocked, hideOverpriced]);

  const fetchMissingDescCount = async () => {
    // Count products not yet paraphrased
    const { count: notParaphrased } = await supabase
      .from("allowed_products")
      .select("id", { count: "exact", head: true })
      .eq("description_paraphrased", false as any)
      .not("description", "is", null);
    
    // Count products marked paraphrased but still containing marketplace names (bad paraphrase)
    const { data: paraphrased } = await supabase
      .from("allowed_products")
      .select("id, description")
      .eq("description_paraphrased", true as any)
      .not("description", "is", null)
      .limit(500);
    
    const marketplaceNames = ["kinguin", "g2a", "eneba", "cdkeys", "instant gaming", "kinguin.net", "g2a.com"];
    const badCount = (paraphrased || []).filter((p: any) => {
      if (!p.description) return false;
      const lower = p.description.toLowerCase();
      return marketplaceNames.some(name => lower.includes(name));
    }).length;

    setMissingDescCount((notParaphrased || 0) + badCount);
  };

  const pollQueueStatus = async (batchId?: string) => {
    // Check current queue state
    const updateProgress = async () => {
      let query = supabase
        .from("paraphrase_queue")
        .select("status, batch_id")
        .order("created_at", { ascending: false });

      if (batchId) {
        query = query.eq("batch_id", batchId);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        setGeneratingDescriptions(false);
        setParaphraseProgress({ pending: 0, processing: 0, completed: 0, failed: 0, total: 0 });
        setActiveParaphraseBatchId(null);
        if (queuePollRef.current) {
          clearInterval(queuePollRef.current);
          queuePollRef.current = null;
        }
        return;
      }

      const pending = data.filter((r: any) => r.status === "pending").length;
      const processing = data.filter((r: any) => r.status === "processing").length;
      const completed = data.filter((r: any) => r.status === "completed").length;
      const failed = data.filter((r: any) => r.status === "failed").length;
      const total = data.length;

      setParaphraseProgress({ pending, processing, completed, failed, total });

      if (pending > 0 || processing > 0) {
        setGeneratingDescriptions(true);
        if (!queuePollRef.current) {
          queuePollRef.current = setInterval(() => {
            updateProgress();
          }, 8000);
        }
      } else {
        setGeneratingDescriptions(false);
        setActiveParaphraseBatchId(null);
        if (queuePollRef.current) {
          clearInterval(queuePollRef.current);
          queuePollRef.current = null;
        }

        if (completed > 0) {
          fetchMissingDescCount();
          fetchAllowed();
          toast.success(`Paraphrasing complete: ${completed} succeeded${failed > 0 ? `, ${failed} failed` : ""}`);
          await supabase.from("paraphrase_queue").delete().eq("batch_id", batchId ?? "");
        }
      }
    };

    await updateProgress();
  };

  const handleSyncMetadata = async () => {
    if (isGlobalMetadataSyncStale()) {
      resetGlobalMetadataSyncState();
    }
    if (globalMetadataSync.running) {
      toast.info("Metadata sync is already running...");
      return;
    }
    const syncRunId = globalMetadataSync.runId + 1;
    globalMetadataSync.runId = syncRunId;
    globalMetadataSync.running = true;
    globalMetadataSync.aborted = false;
    globalMetadataSync.progress = { current: 0, total: 0, updated: 0, failed: 0 };
    notifySyncListeners();

    const isCurrentRun = () => globalMetadataSync.runId === syncRunId;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const platformCondition = metadataPlatformFilter !== "all" ? metadataPlatformFilter : null;

      // ── Phase 1: Regular sync (products without any sync status) ──
      let missingIds: string[] = [];
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        let query = supabase
          .from("allowed_products")
          .select("id")
          .or("metadata_sync_status.is.null,metadata_sync_status.eq.partial_error");
        if (platformCondition) query = query.eq("platform", platformCondition);
        const { data } = await query.range(offset, offset + PAGE - 1);
        if (!data || data.length === 0) break;
        missingIds = missingIds.concat(data.map((d: any) => d.id));
        if (data.length < PAGE) break;
        offset += PAGE;
      }

      let totalUpdated = 0;
      let totalFailed = 0;
      const BATCH = 50;

      if (missingIds.length > 0) {
        const total = missingIds.length;
        if (!isCurrentRun()) return;
        globalMetadataSync.progress = { current: 0, total, updated: 0, failed: 0 };
        notifySyncListeners();

        for (let i = 0; i < missingIds.length; i += BATCH) {
          if (globalMetadataSync.aborted || !isCurrentRun()) break;
          const chunk = missingIds.slice(i, i + BATCH);
          try {
            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), 120_000);
            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kinguin-batch-metadata`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ productIds: chunk }),
                signal: ctrl.signal,
              }
            ).finally(() => clearTimeout(timeoutId));
            if (res.ok) {
              const result = await res.json();
              totalUpdated += result.updated || 0;
              totalFailed += result.errors || 0;
            } else {
              totalFailed += chunk.length;
            }
          } catch {
            totalFailed += chunk.length;
          }
          globalMetadataSync.progress = {
            current: Math.min(i + BATCH, total),
            total,
            updated: totalUpdated,
            failed: totalFailed,
          };
          notifySyncListeners();
        }

        if (isCurrentRun()) {
          toast.success(`Phase 1 — Sync: ${totalUpdated} updated, ${totalFailed} failed out of ${missingIds.length}`);
        }
      }

      if (globalMetadataSync.aborted || !isCurrentRun()) {
        globalMetadataSync.running = false;
        notifySyncListeners();
        return;
      }

      // ── Phase 2: Enrich partial_kinguin products with missing fields ──
      let enrichIds: string[] = [];
      offset = 0;
      while (true) {
        let query = supabase
          .from("allowed_products")
          .select("id, developers, publishers, release_date, system_requirements")
          .eq("metadata_sync_status", "partial_kinguin");
        if (platformCondition) query = query.eq("platform", platformCondition);
        const { data } = await query.range(offset, offset + PAGE - 1);
        if (!data || data.length === 0) break;
        // Only include products that actually have missing fields
        const needsEnrich = data.filter((d: any) =>
          (!d.developers || d.developers.length === 0) ||
          (!d.publishers || d.publishers.length === 0) ||
          !d.release_date ||
          !d.system_requirements
        );
        enrichIds = enrichIds.concat(needsEnrich.map((d: any) => d.id));
        if (data.length < PAGE) break;
        offset += PAGE;
      }

      if (enrichIds.length > 0) {
        if (!isCurrentRun()) return;
        toast.info(`Phase 2 — Enriching ${enrichIds.length} products with missing fields...`);
        const enrichTotal = enrichIds.length;
        let enriched = 0;
        let enrichErrors = 0;

        globalMetadataSync.progress = { current: 0, total: enrichTotal, updated: totalUpdated, failed: totalFailed };
        notifySyncListeners();

        for (let i = 0; i < enrichIds.length; i += BATCH) {
          if (globalMetadataSync.aborted || !isCurrentRun()) break;
          const chunk = enrichIds.slice(i, i + BATCH);
          try {
            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), 120_000);
            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kinguin-enrich-metadata`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ productIds: chunk }),
                signal: ctrl.signal,
              }
            ).finally(() => clearTimeout(timeoutId));
            if (res.ok) {
              const result = await res.json();
              enriched += result.enriched || 0;
              enrichErrors += result.errors || 0;
            } else {
              enrichErrors += chunk.length;
            }
          } catch {
            enrichErrors += chunk.length;
          }
          globalMetadataSync.progress = {
            current: Math.min(i + BATCH, enrichTotal),
            total: enrichTotal,
            updated: totalUpdated + enriched,
            failed: totalFailed + enrichErrors,
          };
          notifySyncListeners();
        }

        if (isCurrentRun()) {
          toast.success(`Phase 2 — Enriched: ${enriched} products, ${enrichErrors} errors out of ${enrichTotal}`);
        }
        totalUpdated += enriched;
        totalFailed += enrichErrors;
      } else if (missingIds.length === 0 && isCurrentRun()) {
        toast.info("All products already have complete metadata!");
      }

      if ((missingIds.length > 0 || enrichIds.length > 0) && isCurrentRun()) {
        toast.success(`Total: ${totalUpdated} updated, ${totalFailed} failed`);
        fetchMetadataSyncStats();
      }
    } catch (err: any) {
      if (isCurrentRun()) {
        toast.error(`Metadata sync failed: ${err.message}`);
      }
    } finally {
      if (isCurrentRun()) {
        globalMetadataSync.running = false;
        notifySyncListeners();
      }
    }
  };

  const handleGenerateDescriptions = async () => {
    setGeneratingDescriptions(true);

    try {
      // Step 1: Get list of products needing paraphrasing
      const listBody: Record<string, unknown> = { action: "list" };
      if (lastImportIds.length > 0) {
        listBody.product_ids = lastImportIds;
      }

      const listRes = await supabase.functions.invoke("generate-descriptions", { body: listBody });
      if (listRes.error) throw new Error(listRes.error.message);

      const listData = (listRes.data as { products?: Array<{ id: string }> } | null) ?? null;
      const products = listData?.products || [];
      if (products.length === 0) {
        toast.info("All descriptions are already paraphrased!");
        setGeneratingDescriptions(false);
        return;
      }

      // Step 2: Insert all into the queue with a shared batch_id
      const batchId = crypto.randomUUID();
      setActiveParaphraseBatchId(batchId);
      setParaphraseProgress({ pending: products.length, processing: 0, completed: 0, failed: 0, total: products.length });

      const rows = products.map((p) => ({
        allowed_product_id: p.id,
        batch_id: batchId,
        status: "pending",
      }));

      // Insert in chunks of 50
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50);
        const { error: insertError } = await supabase.from("paraphrase_queue").insert(chunk);
        if (insertError) throw new Error(insertError.message);
      }

      toast.success(`Queued ${products.length} products for paraphrasing. Processing will continue in the background.`);
      if (lastImportIds.length > 0) setLastImportIds([]);

      // Step 3: Trigger the processor immediately once
      supabase.functions.invoke("process-paraphrase-queue", { body: {} }).catch(() => {});

      // Step 4: Start polling for this batch only
      pollQueueStatus(batchId);
    } catch (err: any) {
      toast.error("Failed to queue: " + err.message);
      setGeneratingDescriptions(false);
    }
  };

  const handleStopParaphrase = async () => {
    if (queuePollRef.current) {
      clearInterval(queuePollRef.current);
      queuePollRef.current = null;
    }

    let deleteQuery = supabase.from("paraphrase_queue").delete().in("status", ["pending", "processing", "completed", "failed"]);
    if (activeParaphraseBatchId) {
      deleteQuery = deleteQuery.eq("batch_id", activeParaphraseBatchId);
    }
    await deleteQuery;

    setGeneratingDescriptions(false);
    setActiveParaphraseBatchId(null);
    setParaphraseProgress({ pending: 0, processing: 0, completed: 0, failed: 0, total: 0 });
    toast.success("Paraphrase queue stopped and cleared");
    fetchMissingDescCount();
    fetchAllowed();
  };

  // Paginated fetch — kinguin_products now has ~20k rows, and a plain
  // .select() without .range() gets silently capped by PostgREST's default
  // row limit. That truncation made isAlreadyLinked() (and therefore "Hide
  // Added") miss most already-imported products: they'd fail the check and
  // still show as addable even though they genuinely exist (confirmed by a
  // duplicate-key error on re-add). Only kinguin_product_id is ever read
  // from these rows, so fetch just that column to keep the paginated fetch
  // light despite the row count.
  const fetchLinked = async () => {
    const PAGE = 1000;
    let all: LinkedProduct[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("kinguin_products")
        .select("kinguin_product_id")
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) { console.error("fetchLinked failed:", error.message); break; }
      if (!data || data.length === 0) break;
      all = all.concat(data as any);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setLinkedProducts(all);
  };

  const loadKinguinCatalog = async (page = 1, retryCount = 0, overrideLimit?: number) => {
    setLoadingCatalog(true);
    const limit = overrideLimit || CATALOG_PAGE_SIZE;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        if (retryCount < 2) {
          setTimeout(() => loadKinguinCatalog(page, retryCount + 1, limit), 1500);
          return;
        }
        throw new Error('Not authenticated — please sign in again');
      }

      const { data: responseData, error } = await supabase.functions.invoke("kinguin-search", {
        body: { page, limit },
      });
      if (error) throw error;
      if (responseData?.error) throw new Error(responseData.error);
      setCatalogProducts(parseKinguinResponse(responseData));
      setCatalogTotalCount(responseData.item_count || 0);
      setCatalogPage(page);
    } catch (err: any) {
      console.error("Failed to load Kinguin catalog:", err.message);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const fetchAllowed = async () => {
    let all: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data } = await supabase
        .from("allowed_products")
        .select("id, title, platform, store")
        .order("created_at", { ascending: false })
        .range(from, from + batchSize - 1);
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    setAllowedProducts(all);
  };

  const handleSearch = async (page = 1, loadAll = false) => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    if (page === 1) { setResults([]); setDisplayPage(1); }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated — please sign in again');
      const token = session.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      
      if (loadAll || hideAdded || hideDlc || hideBlocked || hideOverpriced) {
        // Load all pages for hideAdded filtering
        let allResults: KinguinProduct[] = [];
        let currentPage = 1;
        let totalCount = 0;
        while (true) {
          const { data: responseData, error } = await supabase.functions.invoke("kinguin-search", {
            body: { query: searchQuery, page: currentPage, limit: SEARCH_PAGE_SIZE },
          });
          if (error) throw error;
          if (responseData.error) throw new Error(responseData.error);
          const parsed = parseKinguinResponse(responseData);
          totalCount = responseData.item_count || 0;
          allResults = allResults.concat(parsed);
          if (allResults.length >= totalCount || parsed.length < SEARCH_PAGE_SIZE) break;
          currentPage++;
        }
        setResults(allResults);
        setSearchTotalCount(allResults.length);
        setSearchPage(1);
        setDisplayPage(1);
        toast.success(`Loaded all ${allResults.length.toLocaleString()} search results for filtering`);
      } else {
        const { data: responseData, error } = await supabase.functions.invoke("kinguin-search", {
          body: { query: searchQuery, page, limit: SEARCH_PAGE_SIZE },
        });
        if (error) throw error;
        if (responseData.error) throw new Error(responseData.error);
        const parsed = parseKinguinResponse(responseData);
        setResults(parsed);
        setSearchTotalCount(responseData.item_count || 0);
        setSearchPage(page);
        if (responseData.total_scanned) {
          toast.info(`Scanned ${responseData.total_scanned} products, found ${parsed.length} matches`);
        }
      }
      if (!results.length && page === 1) {
        toast.info("No products found on Kinguin");
      }
    } catch (err: any) {
      toast.error("Search failed: " + err.message);
    } finally {
      setSearching(false);
    }
  };

  const cleanProductName = (name: string, kinguinPlatform: string) => {
    const detected = detect(kinguinPlatform, name);
    const region = detectRegion(name);
    return cleanTitle(name, detected.platform, region);
  };

  const detectExpirationDate = (text: string): string | null => {
    if (!text) return null;
    // Only match text that explicitly mentions redemption/expiration deadlines
    const patterns: [RegExp, boolean][] = [
      [/must be redeemed by\s+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i, false],
      [/valid until\s+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i, false],
      [/expires?\s+(?:on\s+)?([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i, false],
      [/redeemed before\s+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i, false],
      [/must be (?:activated|used) by\s+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i, false],
      [/valid (?:through|till)\s+([A-Za-z]+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i, false],
      // Month + Year only (e.g., "valid until May 2026")
      [/valid until\s+([A-Za-z]+ \d{4})/i, true],
      [/expires?\s+(?:on\s+)?([A-Za-z]+ \d{4})/i, true],
      [/valid (?:through|till)\s+([A-Za-z]+ \d{4})/i, true],
    ];
    for (const [p, monthOnly] of patterns) {
      const m = text.match(p);
      if (m) {
        let dateStr = m[1].replace(/(st|nd|rd|th),?/gi, ',');
        if (monthOnly) {
          const d = new Date(dateStr + " 1");
          if (!isNaN(d.getTime())) {
            const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            return lastDay.toISOString().split('T')[0];
          }
        } else {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime()) && d.getTime() > Date.now()) return d.toISOString().split('T')[0];
        }
      }
    }
    return null;
  };

  const handleDirectAdd = async (product: KinguinProduct) => {
    if (isBlockedProduct(product.name, product.productId)) {
      toast.error("This product type is not allowed (contains blocked term)");
      return;
    }
    const name = cleanProductName(product.name, product.platform);
    const price = calculateSellPrice(product.price);
    const expiration = detectExpirationDate(product.name) || detectExpirationDate(product.description || "");
    const detected = detect(product.platform, product.name);
    const region = detectRegion(product.name);
    const description: string | null = product.description || null;

    setSaving(product.productId);
    const qid = `kinguin-${product.productId}`;
    pushImportQueueItem({
      id: qid,
      title: name,
      image: standardizeImageUrl(product.coverImageOriginal) || null,
      status: "importing",
      message: "Importing…",
      source: "kinguin",
    });
    try {
      const { data: allowedData, error: allowedError } = await supabase
        .from("allowed_products")
        .insert({
          title: name,
          platform: detected.platform,
          store: detected.store,
          image_url: standardizeImageUrl(product.coverImageOriginal),
          screenshots: (product.screenshots || []).map(s => standardizeImageUrl(s)).filter(Boolean) as string[],
          video_url: product.videoUrl || null,
          description,
          region,
          expiration_date: expiration || null,
          developers: product.developers || [],
          publishers: product.publishers || [],
          languages: product.languages || [],
          regional_limitations: product.regionalLimitations || null,
          platform_details: product.platformDetails || null,
          release_date: product.releaseDate || null,
        } as any)
        .select()
        .single();

      if (allowedError) throw allowedError;

      const { error: linkError } = await supabase.from("kinguin_products").insert({
        allowed_product_id: allowedData.id,
        kinguin_product_id: product.productId,
        kinguin_price: product.price,
        sell_price: price,
        is_active: true,
        kinguin_stock: product.qty || 0,
        last_stock_check: new Date().toISOString(),
      } as any);

      if (linkError) throw linkError;

      toast.success(`"${name}" added as ${detected.platform} / ${detected.store} / ${region}`);
      updateImportQueueItem(qid, { status: "success", message: "Imported" });
      if (description) setLastImportIds(prev => [...prev, allowedData.id]);
      fetchLinked();
      fetchAllowed();
      fetchMissingDescCount();
    } catch (err: any) {
      if (err.code === "23505") {
        toast.error("This product already exists in the catalog");
        updateImportQueueItem(qid, { status: "duplicate", message: "Already in catalog" });
      } else {
        toast.error(err.message);
        updateImportQueueItem(qid, { status: "error", message: err.message || "Failed" });
      }
    } finally {
      setSaving(null);
    }
  };

  const paraphraseDescription = async (description: string, title: string): Promise<string | null> => {
    if (!description) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const res = await supabase.functions.invoke("paraphrase-description", {
        body: { description, title },
      });
      if (res.error) {
        console.error("Paraphrase error:", res.error);
        return null;
      }
      return res.data?.paraphrased || null;
    } catch (err) {
      console.error("Paraphrase failed:", err);
      return null;
    }
  };

  const BLOCKED_TERMS = ["ACCOUNT", "ACCESS", "VOUCHER", "ALTERGIFT", "ALTER GIFT", "STEAM GIFT"];

  const isTermBlocked = (name: string) => {
    const upper = name.toUpperCase();
    const cleaned = upper.replace(/ONLY\s+FOR\s+NEW\s+ACCOUNTS?/g, '');
    return BLOCKED_TERMS.some(b => cleaned.includes(b));
  };

  const isManuallyBlocked = (productId: string) => manuallyBlockedIds.has(productId);

  const isBlockedProduct = (name: string, productId?: string) => {
    if (isTermBlocked(name)) return true;
    if (productId && isManuallyBlocked(productId)) return true;
    return false;
  };

  const handleAdd = async () => {
    if (!addProduct || !addName.trim()) {
      toast.error("Enter a product name");
      return;
    }
    if (isBlockedProduct(addProduct.name, addProduct.productId)) {
      toast.error("This product type is not allowed (contains blocked term)");
      return;
    }

    const detected = detect(addProduct.platform, addProduct.name);
    const region = detectRegion(addProduct.name);

    setSaving(addProduct.productId);
    const addQid = `kinguin-${addProduct.productId}`;
    pushImportQueueItem({
      id: addQid,
      title: addName.trim() || addProduct.name,
      image: standardizeImageUrl(addProduct.coverImageOriginal) || null,
      status: "importing",
      message: "Importing…",
      source: "kinguin",
    });
    try {
      // Use original description - paraphrase happens later via Generate Descriptions
      const description: string | null = addProduct.description || null;

      const { data: allowedData, error: allowedError } = await supabase
        .from("allowed_products")
        .insert({
          title: addName.trim(),
          platform: detected.platform,
          store: detected.store,
          image_url: standardizeImageUrl(addProduct.coverImageOriginal),
          screenshots: (addProduct.screenshots || []).map(s => standardizeImageUrl(s)).filter(Boolean) as string[],
          video_url: addProduct.videoUrl || null,
          description,
          region,
          expiration_date: addExpiration || null,
        } as any)
        .select()
        .single();

      if (allowedError) throw allowedError;

      const { error: linkError } = await supabase.from("kinguin_products").insert({
        allowed_product_id: allowedData.id,
        kinguin_product_id: addProduct.productId,
        kinguin_price: addProduct.price,
        sell_price: parseFloat(addPrice) || addProduct.price,
        is_active: true,
        kinguin_stock: addProduct.qty || 0,
        last_stock_check: new Date().toISOString(),
      } as any);

      if (linkError) throw linkError;

      // Auto-assign Roblox products to "roblox" collection
      if (addProduct.name.toUpperCase().includes("ROBLOX") || addProduct.name.toUpperCase().includes("ROBUX")) {
        const { data: robloxCol } = await supabase
          .from("collections" as any)
          .select("id")
          .eq("slug", "roblox")
          .maybeSingle();
        if (robloxCol) {
          await supabase.from("collection_products").insert({
            collection_id: (robloxCol as any).id,
            allowed_product_id: allowedData.id,
            display_order: 0,
          } as any);
        }
      }

      pushImportQueueItem({
        id: `kinguin-${addProduct.productId}`,
        title: addName.trim() || addProduct.name,
        image: standardizeImageUrl(addProduct.coverImageOriginal) || null,
        status: "success",
        message: "Imported",
        source: "kinguin",
      });
      toast.success(`"${addName.trim()}" added as ${detected.platform} / ${detected.store} / ${region}`);
      // Auto-queue for paraphrase if paraphrasing is active
      if (description && generatingDescriptions) {
        await supabase.from("paraphrase_queue").insert({
          allowed_product_id: allowedData.id,
          status: "pending",
        });
        toast.info("Auto-added to paraphrase queue");
      } else if (description) {
        setLastImportIds(prev => [...prev, allowedData.id]);
      }
      setAddDialogOpen(false);
      setAddProduct(null);
      setAddName("");
      setAddPrice("");
      fetchLinked();
      fetchAllowed();
      fetchMissingDescCount();
    } catch (err: any) {
      if (err.code === "23505") {
        toast.error("This product already exists in the catalog");
        updateImportQueueItem(addQid, { status: "duplicate", message: "Already in catalog" });
      } else {
        toast.error(err.message);
        updateImportQueueItem(addQid, { status: "error", message: err.message || "Failed" });
      }
    } finally {
      setSaving(null);
    }
  };

  // Bulk add from catalog/search — fast import without paraphrase
  const handleBulkAdd = async (products: KinguinProduct[], setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const toAdd = products.filter((p) => !isAlreadyLinked(p.productId, p.name, p.platform) && !isBlockedProduct(p.name, p.productId));
    if (!toAdd.length) { toast.info("All selected products are already added or contain blocked types"); return; }
    setBulkAdding(true);
    let added = 0;
    const newIds: string[] = [];
    const allAddedIds: string[] = [];
    const robloxIds: string[] = [];
    for (const p of toAdd) {
      pushImportQueueItem({
        id: `kinguin-${p.productId}`,
        title: p.name,
        image: p.coverImageOriginal || null,
        status: "queued",
        source: "kinguin",
      });
    }
    for (const product of toAdd) {
      const qid = `kinguin-${product.productId}`;
      updateImportQueueItem(qid, { status: "importing", message: "Importing…" });
      try {
        const detected = detect(product.platform, product.name);
        const finalPlatform = bulkPlatform || detected.platform;
        const finalStore = bulkStore || detected.store;
        const region = detectRegion(product.name);
        const cleanName = cleanTitle(product.name, finalPlatform, region);
        const description: string | null = product.description || null;
        const expDate = detectExpirationDate(product.description || product.name);
        const insertPayload: any = {
            title: cleanName, platform: finalPlatform, store: finalStore,
            image_url: standardizeImageUrl(product.coverImageOriginal),
            screenshots: (product.screenshots || []).map(s => standardizeImageUrl(s)).filter(Boolean) as string[],
            video_url: product.videoUrl || null,
            description, region,
            expiration_date: expDate || null,
        };
        if (bulkTab) insertPayload.tab_category = bulkTab;
        const { data: allowedData, error: allowedError } = await supabase
          .from("allowed_products")
          .insert(insertPayload)
          .select().single();
        if (allowedError) {
          updateImportQueueItem(qid, {
            status: /duplicate key|23505/i.test(allowedError.message || "") ? "duplicate" : "error",
            message: allowedError.message || "Failed",
          });
          continue;
        }
        await supabase.from("kinguin_products").insert({
          allowed_product_id: allowedData.id, kinguin_product_id: product.productId,
          kinguin_price: product.price, sell_price: calculateSellPrice(product.price),
          is_active: true, kinguin_stock: product.qty || 0,
          last_stock_check: new Date().toISOString(),
        } as any);
        added++;
        allAddedIds.push(allowedData.id);
        // Track Roblox products for auto-collection
        if (product.name.toUpperCase().includes("ROBLOX") || product.name.toUpperCase().includes("ROBUX")) {
          robloxIds.push(allowedData.id);
        }
        if (description) newIds.push(allowedData.id);
        updateImportQueueItem(qid, { status: "success", message: "Imported" });
      } catch (err: any) {
        updateImportQueueItem(qid, { status: "error", message: err?.message || "Failed" });
      }
    }
    // Assign to collection if selected
    if (bulkCollection && allAddedIds.length > 0) {
      const collectionRows = allAddedIds.map((id, i) => ({
        collection_id: bulkCollection,
        allowed_product_id: id,
        display_order: i,
      }));
      for (let i = 0; i < collectionRows.length; i += 50) {
        await supabase.from("collection_products").insert(collectionRows.slice(i, i + 50));
      }
    }
    // Auto-assign Roblox products to "roblox" collection
    if (robloxIds.length > 0) {
      const { data: robloxCol } = await supabase
        .from("collections" as any)
        .select("id")
        .eq("slug", "roblox")
        .maybeSingle();
      if (robloxCol) {
        const robloxRows = robloxIds.map((id, i) => ({
          collection_id: (robloxCol as any).id,
          allowed_product_id: id,
          display_order: i,
        }));
        for (let i = 0; i < robloxRows.length; i += 50) {
          await supabase.from("collection_products").insert(robloxRows.slice(i, i + 50));
        }
      }
    }
    // Auto-queue new products if paraphrasing is currently active
    if (newIds.length > 0 && generatingDescriptions) {
      const queueRows = newIds.map(id => ({ allowed_product_id: id, status: "pending" }));
      for (let i = 0; i < queueRows.length; i += 50) {
        await supabase.from("paraphrase_queue").insert(queueRows.slice(i, i + 50));
      }
      toast.success(`Added ${added} products and auto-queued ${newIds.length} for paraphrasing.`);
    } else {
      toast.success(`Added ${added} products. Descriptions will be auto-paraphrased by the cron job.`);
    }
    setter(new Set());
    setBulkAdding(false);
    fetchLinked();
    fetchAllowed();
    fetchMissingDescCount();
  };


  const allowedProductMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ap of allowedProducts) {
      map.set(ap.id, `${ap.title} (${ap.platform} / ${ap.store})`);
    }
    return map;
  }, [allowedProducts]);

  const getAllowedName = useCallback((id: string) => {
    return allowedProductMap.get(id) || id;
  }, [allowedProductMap]);

  // Pre-compute lookup sets for fast isAlreadyLinked checks
  const linkedProductIdSet = useMemo(() => new Set(linkedProducts.map(lp => lp.kinguin_product_id)), [linkedProducts]);
  const allowedProductLookup = useMemo(() => {
    const fullNames = new Set<string>();
    for (const ap of allowedProducts) {
      fullNames.add(ap.title.toLowerCase());
    }
    return fullNames;
  }, [allowedProducts]);

  // Check if a kinguin product is already linked or already exists in allowed_products
  const isAlreadyLinked = useCallback((productId: string, productName?: string, kinguinPlatform?: string) => {
    if (linkedProductIdSet.has(productId)) return true;
    // Compare cleaned title against existing catalog titles
    if (productName) {
      const cleanedTitle = cleanProductName(productName, kinguinPlatform || "Steam").toLowerCase();
      return allowedProductLookup.has(cleanedTitle);
    }
    return false;
  }, [linkedProductIdSet, allowedProductLookup]);

  const renderProductRow = (product: KinguinProduct, context: "search" | "catalog") => {
    const linked = isAlreadyLinked(product.productId, product.name, product.platform);
    const blocked = isBlockedProduct(product.name, product.productId);
    const manualBlocked = isManuallyBlocked(product.productId);
    const projectedSell = calculateSellPrice(product.price);
    const overpriced = evaluateOverpricedCard(product.name, projectedSell);
    const overpricedBadge = overpriced?.isOverpriced ? (
      <span
        title={`Sell €${projectedSell.toFixed(2)} vs face ≈ €${overpriced.faceEur.toFixed(2)} → +${overpriced.markupPct.toFixed(1)}% (tier ${overpriced.tierLabel} cap +${overpriced.capPct}%)`}
        className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-red-500/20 text-red-400 border-red-500/40 whitespace-nowrap"
      >
        Overpriced +{overpriced.markupPct.toFixed(0)}%
      </span>
    ) : null;
    const handleAddWithWarning = () => {
      if (overpriced?.isOverpriced) {
        const ok = confirm(
          `⚠️ Overpriced gift card\n\n${product.name}\n\n` +
          `Sell price €${projectedSell.toFixed(2)} vs face value ≈ €${overpriced.faceEur.toFixed(2)}\n` +
          `Markup +${overpriced.markupPct.toFixed(1)}%  (tier ${overpriced.tierLabel} cap +${overpriced.capPct}%)\n\n` +
          `Importing it will likely be flagged by the Overpriced Cards scan.\nImport anyway?`
        );
        if (!ok) return;
      }
      handleDirectAdd(product);
    };

    if (context === "search") {
      const region = detectRegion(product.name);
      const detected = detect(product.platform, product.name);
      return (
        <div key={product.productId} className={`flex items-center gap-3 p-3 rounded-lg bg-card border ${overpriced?.isOverpriced ? "border-red-500/50" : "border-border"}`}>
          <Checkbox
            checked={selectedSearch.has(product.productId)}
            onCheckedChange={() => toggleSelection(selectedSearch, setSelectedSearch, product.productId)}
          />
          <ProductImage src={product.coverImageOriginal} name={product.name} size="w-12 h-12" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <a href={`https://www.kinguin.net/category/${product.kinguinId || product.productId}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:underline truncate" onClick={(e) => e.stopPropagation()}>{product.name}</a>
              <ProductBadges product={product} />
              {overpricedBadge}
            </div>
{(() => { const actualCost = kinguinBuyPrice(product.price); const sell = calculateSellPrice(product.price); const profit = sell - actualCost; return (
            <p className="text-xs text-muted-foreground">
              {detected.platform} / {detected.store} • {region} • Buy: €{actualCost.toFixed(2)} • Sell: <span className="text-green-500">€{sell.toFixed(2)}</span> • Profit: <span className={profit > 0 ? 'text-green-500' : 'text-destructive'}>{profit >= 0 ? '+' : ''}€{profit.toFixed(2)}</span> • {product.qty} in stock
            </p>); })()}
          </div>
          {linked ? (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Already added</span>
          ) : blocked && manualBlocked ? (
            <Button variant="ghost" size="sm" className="gap-1 h-8 text-xs text-destructive" onClick={() => handleManualUnblock(product.productId)}>
              <Ban className="h-3 w-3" /> Unblock
            </Button>
          ) : blocked ? (
            <span className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">Blocked</span>
          ) : (
            <div className="flex gap-1">
              <Button
                variant={overpriced?.isOverpriced ? "destructive" : "outline"}
                size="sm"
                className="gap-1 h-8 text-xs"
                disabled={saving === product.productId}
                onClick={handleAddWithWarning}
              >
                {saving === product.productId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => handleManualBlock(product)}
                title="Block this product"
              >
                <Ban className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      );
    }

    // catalog table row
    const region = detectRegion(product.name);
    const detected = detect(product.platform, product.name);
    return (
      <tr key={product.productId} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${overpriced?.isOverpriced ? "bg-red-500/5" : ""}`}>
        <td className="p-3">
          <Checkbox
            checked={selectedCatalog.has(product.productId)}
            onCheckedChange={() => toggleSelection(selectedCatalog, setSelectedCatalog, product.productId)}
          />
        </td>
        <td className="p-3">
          <ProductImage src={product.coverImageOriginal} name={product.name} />
        </td>
        <td className="p-3 max-w-[200px] group/name relative">
          <div className="flex items-center gap-2">
            <a href={`https://www.kinguin.net/category/${product.kinguinId || product.productId}`} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:underline truncate" onClick={(e) => e.stopPropagation()}>{product.name}</a>
            <ProductBadges product={product} />
            {overpricedBadge}
          </div>
          <div className="absolute left-0 top-full z-50 hidden group-hover/name:block bg-popover text-popover-foreground text-xs p-2 rounded-md shadow-lg border border-border max-w-[400px] whitespace-normal">
            {product.name}
          </div>
        </td>
        <td className="p-3 text-muted-foreground text-xs">
          <div>{detected.platform} / {detected.store}</div>
        </td>
        <td className="p-3 text-muted-foreground text-xs">{region}</td>
        <td className="p-3 text-right text-foreground">€{kinguinBuyPrice(product.price).toFixed(2)}</td>
        <td className="p-3 text-right text-green-500 font-medium">€{calculateSellPrice(product.price).toFixed(2)}</td>
{(() => { const sell = calculateSellPrice(product.price); const actualCost = kinguinBuyPrice(product.price); const profit = sell - actualCost; return (
          <td className={`p-3 text-right font-medium ${profit > 0 ? 'text-green-500' : 'text-destructive'}`}>{profit >= 0 ? '+' : ''}€{profit.toFixed(2)}</td>
        ); })()}
        <td className="p-3 text-right text-muted-foreground">{product.qty}</td>
        <td className="p-3 text-right text-muted-foreground text-xs">{formatReleaseYear(product.releaseDate) || "—"}</td>
        <td className="p-3 text-right">
          {linked ? (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Added</span>
          ) : blocked && manualBlocked ? (
            <Button variant="ghost" size="sm" className="gap-1 h-8 text-xs text-destructive" onClick={() => handleManualUnblock(product.productId)}>
              <Ban className="h-3 w-3" /> Unblock
            </Button>
          ) : blocked ? (
            <span className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">Blocked</span>
          ) : (
            <div className="flex gap-1 justify-end">
              <Button
                variant={overpriced?.isOverpriced ? "destructive" : "outline"}
                size="sm"
                className="gap-1 h-8 text-xs"
                disabled={saving === product.productId}
                onClick={handleAddWithWarning}
              >
                {saving === product.productId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => handleManualBlock(product)}
                title="Block this product"
              >
                <Ban className="h-3 w-3" />
              </Button>
            </div>
          )}
        </td>
      </tr>
    );
  };




  const [displayPage, setDisplayPage] = useState(1);
  const DISPLAY_PAGE_SIZE = catalogPageSize;

  const isSearchActive = results.length > 0;
  // When sort/filter is active and full catalog is loaded, use it instead of per-page data
  const catalogSource = (!isSearchActive && hasCatalogSortOrFilter && fullCatalogCache) ? fullCatalogCache : catalogProducts;
  const displayProducts = isSearchActive ? results : catalogSource;
  const allFilteredPreHide = useMemo(() => applySorting(applyFilters(displayProducts, catalogFilters, autoGroupRules), catalogSort), [displayProducts, catalogFilters, catalogSort, autoGroupRules]);
  // Only apply hideAdded filter when client-paginated (all data loaded), otherwise we get empty server pages
  const isFullyLoaded = isSearchActive ? (searchTotalCount === results.length) : (fullCatalogCache !== null);
    const shouldApplyHideAdded = hideAdded && isFullyLoaded;
     const shouldApplyHideBlocked = hideBlocked && isFullyLoaded;
     const shouldApplyHideDlc = hideDlc && isFullyLoaded;
     const shouldApplyHideOverpriced = hideOverpriced && isFullyLoaded;
     const allFiltered = useMemo(() => {
       let filtered = allFilteredPreHide;
       if (shouldApplyHideAdded) filtered = filtered.filter(p => !isAlreadyLinked(p.productId, p.name, p.platform));
       if (shouldApplyHideBlocked) filtered = filtered.filter(p => !isBlockedProduct(p.name, p.productId));
       if (shouldApplyHideDlc) filtered = filtered.filter(p => !/\bdlc\b/i.test(p.name));
       if (shouldApplyHideOverpriced) filtered = filtered.filter(p => {
         const sell = calculateSellPrice(p.price);
         const ev = evaluateOverpricedCard(p.name, sell);
         return !ev?.isOverpriced;
       });
       return filtered;
     }, [shouldApplyHideAdded, shouldApplyHideBlocked, shouldApplyHideDlc, shouldApplyHideOverpriced, allFilteredPreHide, isAlreadyLinked, manuallyBlockedIds, calculateSellPrice]);
  
  // Client-side pagination when: multi-word search OR full catalog loaded for sort/filter
  const isClientPaginated = (isSearchActive && searchTotalCount === results.length) || (!isSearchActive && hasCatalogSortOrFilter && fullCatalogCache !== null);
  const totalDisplayPages = isClientPaginated ? Math.ceil(allFiltered.length / DISPLAY_PAGE_SIZE) : 1;
  const filteredCatalog = useMemo(() => isClientPaginated
    ? allFiltered.slice((displayPage - 1) * DISPLAY_PAGE_SIZE, displayPage * DISPLAY_PAGE_SIZE)
    : allFiltered, [isClientPaginated, allFiltered, displayPage, DISPLAY_PAGE_SIZE]);
  const filteredResults = filteredCatalog;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h3 className="font-display text-lg font-bold text-foreground">Kinguin Integration</h3>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Balance:</span>
            {balanceLoading ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : kinguinBalance !== null ? (
              <span className={`text-sm font-bold ${kinguinBalance < 50 ? 'text-destructive' : kinguinBalance < 200 ? 'text-yellow-500' : 'text-green-500'}`}>
                €{kinguinBalance.toFixed(2)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">N/A</span>
            )}
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={fetchBalance} disabled={balanceLoading}>
              <RefreshCw className={`h-3 w-3 ${balanceLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">


            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={metadataPlatformFilter}
              onChange={(e) => setMetadataPlatformFilter(e.target.value)}
              disabled={syncingMetadata}
            >
              <option value="all">All Platforms</option>
              <option value="PC">PC</option>
              <option value="Xbox">Xbox</option>
              <option value="PlayStation">PlayStation</option>
              <option value="Nintendo">Nintendo</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              disabled={syncingMetadata}
              onClick={handleSyncMetadata}
            >
              {syncingMetadata ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {syncingMetadata
                ? `Syncing ${metadataProgress.current}/${metadataProgress.total}...`
                : "Sync Metadata"}
            </Button>
          </div>
      </div>

      {/* Metadata Sync Status Summary */}
      <div className="flex flex-wrap items-center gap-4 text-xs px-1">
        {loadingSyncStats ? (
          <span className="text-muted-foreground">Loading sync stats...</span>
        ) : metadataSyncStats ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" />
              <span className="text-muted-foreground">Full sync:</span>
              <span className="font-semibold text-foreground">{metadataSyncStats.full.toLocaleString()}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 inline-block" />
              <span className="text-muted-foreground">Partial (sibling missing data):</span>
              <span className="font-semibold text-foreground">{metadataSyncStats.partial.toLocaleString()}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
              <span className="text-muted-foreground">No sync:</span>
              <span className="font-semibold text-foreground">{metadataSyncStats.none.toLocaleString()}</span>
            </span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={fetchMetadataSyncStats} disabled={loadingSyncStats}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </>
        ) : null}
      </div>

      {/* Search Kinguin */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Search games on Kinguin..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={() => handleSearch()} disabled={searching} className="gap-2">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
          {results.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setResults([]); setSearchQuery(""); setSearchTotalCount(0); setSearchPage(1); setSelectedSearch(new Set()); setDisplayPage(1); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Import Override Controls */}
      {selectedCatalog.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-xs font-bold text-primary uppercase tracking-wider mr-1">Import as:</span>
          <select value={bulkPlatform} onChange={(e) => { setBulkPlatform(e.target.value); setBulkStore(""); }} className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground min-w-[100px]">
            <option value="">Auto-detect Platform</option>
            {PLATFORM_CATEGORIES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <select value={bulkStore} onChange={(e) => setBulkStore(e.target.value)} className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground min-w-[100px]">
            <option value="">Auto-detect Store</option>
            {(bulkPlatform ? getSubPlatforms(bulkPlatform) : []).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={bulkTab} onChange={(e) => setBulkTab(e.target.value)} className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground min-w-[100px]">
            <option value="">No Tab</option>
            <option value="games">Games</option>
            <option value="topups">Top Ups</option>
            <option value="subscriptions">Subscriptions</option>
            <option value="dlc">DLC</option>
          </select>
          <select value={bulkCollection} onChange={(e) => setBulkCollection(e.target.value)} className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground min-w-[120px]">
            <option value="">No Collection</option>
            {availableCollections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button variant="default" size="sm" className="h-8 text-xs gap-1" disabled={bulkAdding} onClick={() => handleBulkAdd(allFiltered.filter(p => selectedCatalog.has(p.productId)), setSelectedCatalog)}>
            {bulkAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add {selectedCatalog.size} selected
          </Button>
        </div>
      )}

      {/* Kinguin Catalog / Search Results Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              {isSearchActive ? `Search Results for "${searchQuery}"` : "Kinguin Catalog (Popular)"}
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={hideAdded ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setHideAdded(!hideAdded)}
            >
             {hideAdded ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
               Hide Added
             </Button>
             <Button
               variant={hideBlocked ? "default" : "ghost"}
               size="sm"
               className="h-7 text-xs gap-1"
               onClick={() => setHideBlocked(!hideBlocked)}
             >
               {hideBlocked ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
               Hide Blocked
              </Button>
               <Button
                 variant={hideDlc ? "default" : "ghost"}
                 size="sm"
                 className="h-7 text-xs gap-1"
                 onClick={() => setHideDlc(!hideDlc)}
               >
                 {hideDlc ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                 Hide DLC
               </Button>
               <Button
                 variant={hideOverpriced ? "default" : "ghost"}
                 size="sm"
                 className="h-7 text-xs gap-1"
                 onClick={() => setHideOverpriced(!hideOverpriced)}
               >
                 {hideOverpriced ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                 Hide Overpriced
               </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowCatalogFilters(!showCatalogFilters)}>
              <Filter className="h-3 w-3" /> Filters
            </Button>
          </div>
        </div>
        {showCatalogFilters && <FilterBar filters={catalogFilters} setFilters={(f) => { setCatalogFilters(f); setDisplayPage(1); }} onClear={() => { setCatalogFilters(emptyFilters); setDisplayPage(1); }} />}
        {fullCatalogLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading full catalog for cross-page filtering...
          </div>
        )}
        {loadingCatalog || searching ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            {searching ? "Searching Kinguin..." : "Loading Kinguin catalog..."}
          </div>
        ) : displayProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            {isSearchActive ? "No products found on Kinguin." : "No products loaded. Check your API key."}
          </p>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="md:hidden space-y-2">
              {filteredCatalog.map((product) => {
                const linked = isAlreadyLinked(product.productId, product.name, product.platform);
                const blocked = isBlockedProduct(product.name, product.productId);
                const manualBlocked = isManuallyBlocked(product.productId);
                const region = detectRegion(product.name);
                const detected = detect(product.platform, product.name);
                return (
                  <div key={product.productId} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                    <Checkbox
                      checked={selectedCatalog.has(product.productId)}
                      onCheckedChange={() => toggleSelection(selectedCatalog, setSelectedCatalog, product.productId)}
                      className="mt-1"
                    />
                    <ProductImage src={product.coverImageOriginal} name={product.name} size="w-12 h-12" />
                    <div className="flex-1 min-w-0">
                      <a href={`https://www.kinguin.net/category/${product.kinguinId || product.productId}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:underline line-clamp-2" onClick={(e) => e.stopPropagation()}>{product.name}</a>
                      <ProductBadges product={product} />
{(() => { const actualCost = kinguinBuyPrice(product.price); const sell = calculateSellPrice(product.price); const profit = sell - actualCost; return (
                      <p className="text-xs text-muted-foreground mt-1">
                        {detected.platform} / {detected.store} • {region} • Buy: €{actualCost.toFixed(2)} • Sell: <span className="text-green-500">€{sell.toFixed(2)}</span> • Profit: <span className={profit > 0 ? 'text-green-500' : 'text-destructive'}>{profit >= 0 ? '+' : ''}€{profit.toFixed(2)}</span> • {product.qty} in stock
                      </p>); })()}
                    </div>
                    <div className="shrink-0">
                      {linked ? (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Added</span>
                      ) : blocked && manualBlocked ? (
                        <Button variant="ghost" size="sm" className="gap-1 h-8 text-xs text-destructive" onClick={() => handleManualUnblock(product.productId)}>
                          <Ban className="h-3 w-3" /> Unblock
                        </Button>
                      ) : blocked ? (
                        <span className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">Blocked</span>
                      ) : (
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" disabled={saving === product.productId} onClick={() => handleDirectAdd(product)}>
                            {saving === product.productId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            Add
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 text-xs text-muted-foreground hover:text-destructive" onClick={() => handleManualBlock(product)} title="Block">
                            <Ban className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop table layout */}
            <div className="hidden md:block rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="p-3">
                      <Checkbox
                        checked={filteredCatalog.length > 0 && filteredCatalog.every(p => selectedCatalog.has(p.productId))}
                        onCheckedChange={() => toggleAllSelection(filteredCatalog.map(p => p.productId), selectedCatalog, setSelectedCatalog)}
                      />
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Image</th>
                    <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort(setCatalogSort, "name")}>
                      <span className="inline-flex items-center gap-1">Name <SortIcon sortState={catalogSort} column="name" /></span>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort(setCatalogSort, "platform")}>
                      <span className="inline-flex items-center gap-1">Platform <SortIcon sortState={catalogSort} column="platform" /></span>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Region</th>
                    <th className="text-right p-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort(setCatalogSort, "price")}>
                      <span className="inline-flex items-center gap-1 justify-end">Buy <SortIcon sortState={catalogSort} column="price" /></span>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Sell</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Profit</th>
                    <th className="text-right p-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort(setCatalogSort, "qty")}>
                      <span className="inline-flex items-center gap-1 justify-end">Stock <SortIcon sortState={catalogSort} column="qty" /></span>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort(setCatalogSort, "releaseYear")}>
                      <span className="inline-flex items-center gap-1 justify-end">Release <SortIcon sortState={catalogSort} column="releaseYear" /></span>
                    </th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map((product) => renderProductRow(product, "catalog"))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={filteredCatalog.length > 0 && filteredCatalog.every(p => selectedCatalog.has(p.productId))}
                  onCheckedChange={() => toggleAllSelection(filteredCatalog.map(p => p.productId), selectedCatalog, setSelectedCatalog)}
                />
                <p className="text-xs text-muted-foreground">
                {(() => {
                  if (isClientPaginated) {
                    const start = (displayPage - 1) * DISPLAY_PAGE_SIZE + 1;
                    const end = Math.min(displayPage * DISPLAY_PAGE_SIZE, allFiltered.length);
                    return `Page ${displayPage} • Showing ${start}-${end} of ${allFiltered.length.toLocaleString()} results`;
                  } else {
                    const currentPage = isSearchActive ? searchPage : catalogPage;
                    const pageSize = isSearchActive ? SEARCH_PAGE_SIZE : CATALOG_PAGE_SIZE;
                    const total = isSearchActive ? searchTotalCount : catalogTotalCount;
                    const start = (currentPage - 1) * pageSize + 1;
                    const end = start + filteredCatalog.length - 1;
                    return `Page ${currentPage} • Showing ${start}-${end} of ${total.toLocaleString()} results`;
                  }
                })()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedCatalog.size > 0 && (
                  <Button variant="default" size="sm" className="h-8 text-xs gap-1" disabled={bulkAdding} onClick={() => handleBulkAdd(allFiltered.filter(p => selectedCatalog.has(p.productId)), setSelectedCatalog)}>
                    {bulkAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add {selectedCatalog.size} selected
                  </Button>
                )}
                <select
                  value={catalogPageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    setCatalogPageSize(newSize);
                    setDisplayPage(1);
                    setCatalogPage(1);
                    setSearchPage(1);
                    if (isSearchActive) {
                      handleSearch(1);
                    } else if (!isClientPaginated) {
                      loadKinguinCatalog(1, 0, newSize);
                    }
                  }}
                  className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                  <option value={150}>150 / page</option>
                  <option value={200}>200 / page</option>
                </select>
                {(() => {
                  // Unified page number pagination for both server and client paginated
                  const currentPage = isClientPaginated ? displayPage : (isSearchActive ? searchPage : catalogPage);
                  const pageSize = isClientPaginated ? DISPLAY_PAGE_SIZE : (isSearchActive ? SEARCH_PAGE_SIZE : CATALOG_PAGE_SIZE);
                  const totalItems = isClientPaginated ? allFiltered.length : (isSearchActive ? searchTotalCount : catalogTotalCount);
                  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
                  const goToPage = (p: number) => {
                    if (isClientPaginated) {
                      setDisplayPage(p);
                    } else if (isSearchActive) {
                      handleSearch(p);
                    } else {
                      loadKinguinCatalog(p);
                    }
                  };
                  const isLoading = loadingCatalog || searching;

                  // Calculate visible page numbers (show up to 7 pages)
                  const maxVisible = 7;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                  if (endPage - startPage + 1 < maxVisible) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }
                  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

                  return (
                    <>
                      <Button variant="outline" size="sm" className="h-8 text-xs" disabled={currentPage <= 1 || isLoading} onClick={() => goToPage(currentPage - 1)}>Previous</Button>
                      {startPage > 1 && (
                        <>
                          <Button variant="outline" size="sm" className="h-8 w-8 text-xs p-0" onClick={() => goToPage(1)} disabled={isLoading}>1</Button>
                          {startPage > 2 && <span className="text-xs text-muted-foreground px-1">…</span>}
                        </>
                      )}
                      {pages.map(page => (
                        <Button key={page} variant={page === currentPage ? "default" : "outline"} size="sm" className="h-8 w-8 text-xs p-0" disabled={isLoading} onClick={() => goToPage(page)}>
                          {page}
                        </Button>
                      ))}
                      {endPage < totalPages && (
                        <>
                          {endPage < totalPages - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                          <Button variant="outline" size="sm" className="h-8 w-8 text-xs p-0" onClick={() => goToPage(totalPages)} disabled={isLoading}>{totalPages}</Button>
                        </>
                      )}
                      <Button variant="outline" size="sm" className="h-8 text-xs" disabled={currentPage >= totalPages || isLoading} onClick={() => goToPage(currentPage + 1)}>Next</Button>
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        )}
      </div>



      {/* Add Product Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add to Catalog</DialogTitle>
          </DialogHeader>
          {addProduct && (() => {
            const detected = detect(addProduct.platform, addProduct.name);
            const region = detectRegion(addProduct.name);
            return (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3">
                  <ProductImage src={addProduct.coverImageOriginal} name={addProduct.name} size="w-16 h-16" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{addProduct.name}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Product Name</label>
                  <Input
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Sell Price ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value)}
                    placeholder="Enter sell price"
                  />
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Kinguin cost: <span className="text-foreground font-medium">€{addProduct.price?.toFixed(2)}</span></p>
                    <p>Suggested price: <span className="text-foreground font-medium">€{calculateSellPrice(addProduct.price).toFixed(2)}</span>
                      <span className="ml-1">({getMarginLabel(addProduct.price)} margin + fees)</span>
                    </p>
                    {addPrice && (() => {
                      const sell = parseFloat(addPrice);
                      const profit = sell - kinguinBuyPrice(addProduct.price);
                      return <p>Net profit: <span className={`font-medium ${profit > 0 ? 'text-green-500' : 'text-destructive'}`}>€{profit.toFixed(2)}</span></p>;
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Platform</p>
                    <p className="text-sm font-medium text-foreground">{detected.platform}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Store</p>
                    <p className="text-sm font-medium text-foreground">{detected.store}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Region</p>
                    <p className="text-sm font-medium text-foreground">{region}</p>
                  </div>
              </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Expiration Date (optional)</label>
                  <Input
                    type="date"
                    value={addExpiration}
                    onChange={(e) => setAddExpiration(e.target.value)}
                    placeholder="Leave empty if no expiry"
                  />
                  <p className="text-xs text-muted-foreground">Auto-detected from description. Set if the key expires.</p>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!!saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
