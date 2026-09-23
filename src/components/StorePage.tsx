import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavMenu } from "@/hooks/useNavMenu";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GameCard from "@/components/GameCard";
import ProductFilters, { SortOption, AdditionalFilters, EMPTY_ADDITIONAL_FILTERS, applyAdditionalFilters } from "@/components/ProductFilters";
import { useFlyToCart, FlyToCartOverlay } from "@/components/FlyToCart";
import { useCart } from "@/hooks/useCart";
import { motion } from "framer-motion";
import { Gamepad2, Coins, LucideIcon, Package, ChevronLeft, ChevronRight, Pencil, X, CheckSquare, Ticket, CreditCard, Gift, Smartphone, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import CollectionTiles from "@/components/CollectionTiles";
import AutoGroupTiles from "@/components/AutoGroupTiles";
import AdminProductEditModal from "@/components/admin/AdminProductEditModal";
import { buildSocialProofIndex, findBestAllowedProduct, resolveSocialProof } from "@/lib/socialProof";
import { getProductTypeLabel } from "@/lib/gameItemClassifier";
import { navMenuMatchScore, type NavMenuFilterItem } from "@/lib/navMenuFilter";
import { useGameGroupMap } from "@/hooks/useGameGroupMap";

import game1 from "@/assets/game1.jpg";
import AgeversLoader from "@/components/AgeversLoader";
import { GameCardSkeletonGrid } from "@/components/GameCardSkeleton";

const defaultCategories = [
  { id: "games", name: "Games", icon: Gamepad2 },
  { id: "topups", name: "Top Ups", icon: Coins },
];

/** Map well-known tab names to icons */
const TAB_ICON_MAP: Record<string, LucideIcon> = {
  games: Gamepad2,
  "top ups": Coins,
  topups: Coins,
  subscriptions: Ticket,
  dlc: Package,
  "gift cards": Gift,
  mobile: Smartphone,
  "in-game items": CreditCard,
};

const iconForTabName = (name: string): LucideIcon =>
  TAB_ICON_MAP[name.toLowerCase()] || Package;

/** Returns true when an allowed_product (or seller product) is a DLC / Season Pass / Expansion. */
const isDLCAllowed = (ap: any): boolean => {
  if (!ap) return false;
  if (ap.tab_category === "dlc") return true;
  if (ap.tab_category && ap.tab_category !== "dlc") return false;
  const label = getProductTypeLabel({
    title: ap.title || "",
    originalTitle: ap.original_title || null,
    description: ap.description || "",
    category: ap.category || null,
    store: ap.store || null,
    productType: ap.product_type || null,
  });
  return (
    label === "DLC" ||
    label === "Season Pass" ||
    label === "Expansion" ||
    label === "Skin" ||
    label === "Currency"
  );
};

/**
 * Detect which tab a product belongs to in platformMode (Xbox / PlayStation / Nintendo).
 * Tabs: "subscriptions" | "topups" | "games".
 * Falls back to title heuristics when admin-set tab_category is missing.
 */
const detectPlatformTab = (ap: any): "subscriptions" | "topups" | "games" => {
  if (!ap) return "games";
  // Admin override wins
  if (ap.tab_category === "subscriptions") return "subscriptions";
  if (ap.tab_category === "topups") return "topups";
  if (ap.tab_category === "games") return "games";
  if (ap.tab_category === "dlc") return "games"; // DLC handled separately
  if (ap.tab_category === "gift cards") return "topups";

  const title = (ap.title || "").toUpperCase();

  // Subscriptions: Game Pass, Live Gold, Core, PS Plus, Nintendo Online, EA Play, etc.
  if (
    /\bGAME\s*PASS\b/.test(title) ||
    /\bXBOX\s*LIVE\s*GOLD\b/.test(title) ||
    /\bXBOX\s*CORE\b/.test(title) ||
    /\bPS\s*(PLUS|\+)\b/.test(title) ||
    /\bPLAYSTATION\s*(PLUS|NOW)\b/.test(title) ||
    /\bNINTENDO\s*(SWITCH\s*)?ONLINE\b/.test(title) ||
    /\bEA\s*(PLAY|ACCESS)\b/.test(title) ||
    /\bUBISOFT\+?\s*(CLASSICS|PREMIUM)?\b/.test(title) ||
    /\bSUBSCRIPTION\b/.test(title) ||
    /\b(1|3|6|12)\s*MONTHS?\b/.test(title) && (/(GAME\s*PASS|XBOX|PS\s*PLUS|NINTENDO|EA\s*PLAY)/.test(title))
  ) {
    return "subscriptions";
  }

  // Top-ups / wallet / prepaid / gift cards
  if (
    title.includes("WALLET") ||
    title.includes("TOP UP") ||
    title.includes("TOPUP") ||
    title.includes("PREPAID") ||
    title.includes("GIFT CARD") ||
    title.includes("GIFT-CARD") ||
    /\bXBOX\s*LIVE\b.*\b(CARD|POINTS?|EUR|USD|GBP|NOK|SEK|ZAR|TWD|AUD|NZD|\$|€|£|¥)/.test(title) ||
    /\bPSN\b.*\b(CARD|POINTS?|EUR|USD|GBP|\$|€|£)/.test(title) ||
    /\bMICROSOFT\s*POINTS?\b/.test(title) ||
    /\bNINTENDO\s*ESHOP\b/.test(title) ||
    ap.store === "Gift Cards"
  ) {
    return "topups";
  }

  return "games";
};

/** Extract tab id from href like "/epic-games?tab=topups" */
const extractTabId = (href: string): string => {
  try {
    const url = new URL(href, "http://x");
    return url.searchParams.get("tab") || href.split("/").pop() || "all";
  } catch { return "all"; }
};

interface StorePageProps {
  storeName: string;
  description: string;
  categories?: { id: string; name: string; icon: LucideIcon }[];
  /** When set, filters by platform instead of store, and uses store field as category */
  platformMode?: boolean;
  /** When true, only show collection tiles - no product listing */
  tilesOnly?: boolean;
  /** When true, hide collection tiles */
  hideCollectionTiles?: boolean;
  /** When true, auto-read tabs from nav menu subcategories instead of using categories prop */
  autoTabs?: boolean;
  /** When set, enables auto-group tiles for the given target_page (e.g. "Gaming Accessories") */
  autoGroupPage?: string;
  /** When true, keep showing the product grid even when auto-group tiles exist */
  showProductsWithAutoGroups?: boolean;
}

const ITEMS_PER_PAGE = 30;
const PAGE_SIZE = 1000;

const dedupeAllowedProducts = (products: any[]) => {
  const seen = new Map<string, any>();

  products.forEach((product) => {
    if (product?.id && !seen.has(product.id)) {
      seen.set(product.id, product);
    }
  });

  return Array.from(seen.values());
};

const StorePage = ({ storeName, description, categories: explicitCategories, platformMode = false, tilesOnly = false, hideCollectionTiles = false, autoTabs = false, autoGroupPage, showProductsWithAutoGroups = false }: StorePageProps) => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { categories: navCategories } = useNavMenu();

  // Derive tabs from nav menu subcategories when autoTabs is enabled
  const baseCategories = useMemo(() => {
    if (!autoTabs) return explicitCategories ?? defaultCategories;
    const storeSlug = storeName.toLowerCase().replace(/\s+/g, "-");
    
    // Search all levels: could be top-level, or a subcategory (e.g. Epic Games under PC)
    for (const cat of navCategories) {
      // Check top-level match
      if (cat.name.toLowerCase() === storeName.toLowerCase() || cat.href.replace(/^\//, "").toLowerCase() === storeSlug) {
        if (cat.subcategories?.length) {
          return cat.subcategories.filter((s) => s.is_visible).sort((a, b) => a.display_order - b.display_order)
            .map((s) => ({ id: extractTabId(s.href), name: s.name, icon: iconForTabName(s.name), navItemId: s.id, filterKeywords: s.filter_keywords || [] }));
        }
      }
      // Check subcategory match (e.g. Epic Games under PC)
      for (const sub of cat.subcategories || []) {
        if (sub.name.toLowerCase() === storeName.toLowerCase() || sub.href.replace(/^\//, "").toLowerCase() === storeSlug) {
          if (sub.subcategories?.length) {
            return sub.subcategories.filter((s) => s.is_visible).sort((a, b) => a.display_order - b.display_order)
              .map((s) => ({ id: extractTabId(s.href), name: s.name, icon: iconForTabName(s.name), navItemId: s.id, filterKeywords: s.filter_keywords || [] }));
          }
        }
      }
    }
    // Leaf page with no real nav subcategories of its own — the generic
    // Games/Top Ups guess doesn't fit every store and silently hides
    // products whose tab_category/title doesn't happen to match "games".
    // Show one flat list instead of guessing.
    return explicitCategories ?? [];
  }, [autoTabs, explicitCategories, navCategories, storeName]);

  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [allowedProducts, setAllowedProducts] = useState<any[]>([]);
  const [kinguinProducts, setKinguinProducts] = useState<any[]>([]);

  // Augment base tabs with an auto-injected "DLC" tab when this store contains DLC products
  const categories = useMemo(() => {
    // Respect explicit empty categories (tilesOnly pages like In-Game Items)
    if (explicitCategories && explicitCategories.length === 0 && !autoTabs) return [];
    if (baseCategories.some((t) => t.id === "dlc")) return baseCategories;
    // Leaf pages with no real tab structure (baseCategories empty) must never
    // get a lone "DLC" tab injected — that would make it the only tab and
    // hide every non-DLC product on the page.
    if (baseCategories.length === 0 || !allowedProducts.some(isDLCAllowed)) return baseCategories;
    const gamesIdx = baseCategories.findIndex((t) => t.id === "games");
    const dlcTab = { id: "dlc", name: "DLC", icon: Package } as any;
    const next = [...baseCategories];
    if (gamesIdx >= 0) next.splice(gamesIdx + 1, 0, dlcTab);
    else next.push(dlcTab);
    return next;
  }, [baseCategories, allowedProducts, explicitCategories, autoTabs]);

  const tabParam = searchParams.get("tab");
  const hasCategories = categories.length > 0;
  const isSingleStoreCategoryPage = !platformMode && !autoTabs && categories.length === 1 && categories[0]?.name.toLowerCase() === storeName.toLowerCase();
  const initialTab = hasCategories ? ((tabParam && categories.some((c) => c.id === tabParam)) ? tabParam : categories[0]?.id || "games") : "all";
  const [activeCategory, setActiveCategory] = useState(initialTab);

  const [wishlistCounts, setWishlistCounts] = useState<Record<string, number>>({});
  const [variationStockMap, setVariationStockMap] = useState<Record<string, { stock: number; minPrice: number }>>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [regionFilter, setRegionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [additionalFilters, setAdditionalFilters] = useState<AdditionalFilters>(EMPTY_ADDITIONAL_FILTERS);
  const { addItem } = useCart();
  const { flyingItems, triggerFly } = useFlyToCart();
  const { data: gameGroupMap } = useGameGroupMap();

  // Auto-group filter state
  const [autoGroupFilter, setAutoGroupFilter] = useState<string | null>(null);
  const [hasAutoGroupTiles, setHasAutoGroupTiles] = useState<boolean | null>(autoGroupPage ? null : false);
  const [groupedKeywords, setGroupedKeywords] = useState<string[]>([]);

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.rpc("check_my_role" as any, { _role: "admin" });
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (tabParam && categories.some((c) => c.id === tabParam)) {
      setActiveCategory(tabParam);
    }
  }, [tabParam, categories]);

  const fetchAll = async (query: () => any) => {
    let all: any[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await query().range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;

      all = all.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return all;
  };

  const PHYSICAL_STORES = ["Gaming Accessories"];
  const isPhysicalStore = PHYSICAL_STORES.some(s => s.toLowerCase() === storeName.toLowerCase());

  const fetchStoreData = async () => {
    setLoading(true);
    const filterField = platformMode ? "platform" : "store";

    try {
      // Step 1: fetch products_public AND allowed_products in parallel (both already filtered by store)
      // Uses ilike (not eq) so a casing/whitespace slip between the nav menu's
      // page name and a product's store/platform value (two independently
      // typed fields) doesn't silently produce an empty page.
      const storeNameTrimmed = storeName.trim();
      const [productsData, allowedData] = await Promise.all([
        fetchAll(() =>
          supabase
            .from("products_public" as any)
            .select("id, title, platform, store, price, original_price, image_url, status, stock_count, created_at")
            .ilike(filterField, storeNameTrimmed)
            .eq("status", "active")
            .order("created_at", { ascending: false })
        ),
        fetchAll(() =>
          supabase
            .from("allowed_products")
            .select("id, title, original_title, product_type, description, image_url, platform, store, region, created_at, release_date, badges, tab_category, sold_count, wishlist_count, aliexpress_product_id, nav_menu_includes, nav_menu_excludes")
            .ilike(filterField, storeNameTrimmed)
        ),
      ]);

      // Step 2: fetch ONLY the kinguin products that map to the allowed_products of this store
      // (was previously loading the full ~10k Kinguin catalog every time)
      const kinguinData: any[] = isPhysicalStore || allowedData.length === 0
        ? []
        : await (async () => {
            const apIds = allowedData.map((a: any) => a.id);
            const all: any[] = [];
            const CHUNK = 500;
            for (let i = 0; i < apIds.length; i += CHUNK) {
              const chunk = apIds.slice(i, i + CHUNK);
              const { data } = await supabase.rpc("get_public_kinguin_by_ids" as any, { _ids: chunk });
              if (data && Array.isArray(data)) all.push(...data);
            }
            return all;
          })();

      setDbProducts(productsData);
      setAllowedProducts(allowedData);

      // Enrich kinguin data with allowed_products info
      const apMap = new Map(allowedData.map((a: any) => [a.id, a]));
      const enrichedKinguin = kinguinData
        .map((kp: any) => ({
          ...kp,
          allowed_products: apMap.get(kp.allowed_product_id) || null,
        }))
        .filter((kp: any) => kp.allowed_products !== null);
      setKinguinProducts(enrichedKinguin);

      // Fetch wishlist counts in batch
      const allTitles = allowedData.map((a: any) => a.title);
      if (allTitles.length > 0) {
        const { data: wCounts } = await supabase.rpc("get_wishlist_counts_batch" as any, { _game_titles: allTitles });
        if (wCounts && Array.isArray(wCounts)) {
          const map: Record<string, number> = {};
          (wCounts as any[]).forEach((row: any) => { map[row.game_title] = Number(row.wishlist_count); });
          setWishlistCounts(map);
        }
      }

      // Fetch product_variations stock for physical stores
      if (isPhysicalStore && allowedData.length > 0) {
        const apIds = allowedData.map((a: any) => a.id);
        const { data: varData } = await (supabase.rpc as any)("get_public_variation_stock", {
          _allowed_product_ids: apIds,
        });
        if (varData && varData.length > 0) {
          const vMap: Record<string, { stock: number; minPrice: number }> = {};
          (varData as any[]).forEach((v: any) => {
            const pid = v.allowed_product_id;
            const vStock = v.stock || 0;
            const vPrice = v.price || 0;
            if (!vMap[pid]) {
              vMap[pid] = { stock: vStock, minPrice: vPrice > 0 ? vPrice : Infinity };
            } else {
              vMap[pid].stock += vStock;
              if (vPrice > 0 && vPrice < vMap[pid].minPrice) vMap[pid].minPrice = vPrice;
            }
          });
          // Fix Infinity
          Object.values(vMap).forEach((v) => { if (v.minPrice === Infinity) v.minPrice = 0; });
          setVariationStockMap(vMap);
        }
      } else {
        setVariationStockMap({});
      }
    } catch (error) {
      console.error(`Failed to fetch ${storeName} products:`, error);
      setDbProducts([]);
      setAllowedProducts([]);
      setKinguinProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreData();
  }, [storeName, platformMode]);

  // GEO/SEO: page title, meta description, CollectionPage + BreadcrumbList JSON-LD
  useEffect(() => {
    const slug = storeName.toLowerCase().replace(/\s+/g, "-");
    const url = `https://agevers.com/${slug}`;
    const prevTitle = document.title;
    document.title = `${storeName} Game Codes & Keys — Instant Delivery | Agever's`;
    const metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute("content") || "";
    const newDesc = `Buy ${storeName} digital game codes and keys with instant delivery. Verified stock, EUR pricing with multi-currency support, refundable within 14 days at Agever's.`;
    metaDesc?.setAttribute("content", newDesc);

    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          name: `${storeName} Game Codes`,
          url,
          description: newDesc,
          isPartOf: { "@type": "WebSite", name: "Agever's", url: "https://agevers.com/" },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://agevers.com/" },
            { "@type": "ListItem", position: 2, name: storeName, item: url },
          ],
        },
      ],
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "store-jsonld";
    script.textContent = JSON.stringify(jsonLd);
    document.getElementById("store-jsonld")?.remove();
    document.head.appendChild(script);

    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc) metaDesc.setAttribute("content", prevDesc);
      document.getElementById("store-jsonld")?.remove();
    };
  }, [storeName]);

  useEffect(() => {
    setHasAutoGroupTiles(autoGroupPage ? null : false);
    setAutoGroupFilter(null);
  }, [autoGroupPage, storeName]);

  const findAllowedProduct = (p: any) => {
    return findBestAllowedProduct(p, socialProofIndex);
  };

  const socialProofIndex = useMemo(() => buildSocialProofIndex(allowedProducts), [allowedProducts]);

  // Calculate stock from stock_count (from products_public view)
  const getSellerStock = (product: any): number => {
    return product.stock_count || 0;
  };

  const hasDLCTab = categories.some((c) => c.id === "dlc");

  // Find the active nav menu item for the current tab (if any).
  const activeNavItem: NavMenuFilterItem | null = useMemo(() => {
    const cat: any = categories.find((c) => c.id === activeCategory);
    if (!cat?.navItemId) return null;
    return {
      id: cat.navItemId,
      href: "",
      filter_keywords: cat.filterKeywords || [],
    };
  }, [categories, activeCategory]);

  // Decide whether to use the dynamic nav-menu filter for this tab.
  // Active when the tab has filter_keywords OR any product manually included/excluded for it.
  const useNavMenuFilter = useMemo(() => {
    if (!activeNavItem) return false;
    if ((activeNavItem.filter_keywords || []).length > 0) return true;
    return allowedProducts.some(
      (ap: any) =>
        (ap.nav_menu_includes || []).includes(activeNavItem.id) ||
        (ap.nav_menu_excludes || []).includes(activeNavItem.id)
    );
  }, [activeNavItem, allowedProducts]);

  // Per-allowed-product score for the active tab (only when nav-menu filter is active).
  const navMenuScoreByApId = useMemo(() => {
    const map: Record<string, number> = {};
    if (!useNavMenuFilter || !activeNavItem) return map;
    allowedProducts.forEach((ap: any) => {
      map[ap.id] = navMenuMatchScore(ap, activeNavItem);
    });
    return map;
  }, [useNavMenuFilter, activeNavItem, allowedProducts]);

  // Filter products: skip category filter when no categories defined
  const filteredProducts = dbProducts.filter((p) => {
    if (!hasCategories) return true;
    if (isSingleStoreCategoryPage) return true;
    if (useNavMenuFilter) {
      const ap = findAllowedProduct(p);
      if (!ap) return false;
      return (navMenuScoreByApId[ap.id] || 0) > 0;
    }
    // DLC tab works the same in platformMode and regular mode
    if (hasDLCTab && (activeCategory === "dlc" || (platformMode && activeCategory === "games"))) {
      const ap = findAllowedProduct(p);
      const isDLC = isDLCAllowed(ap || { title: p.title, store: p.store });
      if (activeCategory === "dlc") return isDLC;
      // platformMode "games" tab: keep current store match but exclude DLC
      const activeCat = categories.find((c) => c.id === activeCategory);
      if (!activeCat) return false;
      if (isDLC) return false;
      // Exclude top-ups & subscriptions from the games tab too
      const apForType = ap || { title: p.title, store: p.store, tab_category: null };
      if (detectPlatformTab(apForType) !== "games") return false;
      return true;
    }
    if (platformMode) {
      const activeCat = categories.find((c) => c.id === activeCategory);
      if (!activeCat) return false;
      const ap = findAllowedProduct(p);
      const apForType = ap || { title: p.title, store: p.store, tab_category: null };
      return detectPlatformTab(apForType) === activeCategory;
    }
    if (hasDLCTab && activeCategory === "games") {
      const ap = findAllowedProduct(p);
      const isDLC = isDLCAllowed(ap || { title: p.title, store: p.store });
      return p.category === "games" && !isDLC;
    }
    return p.category === activeCategory;
  });

  // Filter kinguin products by active category
  const filteredKinguin = kinguinProducts.filter((kp: any) => {
    const ap = kp.allowed_products;
    if (!ap) return false;
    if (!hasCategories) return true;
    if (isSingleStoreCategoryPage) return true;
    if (useNavMenuFilter) {
      return (navMenuScoreByApId[ap.id] || 0) > 0;
    }
    if (hasDLCTab && (activeCategory === "dlc" || (platformMode && activeCategory === "games"))) {
      const isDLC = isDLCAllowed(ap);
      if (activeCategory === "dlc") return isDLC;
      const activeCat = categories.find((c) => c.id === activeCategory);
      if (!activeCat) return false;
      if (isDLC) return false;
      return detectPlatformTab(ap) === "games";
    }
    if (platformMode) {
      const activeCat = categories.find((c) => c.id === activeCategory);
      if (!activeCat) return false;
      return detectPlatformTab(ap) === activeCategory;
    }
    // DLC tab routing: send DLC products to the DLC tab; exclude from "games"
    if (hasDLCTab) {
      const isDLC = isDLCAllowed(ap);
      if (activeCategory === "dlc") return isDLC;
      if (activeCategory === "games") {
        if (isDLC) return false;
        // fall through to the games/topups detection below
      }
    }
    // Use explicit tab_category if set, otherwise detect from title
    if (ap.tab_category) {
      return ap.tab_category === activeCategory;
    }
    const titleUpper = (ap.title || "").toUpperCase();
    const isTopUp = titleUpper.includes("WALLET") || titleUpper.includes("TOP UP") || titleUpper.includes("TOPUP") || titleUpper.includes("PREPAID") || titleUpper.includes("GIFT CARD");
    if (activeCategory === "topups") return isTopUp;
    if (activeCategory === "games") return !isTopUp;
    return activeCategory === categories[0]?.id;
  });

  // Group seller products
  const grouped: Record<string, any> = {};

  filteredProducts.forEach((p) => {
    const sellerStock = getSellerStock(p);
    const ap = findAllowedProduct(p);
    const key = ap ? ap.id : `${p.title}|||${p.platform}|||${p.store}`;

    // Check if this product has a Kinguin link (use Kinguin stock if no codes)
    const kinguinLink = ap ? kinguinProducts.find((kp: any) => kp.allowed_products?.id === ap.id) : null;
    const stock = sellerStock > 0 ? sellerStock : (kinguinLink ? (kinguinLink.kinguin_stock || 0) : 0);
    const isKinguinBacked = sellerStock === 0 && !!kinguinLink;

    if (stock <= 0) return;

    if (!grouped[key]) {
      grouped[key] = {
        id: ap?.id || p.id,
        title: ap ? ap.title : p.title,
        platform: p.platform,
        slug: ap?.slug,
        price: p.price,
        originalPrice: p.original_price ?? undefined,
        image: (ap?.image_url || p.image_url || game1),
        sellerCount: 1,
        stock,
        isKinguin: isKinguinBacked,
        badges: ap?.badges || [],
        soldCount: ap?.sold_count || 0,
        wishlistCount: ap?.wishlist_count || 0,
        store: ap?.store || p.store,
        tab_category: ap?.tab_category || null,
        productType: ap?.product_type || null,
        releaseDate: (ap as any)?.release_date || null,
        originalTitle: ap?.original_title || null,
      };
    } else {
      grouped[key].sellerCount += 1;
      grouped[key].stock += stock;
      if (p.price < grouped[key].price) {
        grouped[key].price = p.price;
        grouped[key].id = ap?.id || p.id;
      }
      if (p.original_price && (!grouped[key].originalPrice || p.original_price > grouped[key].originalPrice)) {
        grouped[key].originalPrice = p.original_price;
      }
    }
  });

  // Add Kinguin products (merge with existing or add new)
  filteredKinguin.forEach((kp: any) => {
    const ap = kp.allowed_products;
    if (!ap) return;
    const key = ap.id;
    const kinguinStock = kp.kinguin_stock || 0;

    if (grouped[key]) {
      // Already represented (possibly by a seller product using Kinguin stock) — don't double-count
      if (!grouped[key].isKinguin) {
        grouped[key].sellerCount += 1;
        grouped[key].stock += kinguinStock;
        grouped[key].isKinguin = true;
        const dynamicPrice = kp.sell_price;
        if (dynamicPrice < grouped[key].price) {
          grouped[key].price = dynamicPrice;
          grouped[key].id = ap.id;
        }
      }
    } else {
      // New entry from Kinguin only (no seller added it)
      grouped[key] = {
        id: ap.id,
        title: ap.title,
        platform: ap.platform,
        slug: ap.slug,
        price: kp.sell_price,
        image: ap.image_url || game1,
        sellerCount: 1,
        stock: kinguinStock,
        isKinguin: true,
        badges: ap.badges || [],
        soldCount: ap.sold_count || 0,
        wishlistCount: ap.wishlist_count || 0,
        store: ap.store,
        tab_category: ap.tab_category || null,
        productType: ap.product_type || null,
        releaseDate: (ap as any).release_date || null,
        originalTitle: ap.original_title || null,
      };
    }
  });

  // Add physical products from product_variations (not backed by Kinguin or sellers)
  if (isPhysicalStore) {
    allowedProducts.forEach((ap: any) => {
      const key = ap.id;
      if (grouped[key]) return; // already added
      const varInfo = variationStockMap[key];
      if (!varInfo || varInfo.stock <= 0) return;
      grouped[key] = {
        id: ap.id,
        title: ap.title,
        platform: ap.platform,
        slug: ap.slug,
        price: varInfo.minPrice,
        image: ap.image_url || game1,
        sellerCount: 1,
        stock: varInfo.stock,
        isKinguin: false,
        badges: ap.badges || [],
        soldCount: ap.sold_count || 0,
        wishlistCount: ap.wishlist_count || 0,
        store: ap.store,
        tab_category: ap.tab_category || null,
        productType: ap.product_type || null,
        releaseDate: (ap as any).release_date || null,
        originalTitle: ap.original_title || null,
      };
    });
  }

  let items = Object.values(grouped) as {
    id: string;
    title: string;
    platform: string;
    slug?: string;
    price: number;
    originalPrice?: number;
    image: string;
    sellerCount: number;
    stock: number;
    isKinguin: boolean;
    badges?: string[];
    region?: string;
    createdAt?: string;
    soldCount?: number;
    wishlistCount?: number;
    productType?: string | null;
    originalTitle?: string | null;
  }[];

  // Attach region and createdAt from allowed product
  items = items.map((item) => {
    const socialProof = resolveSocialProof(item, socialProofIndex);
    const wishlistFromMatches = socialProof.matches.reduce(
      (max, match) => Math.max(max, wishlistCounts[match.title || ""] || 0),
      0
    );

    return {
      ...item,
      badges: item.badges?.length ? item.badges : socialProof.bestMatch?.badges || [],
      region: socialProof.region || "Global",
      createdAt: socialProof.createdAt || "",
      soldCount: Math.max(item.soldCount || 0, socialProof.soldCount),
      wishlistCount: Math.max(item.wishlistCount || 0, socialProof.wishlistCount, wishlistFromMatches),
    };
  });




  // Auto-group keyword filter
  const itemsBeforeGroupFilter = [...items];
  if (autoGroupFilter) {
    const kw = autoGroupFilter.toUpperCase();
    items = items.filter((item) => item.title.toUpperCase().includes(kw));
  } else if (groupedKeywords.length > 0) {
    // Items already represented by a tile above shouldn't also show as
    // individual cards in the flat list below — only the leftover,
    // truly-ungrouped items should. Drilling into a tile (autoGroupFilter set)
    // overrides this and shows that group's items instead.
    const upperKeywords = groupedKeywords.map((k) => k.toUpperCase());
    items = items.filter((item) => {
      const upperTitle = item.title.toUpperCase();
      return !upperKeywords.some((kw) => upperTitle.includes(kw));
    });
  }

  // Search filter
  if (searchQuery.trim()) {
    const words = searchQuery.trim().toLowerCase().split(/\s+/);
    items = items.filter((item) => words.every((w) => item.title.toLowerCase().includes(w)));
  }

  // Region filter - only show products matching the exact selected region
  if (regionFilter) {
    items = items.filter((item) => item.region === regionFilter);
  }

  // Additional filters (price/type/platform)
  items = applyAdditionalFilters(items, additionalFilters);

  // Sort
  if (sortBy === "price-asc") items.sort((a, b) => Number(a.price) - Number(b.price));
  else if (sortBy === "price-desc") items.sort((a, b) => Number(b.price) - Number(a.price));
  else if (sortBy === "newest") items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  else if (sortBy === "oldest") items.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  // "popular" = default order. When the active tab uses the nav-menu filter,
  // sort by match priority first (title > badges > description), then by seller count.
  else if (useNavMenuFilter) {
    items.sort((a, b) => {
      const sa = navMenuScoreByApId[a.id] || 0;
      const sb = navMenuScoreByApId[b.id] || 0;
      if (sb !== sa) return sb - sa;
      return b.sellerCount - a.sellerCount;
    });
  } else items.sort((a, b) => b.sellerCount - a.sellerCount);

  // Collapse Game Group variants — keep only the first occurrence per group and
  // turn it into a tile that links to /game/<slug>.
  if (gameGroupMap && gameGroupMap.size > 0) {
    const seenGroups = new Set<string>();
    items = items.filter((it: any) => {
      const info = gameGroupMap.get(it.id);
      if (!info) return true;
      if (seenGroups.has(info.group_id)) return false;
      seenGroups.add(info.group_id);
      it.title = info.title;
      it.image = info.image_url || it.image;
      it.slug = `__game__/${info.slug}`;
      return true;
    });
  }

  // Available regions for filter
  const availableRegions = [...new Set(items.map((item) => item.region || "Global"))].sort();
  const regionCounts = items.reduce((acc, item) => {
    const r = item.region || "Global";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const paginatedItems = items.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleAddToCart = (item: typeof items[0], e: React.MouseEvent) => {
    e.stopPropagation();
    triggerFly(e);
    addItem({
      offerId: item.id,
      title: item.title,
      platform: item.platform,
      price: item.price,
      sellerName: item.isKinguin ? "Official Store" : "Seller",
      image_url: item.image,
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(paginatedItems.map((i) => i.id)));
  };

  const moveSelectedToTab = async (tab: "games" | "topups" | "subscriptions" | "dlc") => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const tabLabels: Record<string, string> = {
      games: "Games",
      topups: "Top Ups",
      subscriptions: "Subscriptions",
      dlc: "DLC",
    };
    const { error } = await supabase
      .from("allowed_products")
      .update({ tab_category: tab } as any)
      .in("id", ids);
    if (error) {
      toast({ title: "Move failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Moved ${ids.length} product${ids.length === 1 ? "" : "s"} to ${tabLabels[tab]}` });
    setSelectedIds(new Set());
    setSelectMode(false);
    fetchStoreData();
  };

  const getEditProducts = () => {
    return Array.from(selectedIds).map((id) => {
      const ap = allowedProducts.find((a: any) => a.id === id);
      const kp = kinguinProducts.find((k: any) => k.allowed_products?.id === id);
      return {
        allowed_product_id: id,
        title: ap?.title || "",
        description: ap?.description,
        platform: ap?.platform || "PC",
        store: ap?.store || "Steam",
        region: ap?.region || "Global",
        image_url: ap?.image_url,
        sell_price: kp?.sell_price,
        badges: ap?.badges || [],
      };
    });
  };

  const navigate = useNavigate();
  const handleAutoGroupTilesStateChange = useCallback((hasTiles: boolean) => {
    setHasAutoGroupTiles(hasTiles);
  }, []);
  const handleGroupedKeywordsChange = useCallback((keywords: string[]) => {
    setGroupedKeywords(keywords);
  }, []);

  const BackButton = () => (
    <button
      onClick={() => navigate(-1)}
      className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors font-display text-sm font-semibold tracking-wider uppercase z-10"
    >
      <ChevronLeft className="h-5 w-5" />
      <span className="hidden sm:inline">Back</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <FlyToCartOverlay items={flyingItems} />

      <section className="pt-48 pb-8">
        <div className="container mx-auto px-4">
          <div className="relative">
            <BackButton />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground mb-2">
                {storeName.toUpperCase()}
              </h1>
              <p className="text-muted-foreground">{description}</p>
            </motion.div>
          </div>
        </div>
      </section>

      {hasCategories && (
        <section className="pb-8">
          <div className="container mx-auto px-4">
            <div className="flex justify-center gap-3">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCategory(cat.id); setCurrentPage(1); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-display text-sm font-semibold tracking-wider uppercase transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "glass text-muted-foreground hover:text-primary border border-border/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="pb-16">
        <div className="container mx-auto px-4">
          {!hideCollectionTiles && <CollectionTiles categoryFilter={storeName} />}
          {autoGroupPage && (
            <AutoGroupTiles
              targetPage={autoGroupPage}
              items={itemsBeforeGroupFilter}
              onFilterChange={(kw) => { setAutoGroupFilter(kw); setCurrentPage(1); }}
              activeGroup={autoGroupFilter}
              onTilesStateChange={handleAutoGroupTilesStateChange}
              onGroupedKeywordsChange={handleGroupedKeywordsChange}
            />
          )}
          {isAdmin && !selectMode && (tilesOnly || (autoGroupPage && !showProductsWithAutoGroups && !autoGroupFilter && hasAutoGroupTiles !== false)) && (
            <div className="flex items-center gap-2 mb-4 justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSelectMode(true); setSelectedIds(new Set()); }}
                className="font-display text-xs"
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Select
              </Button>
            </div>
          )}
          {(!tilesOnly || (isAdmin && selectMode)) && (!autoGroupPage || showProductsWithAutoGroups || autoGroupFilter || hasAutoGroupTiles === false || (isAdmin && selectMode)) && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <ProductFilters
                  sort={sortBy}
                  onSortChange={(s) => { setSortBy(s); setCurrentPage(1); }}
                  region={regionFilter}
                  onRegionChange={(r) => { setRegionFilter(r); setCurrentPage(1); }}
                  availableRegions={availableRegions}
                  regionCounts={regionCounts}
                  searchQuery={searchQuery}
                  onSearchChange={(q) => { setSearchQuery(q); setCurrentPage(1); }}
                  products={itemsBeforeGroupFilter}
                  additionalFilters={additionalFilters}
                  onAdditionalFiltersChange={(f) => { setAdditionalFilters(f); setCurrentPage(1); }}
                />
                {isAdmin && (
                  <div className="flex items-center gap-2 mr-auto order-first">
                    <Button
                      variant={selectMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                      className="font-display text-xs"
                    >
                      <CheckSquare className="h-4 w-4 mr-1" />
                      {selectMode ? "Cancel" : "Select"}
                    </Button>
                    {selectMode && (
                      <>
                        <Button variant="outline" size="sm" onClick={selectAll} className="font-display text-xs">
                          Select All
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={selectedIds.size === 0}
                              className="font-display text-xs"
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-1" />
                              Move to ({selectedIds.size})
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background z-50">
                            <DropdownMenuItem onClick={() => moveSelectedToTab("games")}>
                              <Gamepad2 className="h-4 w-4 mr-2" /> Games
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => moveSelectedToTab("topups")}>
                              <Coins className="h-4 w-4 mr-2" /> Top Ups
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => moveSelectedToTab("subscriptions")}>
                              <Ticket className="h-4 w-4 mr-2" /> Subscriptions
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => moveSelectedToTab("dlc")}>
                              <Package className="h-4 w-4 mr-2" /> DLC
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          size="sm"
                          disabled={selectedIds.size === 0}
                          onClick={() => setEditModalOpen(true)}
                          className="font-display text-xs"
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit ({selectedIds.size})
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {loading ? (
                <GameCardSkeletonGrid count={12} />
              ) : items.length === 0 ? (
                <div className="text-center py-20 glass rounded-xl">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground font-display">No products available yet.</p>
                </div>
              ) : (
                <>
                  <motion.div
                    key={`${activeCategory}-${currentPage}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4"
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
                        badges={item.badges}
                        region={item.region}
                        soldCount={item.soldCount}
                        wishlistCount={item.wishlistCount}
                        selectable={selectMode}
                        selected={selectedIds.has(item.id)}
                        onSelect={toggleSelect}
                        onAddToCart={(e) => handleAddToCart(item, e)}
                        productType={item.productType}
                        releaseDate={(item as any).releaseDate}
                        originalTitle={item.originalTitle}
                      />
                    ))}
                  </motion.div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1 mt-8">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                        className="w-10 h-10 flex items-center justify-center border border-muted-foreground/40 rounded text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      {(() => {
                        const pages: (number | "ellipsis")[] = [];
                        if (totalPages <= 5) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          pages.push(1);
                          if (currentPage > 3) pages.push("ellipsis");
                          const start = Math.max(2, currentPage - 1);
                          const end = Math.min(totalPages - 1, currentPage + 1);
                          for (let i = start; i <= end; i++) pages.push(i);
                          if (currentPage < totalPages - 2) pages.push("ellipsis");
                          pages.push(totalPages);
                        }
                        return pages.map((p, idx) =>
                          p === "ellipsis" ? (
                            <span key={`e-${idx}`} className="w-10 h-10 flex items-center justify-center text-muted-foreground font-display text-lg">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setCurrentPage(p)}
                              className={`w-10 h-10 flex items-center justify-center rounded font-display text-sm font-bold transition-colors ${
                                p === currentPage
                                  ? "text-primary"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {p}
                            </button>
                          )
                        );
                      })()}
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className="w-10 h-10 flex items-center justify-center border border-muted-foreground/40 rounded text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>

      <section className="pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-left glass rounded-xl p-5 border border-border/40">
            <h2 className="font-display text-lg font-bold text-foreground mb-3">
              About {storeName} keys at Agever's
            </h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              This page lists digital <strong>{storeName}</strong> game codes available for
              instant delivery. All prices are shown in EUR with live conversion to USD, GBP,
              ILS and other supported currencies. Stock and region compatibility are displayed
              on each product card.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground list-disc pl-5">
              <li>Instant digital delivery</li>
              <li>Verified authorised stock</li>
              <li>14-day refund on unused keys</li>
              <li>PayPal &amp; major cards accepted</li>
            </ul>
          </div>
        </div>
      </section>

      <Footer />

      {isAdmin && (
        <AdminProductEditModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          products={getEditProducts()}
          forceBulk
          onSaved={() => {
            setSelectedIds(new Set());
            setSelectMode(false);
            fetchStoreData();
          }}
        />
      )}
    </div>
  );
};

export default StorePage;
