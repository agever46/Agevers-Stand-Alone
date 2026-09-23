import { useState, useMemo, useEffect } from "react";
import { ArrowUpDown, Globe, ChevronDown, X, Layers, Monitor, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { getProductTypeLabel } from "@/lib/gameItemClassifier";

export type SortOption = "popular" | "price-asc" | "price-desc" | "newest" | "oldest";

export interface FilterableProduct {
  price?: number;
  platform?: string;
  store?: string;
  region?: string;
  title?: string;
  original_title?: string | null;
  originalTitle?: string | null;
  description?: string | null;
  category?: string | null;
  tab_category?: string | null;
  product_type?: string | null;
  productType?: string | null;
}

export interface AdditionalFilters {
  priceMin: number | null;
  priceMax: number | null;
  productTypes: string[];
  platforms: string[];
}

export const EMPTY_ADDITIONAL_FILTERS: AdditionalFilters = {
  priceMin: null,
  priceMax: null,
  productTypes: [],
  platforms: [],
};

interface ProductFiltersProps {
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  region: string;
  onRegionChange: (region: string) => void;
  availableRegions?: string[];
  regionCounts?: Record<string, number>;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  /** All filterable products (BEFORE filters applied) — used to derive dynamic options */
  products?: FilterableProduct[];
  additionalFilters?: AdditionalFilters;
  onAdditionalFiltersChange?: (f: AdditionalFilters) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "popular", label: "Popularity" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

const PRICE_SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "price-asc", label: "Price: Low → High" },
  { value: "price-desc", label: "Price: High → Low" },
];

const ALL_REGIONS = [
  "Global", "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada",
  "Chile", "Denmark", "Europe", "Finland", "France", "Germany", "Greece",
  "Hong Kong", "India", "Israel", "Italy", "Japan", "Latin America", "Mexico",
  "New Zealand", "Norway", "Poland", "Portugal", "Saudi Arabia", "Singapore",
  "South Africa", "Spain", "Sweden", "Switzerland", "Taiwan", "Turkey",
  "United Kingdom", "United States",
];

const detectProductType = (p: FilterableProduct): string => {
  // tab_category overrides (admin-set)
  if (p.tab_category === "topups") return "Top Up";
  if (p.tab_category === "subscriptions") return "Subscription";
  if (p.tab_category === "dlc") return "DLC";
  if (p.tab_category === "gift cards") return "Gift Card";

  const title = (p.title || "").toUpperCase();
  // Gift cards by store (catches all branded GCs)
  if (p.store === "Gift Cards" || title.includes("GIFT CARD") || title.includes("GIFT-CARD")) return "Gift Card";
  // In-Game Items and Gaming Accessories are differentiated by Platform, not
  // by a Game/DLC/Edition "Type" — bucket them under their own store name.
  if (p.store === "In-Game Items") return "In-Game Item";
  if (p.store === "Gaming Accessories" || p.platform === "Gaming Accessories") return "Gaming Accessory";
  // Top-Ups: prepaid cards, wallet codes, eShop credit, PSN funds — anything that adds balance
  if (
    title.includes("PREPAID") ||
    title.includes("WALLET") ||
    title.includes("TOP UP") ||
    title.includes("TOPUP") ||
    /\bXBOX\s*LIVE\b.*\b(CARD|POINTS?|EUR|USD|GBP|NOK|SEK|ZAR|TWD|AUD|NZD|\$|€|£|¥)/.test(title) ||
    /\bPSN\b.*\b(CARD|POINTS?|EUR|USD|GBP|\$|€|£)/.test(title) ||
    /\bMICROSOFT\s*POINTS?\b/.test(title) ||
    /\bNINTENDO\s*ESHOP\b/.test(title)
  ) return "Top Up";
  // Software detection — match standalone software products only.
  // IMPORTANT: many game titles include "Pc Windows 10/11" as a platform tag
  // (e.g. "Call of Duty: Ghosts Pc Windows 10 - Europe"). Those must NOT be
  // classified as Software. Only treat as Software when the title indicates
  // the OS / Office suite IS the product itself (no "PC" platform prefix).
  const isOfficeProduct = /\bMICROSOFT\s+OFFICE\b/.test(title) || /\bOFFICE\s+(365|2021|2019|HOME|PROFESSIONAL|BUSINESS)\b/.test(title);
  const isWindowsOSProduct =
    (/\bWINDOWS\s+(10|11)\s+(PRO|HOME|ENTERPRISE|EDUCATION|OEM|PROFESSIONAL)\b/.test(title)
      || /\b(BUY|GET|ACTIVATE|LICENSE|KEY)\b.*\bWINDOWS\s+(10|11)\b/.test(title))
    && !/\bPC\s+WINDOWS\b/.test(title); // exclude game platform tags
  if (
    p.store === "Software" || p.store === "Windows" || p.store === "Office" || p.store === "Antivirus & Utilities" ||
    isOfficeProduct || isWindowsOSProduct
  ) return "Software";

  // Use the comprehensive classifier (handles DLC, Season Pass, Expansion, Edition, Skin, Currency, Bundle, etc.)
  const label = getProductTypeLabel({
    title: p.title || "",
    originalTitle: p.originalTitle || p.original_title || null,
    description: p.description || "",
    category: p.category || null,
    store: p.store || null,
    productType: p.productType || p.product_type || null,
  });

  // Map classifier labels to filter buckets
  if (label === "Currency") return "Currency";
  if (label === "DLC" || label === "Season Pass" || label === "Expansion" || label === "Skin") return "DLC";
  if (label === "Top Up") return "Top Up";
  if (label === "Subscription") return "Subscription";
  if (label === "Bundle") return "Bundle";
  if (label === "Edition") return "Edition";
  if (label === "PRE ORDER BONUS" || label === "GAME + BONUS") return "Pre-Order Bonus";
  return "Game";
};

const ProductFilters = ({
  sort, onSortChange, region, onRegionChange, availableRegions, regionCounts,
  searchQuery = "", onSearchChange, products, additionalFilters, onAdditionalFiltersChange,
}: ProductFiltersProps) => {
  const [sortOpen, setSortOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);

  const filters = additionalFilters ?? EMPTY_ADDITIONAL_FILTERS;
  const advancedEnabled = !!products && !!onAdditionalFiltersChange;

  // Derive dynamic options + counts from products
  const { typeCounts, platformCounts, priceBounds } = useMemo(() => {
    if (!products || products.length === 0) {
      return { typeCounts: {} as Record<string, number>, platformCounts: {} as Record<string, number>, priceBounds: { min: 0, max: 100 } };
    }
    const tc: Record<string, number> = {};
    const pc: Record<string, number> = {};
    let min = Infinity;
    let max = 0;
    products.forEach((p) => {
      const t = detectProductType(p);
      tc[t] = (tc[t] || 0) + 1;
      const pl = p.platform || "Other";
      pc[pl] = (pc[pl] || 0) + 1;
      const price = Number(p.price) || 0;
      if (price > 0 && price < min) min = price;
      if (price > max) max = price;
    });
    return {
      typeCounts: tc,
      platformCounts: pc,
      priceBounds: { min: min === Infinity ? 0 : Math.floor(min), max: Math.ceil(max) || 100 },
    };
  }, [products]);

  const sortedTypes = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a]);
  const sortedPlatforms = Object.keys(platformCounts).sort((a, b) => platformCounts[b] - platformCounts[a]);

  const regions = availableRegions && availableRegions.length > 0 ? availableRegions : ALL_REGIONS;
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label || "Popularity";
  const isPriceSort = sort === "price-asc" || sort === "price-desc";
  const priceSortLabel = PRICE_SORT_OPTIONS.find((o) => o.value === sort)?.label || "Price";
  const totalCount = regionCounts ? Object.values(regionCounts).reduce((s, n) => s + n, 0) : null;

  const update = (patch: Partial<AdditionalFilters>) => {
    onAdditionalFiltersChange?.({ ...filters, ...patch });
  };
  const toggleType = (t: string) => {
    const next = filters.productTypes.includes(t)
      ? filters.productTypes.filter((x) => x !== t)
      : [...filters.productTypes, t];
    update({ productTypes: next });
  };
  const togglePlatform = (p: string) => {
    const next = filters.platforms.includes(p)
      ? filters.platforms.filter((x) => x !== p)
      : [...filters.platforms, p];
    update({ platforms: next });
  };

  const priceLabel = filters.priceMin !== null || filters.priceMax !== null
    ? `€${filters.priceMin ?? 0}–€${filters.priceMax ?? "∞"}`
    : "Price";
  const typeLabel = filters.productTypes.length > 0 ? `Type (${filters.productTypes.length})` : "Type";
  const platformLabel = filters.platforms.length > 0 ? `Platform (${filters.platforms.length})` : "Platform";

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {onSearchChange && (
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search products..."
            className="h-9 w-48 md:w-56 rounded-md border border-border/50 bg-background px-3 text-xs font-display placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => onSearchChange("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Sort */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="font-display text-xs tracking-wider gap-1.5 border-border/50"
          onClick={() => { setSortOpen(!sortOpen); setRegionOpen(false); setTypeOpen(false); setPlatformOpen(false); setPriceOpen(false); }}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {isPriceSort ? "Popularity" : currentSortLabel}
          <ChevronDown className={`h-3 w-3 transition-transform ${sortOpen ? "rotate-180" : ""}`} />
        </Button>
        <AnimatePresence>
          {sortOpen && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute top-full left-0 mt-1 z-50 bg-background border border-border/50 rounded-lg shadow-xl min-w-[180px] overflow-hidden">
              {SORT_OPTIONS.map((opt) => (
                <button key={opt.value}
                  className={`w-full text-left px-3 py-2 text-xs font-display transition-colors ${sort === opt.value ? "bg-primary/10 text-primary font-bold" : "text-foreground hover:bg-secondary/50"}`}
                  onClick={() => { onSortChange(opt.value); setSortOpen(false); }}>
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Price sort */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="font-display text-xs tracking-wider gap-1.5 border-border/50"
          onClick={() => { setPriceOpen(!priceOpen); setSortOpen(false); setRegionOpen(false); setTypeOpen(false); setPlatformOpen(false); }}
        >
          <Tag className="h-3.5 w-3.5" />
          {isPriceSort ? priceSortLabel : "Price"}
          <ChevronDown className={`h-3 w-3 transition-transform ${priceOpen ? "rotate-180" : ""}`} />
        </Button>
        {isPriceSort && (
          <button className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); onSortChange("popular"); }}>
            <X className="h-2.5 w-2.5" />
          </button>
        )}
        <AnimatePresence>
          {priceOpen && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute top-full left-0 mt-1 z-50 bg-background border border-border/50 rounded-lg shadow-xl min-w-[200px] overflow-hidden">
              {PRICE_SORT_OPTIONS.map((opt) => (
                <button key={opt.value}
                  className={`w-full text-left px-3 py-2 text-xs font-display transition-colors ${sort === opt.value ? "bg-primary/10 text-primary font-bold" : "text-foreground hover:bg-secondary/50"}`}
                  onClick={() => { onSortChange(opt.value); setPriceOpen(false); }}>
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Region */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="font-display text-xs tracking-wider gap-1.5 border-border/50"
          onClick={() => { setRegionOpen(!regionOpen); setSortOpen(false); setTypeOpen(false); setPlatformOpen(false); }}
        >
          <Globe className="h-3.5 w-3.5" />
          {region || "All Regions"}
          <ChevronDown className={`h-3 w-3 transition-transform ${regionOpen ? "rotate-180" : ""}`} />
        </Button>
        {region && (
          <button className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); onRegionChange(""); }}>
            <X className="h-2.5 w-2.5" />
          </button>
        )}
        <AnimatePresence>
          {regionOpen && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute top-full left-0 mt-1 z-50 bg-background border border-border/50 rounded-lg shadow-xl min-w-[200px] max-h-64 overflow-y-auto">
              <button className={`w-full text-left px-3 py-2 text-xs font-display transition-colors ${!region ? "bg-primary/10 text-primary font-bold" : "text-foreground hover:bg-secondary/50"}`}
                onClick={() => { onRegionChange(""); setRegionOpen(false); }}>
                <span className="flex justify-between gap-3">
                  <span>All Regions</span>
                  {totalCount !== null && <span className="text-muted-foreground">{totalCount}</span>}
                </span>
              </button>
              {regions.map((r) => (
                <button key={r}
                  className={`w-full text-left px-3 py-2 text-xs font-display transition-colors ${region === r ? "bg-primary/10 text-primary font-bold" : "text-foreground hover:bg-secondary/50"}`}
                  onClick={() => { onRegionChange(r); setRegionOpen(false); }}>
                  <span className="flex justify-between gap-3">
                    <span>{r}</span>
                    {regionCounts && (
                      <span className={regionCounts[r] ? "text-muted-foreground" : "text-muted-foreground/50"}>
                        {regionCounts[r] || 0}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Product type */}
      {advancedEnabled && sortedTypes.length > 1 && (
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="font-display text-xs tracking-wider gap-1.5 border-border/50"
            onClick={() => { setTypeOpen(!typeOpen); setSortOpen(false); setRegionOpen(false); setPlatformOpen(false); }}
          >
            <Layers className="h-3.5 w-3.5" />
            {typeLabel}
            <ChevronDown className={`h-3 w-3 transition-transform ${typeOpen ? "rotate-180" : ""}`} />
          </Button>
          {filters.productTypes.length > 0 && (
            <button className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); update({ productTypes: [] }); }}>
              <X className="h-2.5 w-2.5" />
            </button>
          )}
          <AnimatePresence>
            {typeOpen && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 mt-1 z-50 bg-background border border-border/50 rounded-lg shadow-xl min-w-[200px] max-h-64 overflow-y-auto">
                {sortedTypes.map((t) => (
                  <label key={t} className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-display cursor-pointer hover:bg-secondary/50">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={filters.productTypes.includes(t)} onChange={() => toggleType(t)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary" />
                      <span className="text-foreground">{t}</span>
                    </span>
                    <span className="text-muted-foreground">{typeCounts[t]}</span>
                  </label>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Platform */}
      {advancedEnabled && sortedPlatforms.length > 1 && (
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="font-display text-xs tracking-wider gap-1.5 border-border/50"
            onClick={() => { setPlatformOpen(!platformOpen); setSortOpen(false); setRegionOpen(false); setTypeOpen(false); }}
          >
            <Monitor className="h-3.5 w-3.5" />
            {platformLabel}
            <ChevronDown className={`h-3 w-3 transition-transform ${platformOpen ? "rotate-180" : ""}`} />
          </Button>
          {filters.platforms.length > 0 && (
            <button className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); update({ platforms: [] }); }}>
              <X className="h-2.5 w-2.5" />
            </button>
          )}
          <AnimatePresence>
            {platformOpen && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 mt-1 z-50 bg-background border border-border/50 rounded-lg shadow-xl min-w-[220px] max-h-72 overflow-y-auto">
                {sortedPlatforms.map((p) => (
                  <label key={p} className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-display cursor-pointer hover:bg-secondary/50">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={filters.platforms.includes(p)} onChange={() => togglePlatform(p)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary" />
                      <span className="text-foreground">{p}</span>
                    </span>
                    <span className="text-muted-foreground">{platformCounts[p]}</span>
                  </label>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

/** Apply additional filters to a list — items must expose price/platform/title/tab_category/store */
export function applyAdditionalFilters<T extends FilterableProduct>(items: T[], f: AdditionalFilters): T[] {
  return items.filter((item) => {
    if (f.priceMin !== null && (Number(item.price) || 0) < f.priceMin) return false;
    if (f.priceMax !== null && (Number(item.price) || 0) > f.priceMax) return false;
    if (f.platforms.length > 0 && !f.platforms.includes(item.platform || "")) return false;
    if (f.productTypes.length > 0) {
      const t = detectProductType(item);
      if (!f.productTypes.includes(t)) return false;
    }
    return true;
  });
}

export default ProductFilters;
