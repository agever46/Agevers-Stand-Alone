import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GameCard from "@/components/GameCard";
import ProductFilters, { SortOption, AdditionalFilters, EMPTY_ADDITIONAL_FILTERS, applyAdditionalFilters } from "@/components/ProductFilters";
import { useFlyToCart, FlyToCartOverlay } from "@/components/FlyToCart";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Package, ChevronLeft, ChevronRight, ArrowLeft, Pencil, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { buildSocialProofIndex, findBestAllowedProduct, resolveSocialProof } from "@/lib/socialProof";
import { toast } from "sonner";

import game1 from "@/assets/game1.jpg";
import amazonBrand from "@/assets/brands/amazon.webp";
import googlePlayBrand from "@/assets/brands/google-play.png";
import primarkBrand from "@/assets/brands/primark.webp";
import uberBrand from "@/assets/brands/uber.jpg";
import AgeversLoader from "@/components/AgeversLoader";
import AdminBulkPlatformBar from "@/components/AdminBulkPlatformBar";

/** Custom brand tile images – override auto-detected ones */
const BRAND_IMAGES: Record<string, string> = {
  "Amazon": amazonBrand,
  "Google Play": googlePlayBrand,
  "Primark": primarkBrand,
  "Uber": uberBrand,
};

/** Hardcoded fallback brand keywords – DB auto-groups take priority */
const FALLBACK_BRAND_KEYWORDS = [
  "JUST EAT", "UBER EATS", "GOOGLE PLAY", "RAZER GOLD", "TIM HORTONS",
  "RITZ CARLTON", "TIJUANA FLATS", "DOTS.ECO", "DOTS ECO",
  "OLIVE GARDEN", "OUTBACK STEAKHOUSE", "RED LOBSTER", "BURGER KING",
  "OLD NAVY", "BEST BUY", "HOME DEPOT", "SOUTHWEST AIRLINES",
  "AMAZON", "APPLE", "ITUNES", "ZALANDO", "ASOS", "SEPHORA", "SHEIN",
  "IKEA", "NORDSTROM", "KOHLS", "MACYS", "WAYFAIR", "GAMESTOP", "PRIMARK",
  "DELIVEROO", "DOORDASH", "GRUBHUB", "INSTACART", "STARBUCKS",
  "NANDOS", "NANDO'S", "DUNKIN", "CHIPOTLE", "PANERA",
  "AIRBNB", "LYFT", "UBER", "TOYWORLD", "TOYS R US",
  "VISA", "MASTERCARD", "NEOSURF", "PAYSAFECARD", "VENMO",
  "SPOTIFY", "NETFLIX", "HULU", "CRUNCHYROLL", "DEEZER",
  "STEAM", "ROBLOX", "FORTNITE", "IMVU",
];

function buildBrandKeywords(dbGroups: { keyword: string; display_name: string | null }[]): string[] {
  const dbKeywords = dbGroups.map((g) => g.keyword.toUpperCase());
  // Merge: DB keywords first, then fallbacks not already in DB
  const merged = [...dbKeywords];
  for (const kw of FALLBACK_BRAND_KEYWORDS) {
    if (!merged.includes(kw)) merged.push(kw);
  }
  // Sort by length descending (longer/more specific first)
  return merged.sort((a, b) => b.length - a.length);
}

function formatBrandName(keyword: string): string {
  return keyword
    .split(" ")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function detectBrand(title: string, brandKeywords: string[], dbDisplayNames: Record<string, string>): { key: string; name: string } | null {
  const upper = title.toUpperCase();
  for (const kw of brandKeywords) {
    if (upper.includes(kw)) {
      return {
        key: kw,
        name: dbDisplayNames[kw] || formatBrandName(kw),
      };
    }
  }
  return null;
}

const ITEMS_PER_PAGE = 24;

const GiftCards = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBrand = searchParams.get("brand");

  const { user } = useAuth();
  const [allowedProducts, setAllowedProducts] = useState<any[]>([]);
  const [kinguinProducts, setKinguinProducts] = useState<any[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [productSearch, setProductSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [regionFilter, setRegionFilter] = useState("");
  const [additionalFilters, setAdditionalFilters] = useState<AdditionalFilters>(EMPTY_ADDITIONAL_FILTERS);
  const [isAdmin, setIsAdmin] = useState(false);
  const [brandOverrides, setBrandOverrides] = useState<Record<string, { display_name?: string; image_url?: string; image_zoom?: number }>>({});
  const [editingBrand, setEditingBrand] = useState<{ key: string; name: string; image: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editZoom, setEditZoom] = useState<number>(1.0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dbAutoGroups, setDbAutoGroups] = useState<{ keyword: string; display_name: string | null; image_url: string | null }[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { addItem } = useCart();
  const { flyingItems, triggerFly } = useFlyToCart();

  // Fetch auto-groups from DB
  useEffect(() => {
    supabase
      .from("collections")
      .select("auto_group_keyword, name, image_url")
      .eq("is_active", true)
      .eq("target_page", "Gift Cards")
      .not("auto_group_keyword", "is", null)
      .then(({ data }) => {
        if (data) {
          setDbAutoGroups(
            (data as any[])
              .filter((c) => c.auto_group_keyword?.trim())
              .map((c) => ({
                keyword: c.auto_group_keyword,
                display_name: c.name,
                image_url: c.image_url,
              }))
          );
        }
      });
  }, []);

  // Check admin role
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc("check_my_role" as any, { _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // Fetch brand overrides
  const fetchOverrides = useCallback(async () => {
    const { data } = await supabase.from("brand_overrides" as any).select("*");
    if (data) {
      const map: Record<string, { display_name?: string; image_url?: string; image_zoom?: number }> = {};
      (data as any[]).forEach((o) => {
        map[o.brand_key] = {
          display_name: o.display_name,
          image_url: o.image_url,
          image_zoom: typeof o.image_zoom === "number" ? o.image_zoom : 1.0,
        };
      });
      setBrandOverrides(map);
    }
  }, []);

  useEffect(() => { fetchOverrides(); }, [fetchOverrides]);

  useEffect(() => {
    const fetchData = async () => {
      const pageSize = 1000;

      // Fetch first page of allowed_products + products_public in parallel
      const [firstAllowedRes, productsRes] = await Promise.all([
        supabase
          .from("allowed_products")
          .select("*")
          .eq("platform", "Gift Cards")
          .range(0, pageSize - 1),
        supabase
          .from("products_public" as any)
          .select("*")
          .eq("platform", "Gift Cards")
          .eq("status", "active")
          .order("created_at", { ascending: false }),
      ]);

      const allAllowed: any[] = firstAllowedRes.data ? [...firstAllowedRes.data] : [];
      if (productsRes.data) setDbProducts(productsRes.data);

      // Continue paginating allowed_products if needed
      if (firstAllowedRes.data && firstAllowedRes.data.length === pageSize) {
        let from = pageSize;
        while (true) {
          const { data } = await supabase
            .from("allowed_products")
            .select("*")
            .eq("platform", "Gift Cards")
            .range(from, from + pageSize - 1);
          if (!data || data.length === 0) break;
          allAllowed.push(...data);
          if (data.length < pageSize) break;
          from += pageSize;
        }
      }
      setAllowedProducts(allAllowed);

      const allowedIds = allAllowed.map((a: any) => a.id);
      if (allowedIds.length > 0) {
        const batchSize = 200;
        const batches: string[][] = [];
        for (let i = 0; i < allowedIds.length; i += batchSize) {
          batches.push(allowedIds.slice(i, i + batchSize));
        }
        // Run all kinguin RPC batches in parallel
        const results = await Promise.all(
          batches.map((batch) =>
            supabase.rpc("get_public_kinguin_by_ids" as any, { _ids: batch })
          )
        );
        const allKinguin: any[] = [];
        results.forEach((r) => { if (r.data) allKinguin.push(...r.data); });

        const apMap = new Map(allAllowed.map((a: any) => [a.id, a]));
        const enriched = allKinguin
          .map((kp: any) => ({
            ...kp,
            allowed_products: apMap.get(kp.allowed_product_id) || null,
          }))
          .filter((kp: any) => kp.allowed_products !== null);
        setKinguinProducts(enriched);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setProductSearch("");
  }, [selectedBrand]);

  const socialProofIndex = useMemo(() => buildSocialProofIndex(allowedProducts), [allowedProducts]);

  const brandKeywords = useMemo(() => buildBrandKeywords(dbAutoGroups), [dbAutoGroups]);
  const dbDisplayNames = useMemo(() => {
    const map: Record<string, string> = {};
    dbAutoGroups.forEach((g) => { if (g.display_name) map[g.keyword.toUpperCase()] = g.display_name; });
    return map;
  }, [dbAutoGroups]);

  const { brands, items: allItems } = useMemo(() => {
    const grouped: Record<string, any> = {};

    dbProducts.forEach((p) => {
      const stock = p.stock_count || 0;
      const ap = findBestAllowedProduct(p, socialProofIndex);
      const key = ap ? ap.id : `${p.title}|||${p.platform}|||${p.store}`;
      const kinguinLink = ap ? kinguinProducts.find((kp: any) => kp.allowed_products?.id === ap.id) : null;
      const totalStock = stock > 0 ? stock : (kinguinLink ? (kinguinLink.kinguin_stock || 0) : 0);
      const isKinguinBacked = stock === 0 && !!kinguinLink;
      if (totalStock <= 0) return;

      if (!grouped[key]) {
        grouped[key] = {
          id: ap?.id || p.id,
          title: ap ? ap.title : p.title,
          platform: p.platform,
          store: p.store,
          price: p.price,
          originalPrice: p.original_price ?? undefined,
          image: ap?.image_url || p.image_url || game1,
          sellerCount: 1,
          stock: totalStock,
          isKinguin: isKinguinBacked,
          soldCount: ap?.sold_count || 0,
          wishlistCount: ap?.wishlist_count || 0,
        };
      } else {
        grouped[key].sellerCount += 1;
        grouped[key].stock += totalStock;
        grouped[key].soldCount = Math.max(grouped[key].soldCount || 0, ap?.sold_count || 0);
        grouped[key].wishlistCount = Math.max(grouped[key].wishlistCount || 0, ap?.wishlist_count || 0);
        if (p.price < grouped[key].price) {
          grouped[key].price = p.price;
          grouped[key].id = ap?.id || p.id;
        }
      }
    });

    kinguinProducts.forEach((kp: any) => {
      const ap = kp.allowed_products;
      if (!ap) return;
      const key = ap.id;
      const kinguinStock = kp.kinguin_stock || 0;
      if (grouped[key]) {
        if (!grouped[key].isKinguin) {
          grouped[key].sellerCount += 1;
          grouped[key].stock += kinguinStock;
          grouped[key].isKinguin = true;
          grouped[key].soldCount = Math.max(grouped[key].soldCount || 0, ap.sold_count || 0);
          grouped[key].wishlistCount = Math.max(grouped[key].wishlistCount || 0, ap.wishlist_count || 0);
          if (kp.sell_price < grouped[key].price) {
            grouped[key].price = kp.sell_price;
            grouped[key].id = ap.id;
          }
        }
      } else {
        grouped[key] = {
          id: ap.id,
          title: ap.title,
          platform: ap.platform,
          store: ap.store,
          price: kp.sell_price,
          image: ap.image_url || game1,
          sellerCount: 1,
          stock: kinguinStock,
          isKinguin: true,
          soldCount: ap.sold_count || 0,
          wishlistCount: ap.wishlist_count || 0,
        };
      }
    });

    const allItems = (Object.values(grouped) as any[]).map((item) => {
      const socialProof = resolveSocialProof(item, socialProofIndex);
      const brandMatch = detectBrand(item.title, brandKeywords, dbDisplayNames);

      return {
        ...item,
        region: socialProof.region || "Global",
        brandKey: brandMatch?.key || "__UNGROUPED__",
        brandName: brandMatch?.name || null,
        soldCount: Math.max(item.soldCount ?? 0, socialProof.soldCount),
        wishlistCount: Math.max(item.wishlistCount ?? 0, socialProof.wishlistCount),
      };
    });

    const brandMap: Record<string, { name: string; key: string; image: string; count: number; minPrice: number; imageZoom: number }> = {};
    allItems.forEach((item) => {
      if (item.brandKey === "__UNGROUPED__") return;
      if (!brandMap[item.brandKey]) {
        brandMap[item.brandKey] = {
          name: item.brandName || formatBrandName(item.brandKey),
          key: item.brandKey,
          image: item.image,
          count: 0,
          minPrice: item.price,
          imageZoom: 1.0,
        };
      }
      brandMap[item.brandKey].count += 1;
      if (item.price < brandMap[item.brandKey].minPrice) {
        brandMap[item.brandKey].minPrice = item.price;
      }
      if (item.image !== game1 && brandMap[item.brandKey].image === game1) {
        brandMap[item.brandKey].image = item.image;
      }
    });

    const brandList = Object.values(brandMap)
      .filter((b) => b.count >= 1)
      .sort((a, b) => b.count - a.count);
    // Build lookup for auto-group images
    const autoGroupImages: Record<string, string> = {};
    dbAutoGroups.forEach((g) => {
      if (g.image_url) {
        autoGroupImages[g.keyword.toUpperCase()] = g.image_url;
      }
    });
    // Build case-insensitive override lookup
    const overrideLookup: Record<string, { display_name?: string; image_url?: string; image_zoom?: number }> = {};
    Object.entries(brandOverrides).forEach(([key, val]) => {
      overrideLookup[key.toLowerCase()] = val;
    });
    brandList.forEach((b) => {
      if (BRAND_IMAGES[b.name]) b.image = BRAND_IMAGES[b.name];
      // Apply auto-group images
      if (autoGroupImages[b.key]) b.image = autoGroupImages[b.key];
      // Apply DB overrides (highest priority)
      const override = overrideLookup[b.key.toLowerCase()];
      if (override?.image_url) b.image = override.image_url;
      if (override?.display_name) b.name = override.display_name;
      if (typeof override?.image_zoom === "number") b.imageZoom = override.image_zoom;
    });

    return {
      brands: brandList,
      items: allItems,
    };
  }, [dbProducts, kinguinProducts, socialProofIndex, brandOverrides, brandKeywords, dbDisplayNames, dbAutoGroups]);

  // Filter by selected brand (selectedBrand stores the brand KEY, not display name)
  const normalizedSelectedBrand = selectedBrand?.toLowerCase() ?? null;
  let filteredItems = selectedBrand
    ? allItems.filter(
        (i) =>
          i.brandKey === selectedBrand ||
          i.brandName?.toLowerCase() === normalizedSelectedBrand
      )
    : allItems;
  // Resolve display name for the selected brand from brand list
  const selectedBrandDisplay = selectedBrand
    ? (brands.find((b) => b.key === selectedBrand || b.name.toLowerCase() === normalizedSelectedBrand)?.name ?? selectedBrand)
    : null;

  // Items without a recognized brand (shown as individual cards under brand tiles)
  const ungroupedItems = useMemo(
    () => allItems.filter((i) => i.brandKey === "__UNGROUPED__"),
    [allItems]
  );

  // Product search within brand
  if (productSearch) {
    const q = productSearch.toLowerCase();
    filteredItems = filteredItems.filter((i) => i.title.toLowerCase().includes(q));
  }

  // Region filter
  if (regionFilter) {
    filteredItems = filteredItems.filter((i) => i.region === regionFilter);
  }
  filteredItems = applyAdditionalFilters(filteredItems, additionalFilters);

  // Sort
  if (sortBy === "price-asc") filteredItems.sort((a, b) => a.price - b.price);
  else if (sortBy === "price-desc") filteredItems.sort((a, b) => b.price - a.price);
  else if (sortBy === "newest") filteredItems.sort((a, b) => b.id.localeCompare(a.id));
  else if (sortBy === "oldest") filteredItems.sort((a, b) => a.id.localeCompare(b.id));
  else filteredItems.sort((a, b) => b.sellerCount - a.sellerCount);

  // Region options + counts derived from the brand items BEFORE region filter,
  // so users can see how many items each region has.
  const brandItemsForRegions = selectedBrand
    ? allItems.filter(
        (i) =>
          i.brandKey === selectedBrand ||
          i.brandName?.toLowerCase() === normalizedSelectedBrand
      )
    : allItems;
  const availableRegions = [...new Set(brandItemsForRegions.map((i) => i.region))].sort();
  const regionCounts = brandItemsForRegions.reduce((acc, i) => {
    const r = i.region || "Global";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleAddToCart = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerFly(e);
    addItem({
      offerId: item.id,
      title: item.title,
      platform: item.platform,
      price: item.price,
      sellerName: item.isKinguin ? "Agevers" : "Seller",
      image_url: item.image,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <FlyToCartOverlay items={flyingItems} />

      <section className="pt-48 pb-8">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {selectedBrand ? (
              <div className="flex items-center gap-2 mb-6">
                <Button variant="ghost" size="sm" onClick={() => { setSearchParams({}); setCurrentPage(1); setProductSearch(""); }}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <h1 className="font-display text-2xl md:text-4xl font-black tracking-wider text-foreground">
                  {selectedBrandDisplay}
                </h1>
              </div>
            ) : (
              <div className="text-center mb-8">
                <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground mb-2">
                  GIFT CARDS
                </h1>
                <p className="text-muted-foreground">Browse gift cards from your favorite brands</p>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex justify-center py-20">
              <AgeversLoader />
            </div>
          ) : !selectedBrand ? (
            /* ---- Brand Tiles Grid ---- */
            brands.length === 0 && ungroupedItems.length === 0 ? (
              <div className="text-center py-20 glass rounded-xl">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground font-display">No gift cards available yet.</p>
              </div>
            ) : (
              <>
              {brands.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
              >
                {brands.map((brand) => (
                  <motion.div
                    key={brand.key}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="glass rounded-xl overflow-hidden text-left group cursor-pointer border border-border/50 hover:border-primary/40 transition-colors relative"
                    onClick={() => setSearchParams({ brand: brand.key })}
                  >
                    {isAdmin && (
                      <button
                        className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity border border-border/50 hover:bg-primary hover:text-primary-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBrand({ key: brand.key, name: brand.name, image: brand.image });
                          setEditName(brand.name);
                          setEditImageUrl(brand.image);
                          setEditZoom(brand.imageZoom ?? 1.0);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div className="aspect-square overflow-hidden bg-background/50 p-2">
                      <img
                        src={brand.image}
                        alt={brand.name}
                        className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
                        style={{ transform: `scale(${brand.imageZoom ?? 1})` }}
                        loading="lazy"
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="font-display text-sm font-bold text-foreground line-clamp-1">
                        {brand.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {brand.count} {brand.count === 1 ? "product" : "products"} · From €{brand.minPrice.toFixed(2)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
              )}
              {ungroupedItems.length > 0 && (
                <div className={brands.length > 0 ? "mt-8" : ""}>
                  {brands.length > 0 && (
                    <h2 className="font-display text-lg font-bold tracking-wider text-foreground mb-4 uppercase">
                      More Gift Cards
                    </h2>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {ungroupedItems.map((item) => (
                      <motion.a
                        key={item.id}
                        href={`/product/${item.slug || item.id}`}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        className="glass rounded-xl overflow-hidden text-left group cursor-pointer border border-border/50 hover:border-primary/40 transition-colors block"
                      >
                        <div className="aspect-square overflow-hidden bg-background/50 p-2">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                        </div>
                        <div className="p-2.5">
                          <p className="font-display text-sm font-bold text-foreground line-clamp-1">
                            {item.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            From €{item.price.toFixed(2)}
                          </p>
                        </div>
                      </motion.a>
                    ))}
                  </div>
                </div>
              )}
              </>
            )
          ) : (
            /* ---- Products for selected brand ---- */
            <>
               <ProductFilters
                sort={sortBy}
                onSortChange={(s) => { setSortBy(s); setCurrentPage(1); }}
                region={regionFilter}
                onRegionChange={(r) => { setRegionFilter(r); setCurrentPage(1); }}
                availableRegions={availableRegions}
                regionCounts={regionCounts}
                searchQuery={productSearch}
                onSearchChange={(q) => { setProductSearch(q); setCurrentPage(1); }}
                products={selectedBrand ? allItems.filter((i) => i.brandKey === selectedBrand || i.brandName?.toLowerCase() === normalizedSelectedBrand) : allItems}
                additionalFilters={additionalFilters}
                onAdditionalFiltersChange={(f) => { setAdditionalFilters(f); setCurrentPage(1); }}
              />
              <AdminBulkPlatformBar
                selectMode={selectMode}
                setSelectMode={setSelectMode}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                visibleIds={paginatedItems.map((i) => i.id)}
                onComplete={() => window.location.reload()}
              />
              {filteredItems.length === 0 ? (
                <div className="text-center py-20 glass rounded-xl">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground font-display">No products available.</p>
                </div>
              ) : (
                <>
                  <motion.div
                    key={`${selectedBrand}-${currentPage}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
                  >
                    {paginatedItems.map((item) => (
                      <GameCard
                        key={item.id}
                        id={item.id}
                        title={item.title}
                        platform={item.platform}
                        slug={item.slug}
                        price={item.price}
                        originalPrice={item.originalPrice}
                        image={item.image}
                        sellerCount={item.sellerCount}
                        stock={item.stock}
                        isKinguin={item.isKinguin}
                        soldCount={item.soldCount}
                        wishlistCount={item.wishlistCount}
                        onAddToCart={(e) => handleAddToCart(item, e)}
                        selectable={selectMode}
                        selected={selectedIds.has(item.id)}
                        onSelect={(id) => {
                          const next = new Set(selectedIds);
                          if (next.has(id)) next.delete(id); else next.add(id);
                          setSelectedIds(next);
                        }}
                      />
                    ))}
                  </motion.div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <Button variant="ghost" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className="text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={page === currentPage ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={`font-display min-w-[36px] ${page === currentPage ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button variant="ghost" size="icon" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="text-muted-foreground hover:text-foreground">
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />

      {/* Admin Brand Edit Dialog */}
      <Dialog open={!!editingBrand} onOpenChange={(open) => !open && setEditingBrand(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Brand Tile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-display">Display Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Brand name"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-display">Image URL</Label>
              <Input
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
              <div className="mt-2">
                <Label className="text-sm font-display">Or upload from device</Label>
                <div className="mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    className="relative"
                    onClick={() => document.getElementById("brand-image-upload")?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Uploading..." : "Choose File"}
                  </Button>
                  <input
                    id="brand-image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !editingBrand) return;
                      setUploading(true);
                      try {
                        const ext = file.name.split(".").pop() || "webp";
                        const path = `brands/${editingBrand.key.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}.${ext}`;
                        const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
                        if (upErr) throw upErr;
                        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
                        setEditImageUrl(urlData.publicUrl);
                        toast.success("Image uploaded");
                      } catch (err: any) {
                        toast.error(err.message || "Upload failed");
                      } finally {
                        setUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            {editImageUrl && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-display">Image Zoom</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={50}
                        max={150}
                        step={1}
                        value={Math.round(editZoom * 100)}
                        onChange={(e) => {
                          const raw = parseFloat(e.target.value);
                          if (Number.isNaN(raw)) return;
                          const clamped = Math.min(150, Math.max(50, raw));
                          setEditZoom(clamped / 100);
                        }}
                        className="h-7 w-16 text-xs tabular-nums px-2"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <Slider
                    value={[editZoom]}
                    min={0.5}
                    max={1.5}
                    step={0.05}
                    onValueChange={(v) => setEditZoom(v[0])}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>50%</span>
                    <span>100%</span>
                    <span>150%</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-display mb-2 block">Preview</Label>
                  <div className="rounded-lg overflow-hidden border border-border/50 aspect-square max-w-[150px] bg-background/50 p-2">
                    <img
                      src={editImageUrl}
                      alt="Preview"
                      className="w-full h-full object-contain"
                      style={{ transform: `scale(${editZoom})` }}
                    />
                  </div>
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditingBrand(null)}>Cancel</Button>
              <Button
                disabled={saving}
                onClick={async () => {
                  if (!editingBrand) return;
                  setSaving(true);
                  try {
                    const { error } = await supabase.from("brand_overrides" as any).upsert(
                      {
                        brand_key: editingBrand.key,
                        display_name: editName || null,
                        image_url: editImageUrl || null,
                        image_zoom: editZoom,
                        updated_at: new Date().toISOString(),
                      },
                      { onConflict: "brand_key" }
                    );
                    if (error) throw error;
                    toast.success("Brand updated");
                    await fetchOverrides();
                    setEditingBrand(null);
                  } catch (err: any) {
                    toast.error(err.message || "Failed to save");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiftCards;
