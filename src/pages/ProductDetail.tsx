import { useState, useEffect, useCallback, useRef } from "react";
import { addRecentlyViewed } from "@/lib/recentlyViewed";
import { standardizeImageUrl } from "@/lib/imageTransform";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isUUID } from "@/lib/productSlug";
import { useCart } from "@/hooks/useCart";
import { useNewAccountLimit } from "@/hooks/useNewAccountLimit";
import { useCurrency } from "@/hooks/useCurrency";
import Navbar from "@/components/Navbar";
import { useFlyToCart, FlyToCartOverlay } from "@/components/FlyToCart";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, AlertTriangle, Pencil, Wand2, Save, Bell, Info, Upload, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ShoppingCart, Heart, ArrowLeft, Tag, CheckCircle, Download, ChevronLeft, ChevronRight, X, Truck, Package } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import RegionCompatibility from "@/components/RegionCompatibility";
import RegionWarningDialog from "@/components/RegionWarningDialog";
import ProductReviews, { ProductRatingSummary, useProductRatingStats } from "@/components/ProductReviews";
import FrequentlyBoughtTogether from "@/components/FrequentlyBoughtTogether";
import { detectUserCountry, isRegionCompatible } from "@/lib/regionCheck";
import { motion } from "framer-motion";
import { usePlatformCategories } from "@/hooks/usePlatformCategories";
import { ALL_REGIONS } from "@/lib/regions";
import AgeversLoader from "@/components/AgeversLoader";
import { getProductTypeLabel, isAddonRequiringBaseGame, extractBaseGameName, getDisplayProductTitle, filterGenreBadges, isNoTypeProduct } from "@/lib/gameItemClassifier";

interface SellerOffer {
  id: string;
  price: number;
  original_price: number | null;
  game_code?: string | null;
  status: string;
  seller_id: string;
  sellerName: string;
  sellerAvatar: string | null;
  salesCount: number;
  kinguinBacked?: boolean;
  kinguinStock?: number;
  kinguinAllowedProductId?: string;
  kinguinSellPrice?: number;
  stockCount?: number;
}

interface KinguinOffer {
  id: string;
  allowed_product_id: string;
  kinguin_product_id: string;
  sell_price: number;
  kinguin_stock: number | null;
  manual_stock?: number;
  total_stock?: number;
  is_active: boolean;
}

interface ProductInfo {
  title: string;
  original_title?: string | null;
  platform: string;
  store: string;
  image_url: string | null;
  category: string;
  allowed_product_id?: string;
  description?: string | null;
  region?: string;
  expiration_date?: string | null;
  developers?: string[];
  publishers?: string[];
  regional_limitations?: string | null;
  platform_details?: string | null;
  languages?: string[];
  release_date?: string | null;
  screenshots?: string[];
  video_url?: string | null;
  sold_count?: number;
  wishlist_count?: number;
  aliexpress_product_id?: string | null;
  system_requirements?: any;
  badges?: string[];
  product_type?: string | null;
}

const ProductDetail = () => {
  const { categories: PLATFORM_CATEGORIES, getSubPlatforms } = usePlatformCategories();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, canAddItem } = useCart();
  const { limitEur } = useNewAccountLimit();
  const [lockedTipOpen, setLockedTipOpen] = useState(false);
  const lockedTipTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const { formatPrice } = useCurrency();
  const { flyingItems, triggerFly } = useFlyToCart();
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null);
  const [offers, setOffers] = useState<SellerOffer[]>([]);
  const [kinguinOffer, setKinguinOffer] = useState<KinguinOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [soldCount, setSoldCount] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isHoveringCover, setIsHoveringCover] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [paraphrasing, setParaphrasing] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [editStore, setEditStore] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editBadges, setEditBadges] = useState<string[]>([]);
  const [editProductType, setEditProductType] = useState<string>("Game");
  const [newBadge, setNewBadge] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showRegionWarning, setShowRegionWarning] = useState(false);
  const pendingRegionActionRef = useRef<(() => void) | null>(null);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const [notifySubmitted, setNotifySubmitted] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingCountry, setShippingCountry] = useState("");
  const [variations, setVariations] = useState<any[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [variationImageOverrides, setVariationImageOverrides] = useState<Record<string, string>>({});
  const [baseGameMatch, setBaseGameMatch] = useState<{ id: string; slug: string; title: string; image_url: string | null } | null>(null);

  const userCountry = detectUserCountry();
  const productRegion = productInfo?.region || "Global";
  const regionMismatch = userCountry && !isRegionCompatible(productRegion, userCountry);

  const ratingStats = useProductRatingStats(productInfo?.allowed_product_id);

  const COMMON_BADGES = ["DLC", "Deluxe", "Ultimate", "Gold", "Premium", "Collector", "Limited", "Legacy", "Complete", "GOTY", "Legendary", "Champion", "Digital Deluxe", "Super Deluxe", "Enhanced", "Pre-Order", "Bundle", "Season Pass", "Expansion", "Remastered", "Definitive"];

  const cleanedDescription = productInfo?.description
    ?.replace(/^\s*AliExpress Product ID:\s*[^\n\r]+\s*$/gim, "")
    .trim() || "";

  // Fetch variations for AliExpress products
  useEffect(() => {
    if (!productInfo?.aliexpress_product_id || !productInfo?.allowed_product_id) return;
    (supabase.rpc as any)("get_public_product_variations", {
      _allowed_product_id: productInfo.allowed_product_id,
    }).then(({ data }: any) => {
        if (data && data.length > 0) {
          setVariations(data);
          setSelectedVariation(data[0].id);
        }
      });
  }, [productInfo?.aliexpress_product_id, productInfo?.allowed_product_id]);

  useEffect(() => {
    if (!productInfo?.aliexpress_product_id || !productInfo?.allowed_product_id) return;
    if (Object.keys(variationImageOverrides).length > 0) return; // already fetched

    supabase.functions.invoke("aliexpress-api", {
      body: {
        action: "public_variations",
        allowed_product_id: productInfo.allowed_product_id,
        ship_to_country: shippingCountry || "US",
      },
    }).then(({ data }) => {
      const nextOverrides = Object.fromEntries(
        (data?.variations || [])
          .filter((variation: any) => variation?.sku_id && variation?.image_url)
          .map((variation: any) => [String(variation.sku_id), String(variation.image_url)])
      );

      if (Object.keys(nextOverrides).length > 0) {
        setVariationImageOverrides(nextOverrides);
      }
    }).catch(() => undefined);
  }, [productInfo?.aliexpress_product_id, productInfo?.allowed_product_id, shippingCountry, variations]);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    // user_roles has no direct SELECT grant (by design), so this goes
    // through check_my_role() instead of a table query.
    supabase.rpc("check_my_role" as any, { _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  useEffect(() => {
    if (!id) return;
    fetchProductData();
  }, [id]);

  // Lookup the base game in our catalog when the current product is an add-on
  // (DLC, Skin, Currency, Season Pass, Expansion, Pre-Order Bonus).
  useEffect(() => {
    if (!productInfo) { setBaseGameMatch(null); return; }
    const isAddon = isAddonRequiringBaseGame({
      title: productInfo.title,
      originalTitle: productInfo.original_title,
      description: productInfo.description,
      category: productInfo.category,
      store: productInfo.store,
      productType: productInfo.product_type,
    });
    if (!isAddon) { setBaseGameMatch(null); return; }
    const baseName = extractBaseGameName(productInfo.title).trim();
    if (!baseName || baseName.length < 3) { setBaseGameMatch(null); return; }

    let cancelled = false;
    (async () => {
      // Search products whose title starts with the base game name.
      // Prefer same platform + region, exclude add-ons (look for products
      // that don't have DLC / Pack / Bundle classification keywords).
      const { data } = await supabase
        .from("allowed_products")
        .select("id, slug, title, image_url, platform, region, product_type")
        .ilike("title", `${baseName}%`)
        .neq("id", productInfo.allowed_product_id || "")
        .limit(50);
      if (cancelled || !data) return;

      // Filter out add-on / bundle / pack entries — we want the actual base game.
      // Use the central classifier (same logic as the badge / type label) so we
      // never recommend a DLC, Skin, Currency, Pack, Bundle, Season Pass, etc.
      const baseCandidates = data.filter((p: any) => {
        const t = (p.title || "").toLowerCase();
        const pt = (p.product_type || "").toLowerCase();
        if (pt === "dlc" || pt === "skin" || pt === "currency" || pt === "season pass" || pt === "expansion" || pt === "pre order bonus" || pt === "bundle") return false;
        // Reject any title that classifies as a non-base product (DLC, Skin,
        // Currency, Bundle, Season Pass, Expansion, Pre-Order Bonus). This
        // catches packs / sets / kits that the keyword regex misses.
        const label = getProductTypeLabel({
          title: p.title || "",
          originalTitle: p.title || "",
          description: "",
          category: null,
          store: null,
          productType: p.product_type || null,
        });
        if (!label || (label !== "Game" && !label.startsWith("GAME -"))) return false;
        // Extra safety net: reject titles that mention add-on / pack / set / kit
        // / cosmetic / boost keywords ANYWHERE after the base name.
        if (/\b(dlc|season\s+pass|expansion|add[\s-]?on|content\s+pack|character\s+pack|skin|outfit|cosmetic|bundle|pre[\s-]?order\s+bonus|kit|stuff\s+pack|full\s+set|set\s+pack|booster\s+pack|xp\s+boost|premium\s+pack|starter\s+pack|loot\s+pack|weapon\s+pack|operator\s+pack|hours?\s+\w*\s*boost)\b/i.test(t)) return false;
        // Reject titles that look like brand collaborations / cosmetic packs
        // ("Monster Energy", "Mountain Dew", "Doritos", etc.) — these are
        // never the base game.
        if (/\b(monster\s+energy|mountain\s+dew|doritos|burger\s+king|red\s+bull)\b/i.test(t)) return false;
        return true;
      });
      if (baseCandidates.length === 0) { setBaseGameMatch(null); return; }

      // Determine the REAL platform of the current add-on. For In-Game Items
      // products, the actual platform lives in platform_details (Xbox / PC /
      // PlayStation / Nintendo). Fall back to inferring from the title.
      const rawPlatform = (productInfo.platform || "").toLowerCase();
      const isInGameItems = rawPlatform === "in-game items" || (productInfo.store || "").toLowerCase() === "in-game items";
      const normalizePlatform = (val: string): string => {
        const v = (val || "").toLowerCase();
        if (v.includes("xbox")) return "xbox";
        if (v.includes("playstation") || /\bps[345]\b/.test(v) || v.includes("psn")) return "playstation";
        if (v.includes("nintendo") || v.includes("switch")) return "nintendo";
        if (v.includes("steam") || v.includes("epic") || v.includes("gog") || v.includes("battle.net") ||
            v.includes("ea app") || v.includes("origin") || v.includes("ubisoft") || v.includes("uplay") ||
            v.includes("ms store") || v.includes("microsoft store") || v.includes("rockstar") ||
            v.includes("bethesda") || v.includes("riot") || v.includes("roblox") || v === "pc") return "pc";
        return v;
      };
      let targetPlatform = normalizePlatform(rawPlatform);
      if (isInGameItems) {
        const pd = (productInfo.platform_details || "").toLowerCase();
        const fromDetails = pd && pd !== "other" ? normalizePlatform(pd) : "";
        const fromTitle = normalizePlatform(productInfo.title || "");
        targetPlatform = fromDetails || fromTitle || targetPlatform;
      }
      const userRegion = (userCountry || "").toLowerCase();
      baseCandidates.sort((a: any, b: any) => {
        const score = (p: any) => {
          const pPlatformNorm = normalizePlatform(p.platform || "");
          const pRegion = (p.region || "").toLowerCase();
          let s = 0;
          if (targetPlatform && pPlatformNorm === targetPlatform) s += 10;
          else if (targetPlatform && pPlatformNorm && pPlatformNorm !== targetPlatform) s -= 20;
          if (userRegion && isRegionCompatible(p.region || "Global", userCountry as string)) s += 3;
          if (pRegion === "global") s += 1;
          return s;
        };
        return score(b) - score(a);
      });
      // Only suggest a base game if we found one on a matching platform.
      // Otherwise the suggestion is misleading (e.g. recommending a Nintendo
      // base game for an Xbox DLC).
      const top = baseCandidates[0];
      const topPlatformNorm = normalizePlatform(top.platform || "");
      if (targetPlatform && topPlatformNorm && topPlatformNorm !== targetPlatform) {
        setBaseGameMatch(null);
        return;
      }
      setBaseGameMatch(top);
    })();

    return () => { cancelled = true; };
  }, [productInfo, userCountry]);

  useEffect(() => {
    if (!productInfo) return;
    setWishlistCount(productInfo.wishlist_count || 0);

    if (!user) {
      setIsInWishlist(false);
      return;
    }

    supabase
      .from("wishlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("game_title", productInfo.title)
      .maybeSingle()
      .then(({ data }) => setIsInWishlist(!!data));
  }, [user, productInfo]);

  // Fetch shipping options for AliExpress (physical) products
  const SHIPPING_COUNTRIES: { label: string; code: string }[] = [
    { label: "United States", code: "US" }, { label: "United Kingdom", code: "GB" }, { label: "Germany", code: "DE" },
    { label: "France", code: "FR" }, { label: "Italy", code: "IT" }, { label: "Spain", code: "ES" },
    { label: "Netherlands", code: "NL" }, { label: "Belgium", code: "BE" }, { label: "Austria", code: "AT" },
    { label: "Switzerland", code: "CH" }, { label: "Poland", code: "PL" }, { label: "Sweden", code: "SE" },
    { label: "Norway", code: "NO" }, { label: "Denmark", code: "DK" }, { label: "Finland", code: "FI" },
    { label: "Czech Republic", code: "CZ" }, { label: "Portugal", code: "PT" }, { label: "Romania", code: "RO" },
    { label: "Hungary", code: "HU" }, { label: "Greece", code: "GR" }, { label: "Ireland", code: "IE" },
    { label: "Bulgaria", code: "BG" }, { label: "Croatia", code: "HR" }, { label: "Slovakia", code: "SK" },
    { label: "Slovenia", code: "SI" }, { label: "Lithuania", code: "LT" }, { label: "Latvia", code: "LV" },
    { label: "Estonia", code: "EE" }, { label: "Luxembourg", code: "LU" }, { label: "Malta", code: "MT" },
    { label: "Cyprus", code: "CY" }, { label: "Iceland", code: "IS" }, { label: "Turkey", code: "TR" },
    { label: "Russia", code: "RU" }, { label: "Ukraine", code: "UA" }, { label: "Canada", code: "CA" },
    { label: "Mexico", code: "MX" }, { label: "Brazil", code: "BR" }, { label: "Argentina", code: "AR" },
    { label: "Australia", code: "AU" }, { label: "New Zealand", code: "NZ" }, { label: "Japan", code: "JP" },
    { label: "South Korea", code: "KR" }, { label: "China", code: "CN" }, { label: "India", code: "IN" },
    { label: "Singapore", code: "SG" }, { label: "Malaysia", code: "MY" }, { label: "Thailand", code: "TH" },
    { label: "Indonesia", code: "ID" }, { label: "Philippines", code: "PH" }, { label: "Vietnam", code: "VN" },
    { label: "Saudi Arabia", code: "SA" }, { label: "United Arab Emirates", code: "AE" }, { label: "Egypt", code: "EG" },
    { label: "South Africa", code: "ZA" }, { label: "Nigeria", code: "NG" }, { label: "Colombia", code: "CO" },
    { label: "Chile", code: "CL" }, { label: "Peru", code: "PE" }, { label: "Israel", code: "IL" },
    { label: "Qatar", code: "QA" }, { label: "Kuwait", code: "KW" }, { label: "Bahrain", code: "BH" },
    { label: "Oman", code: "OM" }, { label: "Morocco", code: "MA" }, { label: "Tunisia", code: "TN" },
    { label: "Pakistan", code: "PK" }, { label: "Bangladesh", code: "BD" }, { label: "Sri Lanka", code: "LK" },
  ].sort((a, b) => a.label.localeCompare(b.label));

  const COUNTRY_NAME_TO_ISO: Record<string, string> = Object.fromEntries(SHIPPING_COUNTRIES.map(c => [c.label, c.code]));

  // Set default shipping country from detected location
  useEffect(() => {
    if (shippingCountry) return;
    const detected = detectUserCountry();
    const code = (detected && COUNTRY_NAME_TO_ISO[detected]) || "US";
    setShippingCountry(code);
  }, []);

  // Fetch shipping when country or product changes
  useEffect(() => {
    if (!productInfo?.aliexpress_product_id || !productInfo?.allowed_product_id || !shippingCountry) return;
    setShippingLoading(true);
    setShippingOptions([]);
    supabase.functions.invoke("aliexpress-api", {
      body: {
        action: "public_shipping",
        allowed_product_id: productInfo.allowed_product_id,
        country_code: shippingCountry,
        quantity: "1",
      },
    }).then(({ data }) => {
      setShippingOptions(data?.shipping_options || []);
      setShippingLoading(false);
    }).catch(() => setShippingLoading(false));
  }, [productInfo?.aliexpress_product_id, productInfo?.allowed_product_id, shippingCountry]);

  const getDynamicKinguinPrice = (kp: any) => {
    return kp?.sell_price || 0;
  };

  const buildProductInfo = (ap: any, fallback?: any): ProductInfo => ({
    title: ap?.title || fallback?.title || "",
    platform: ap?.platform || fallback?.platform || "",
    store: ap?.store || fallback?.store || "",
    image_url: ap?.image_url || fallback?.image_url || null,
    category: fallback?.category || "games",
    allowed_product_id: ap?.id,
    description: ap?.description || null,
    region: ap?.region || "Global",
    expiration_date: ap?.expiration_date || null,
    developers: ap?.developers || [],
    publishers: ap?.publishers || [],
    regional_limitations: ap?.regional_limitations || null,
    platform_details: ap?.platform_details || null,
    languages: ap?.languages || [],
    release_date: ap?.release_date || null,
    screenshots: ap?.screenshots || [],
    video_url: ap?.video_url || null,
    sold_count: ap?.sold_count || 0,
    wishlist_count: ap?.wishlist_count || 0,
    aliexpress_product_id: ap?.aliexpress_product_id || null,
    system_requirements: ap?.system_requirements || null,
    badges: ap?.badges || [],
    product_type: (ap as { product_type?: string | null })?.product_type || null,
  });

  const findAllowedProductBySlug = async (slug: string) => {
    // Direct DB lookup by slug column
    const { data, error } = await supabase
      .from("allowed_products")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const fetchProductData = async () => {
    let singleProduct: any = null;
    let ap: any = null;

    if (isUUID(id!)) {
      // UUID lookup – try both in parallel
      const [{ data: sp }, { data: apData }] = await Promise.all([
        supabase.from("products_public").select("*").eq("id", id).maybeSingle(),
        supabase.from("allowed_products").select("*").eq("id", id).maybeSingle(),
      ]);
      singleProduct = sp;
      ap = apData;

      // If we found a product, redirect from UUID URL to SEO slug URL
      const foundProduct = ap || singleProduct;
      if (foundProduct) {
        const productSlug = ap?.slug || foundProduct.slug;
        if (productSlug) {
          navigate(`/product/${productSlug}`, { replace: true });
        }
        return;
      }
    } else {
      ap = await findAllowedProductBySlug(id!);
    }

    let info: ProductInfo;

    if (singleProduct && !ap) {
      const { data: matchedAp } = await supabase
        .from("allowed_products")
        .select("*")
        .eq("platform", singleProduct.platform)
        .eq("store", singleProduct.store)
        .ilike("title", singleProduct.title)
        .maybeSingle();
      ap = matchedAp;
    }

    if (singleProduct) {
      info = buildProductInfo(ap, singleProduct);
      setProductInfo(info);
      const isAliExpress = !!ap?.aliexpress_product_id;
      const [, kinguinData] = await Promise.all([
        Promise.resolve(),
        isAliExpress ? Promise.resolve(null) : fetchKinguinOffer(ap?.id),
      ]);
      await fetchOffers(info, ap, kinguinData);
    } else if (ap) {
      info = buildProductInfo(ap);
      setProductInfo(info);
      const isAliExpress = !!ap.aliexpress_product_id;
      const kinguinData = isAliExpress ? null : await fetchKinguinOffer(ap.id);
      await fetchOffers(info, ap, kinguinData);
    } else {
      toast({ title: "Product not found", variant: "destructive" });
      navigate(-1);
      return;
    }
    setLoading(false);
  };

  const getManualKeyCount = async (allowedProductId: string) => {
    // Targeted count for a single product instead of fetching all products' counts
    const { count, error } = await supabase
      .from("product_keys")
      .select("*", { count: "exact", head: true })
      .eq("allowed_product_id", allowedProductId)
      .is("product_id", null)
      .eq("status", "active");
    if (error) {
      console.error("Failed to fetch manual key count:", error);
      return 0;
    }
    return Number(count || 0);
  };

  const fetchKinguinOffer = async (allowedProductId?: string) => {
    if (!allowedProductId) return null;
    const [{ data: kinguinData }, manualStock] = await Promise.all([
      supabase
        .rpc("get_public_kinguin_single" as any, { _allowed_product_id: allowedProductId })
        .then(({ data }: any) => ({ data: data?.[0] || null })),
      getManualKeyCount(allowedProductId),
    ]);

    if (kinguinData) {
      const kinguinStock = kinguinData.kinguin_stock || 0;
      const offer = {
        ...(kinguinData as any),
        manual_stock: manualStock,
        total_stock: manualStock + kinguinStock,
      };
      setKinguinOffer(offer);
      return offer;
    } else if (manualStock > 0) {
      // No Kinguin link but manual keys exist — synthesize a kinguin-like offer
      // so totalAvailableStock and the UI reflect the manual stock.
      const offer = {
        id: allowedProductId,
        allowed_product_id: allowedProductId,
        sell_price: 0,
        kinguin_stock: 0,
        is_active: true,
        manual_stock: manualStock,
        total_stock: manualStock,
      } as any;
      setKinguinOffer(offer);
      return offer;
    }
    return null;
  };

  const addToCartAndCheckout = async ({ offerId, price, sellerName, maxStock }: { offerId: string; price: number; sellerName: string; maxStock?: number }) => {
    if (!productInfo) return;

    if (!user) {
      // Add to cart before redirecting so the item is there after login
      const cartItem = {
        offerId: offerId,
        title: productInfo.title,
        platform: productInfo.platform,
        price: price,
        sellerName: sellerName,
        image_url: productInfo.image_url,
        maxStock: maxStock
      };
      
      addItem(cartItem);
      
      // Redirect to checkout so they land where they can pay
      const redirectPath = encodeURIComponent("/checkout");
      navigate(`/auth?redirect=${redirectPath}&reason=checkout_required`);
      return;
    }

    // Enforce new account limit (€20 for first 24h)
    if (price > 20) {
      const createdTime = new Date(user.created_at).getTime();
      const isWithin24h = (Date.now() - createdTime) < 24 * 60 * 60 * 1000;
      
      if (isWithin24h) {
        const { data: score } = await supabase
          .from("fraud_scores")
          .select("new_account_limit_exempt")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!score?.new_account_limit_exempt) {
          toast({ 
            title: "Account Security Limit", 
            description: "New accounts are limited to €20 per item for the first 24 hours. Please contact support to unlock higher limits.",
            variant: "destructive"
          });
          return;
        }
      }
    }

    const added = addItem({
      offerId,
      title: productInfo.title,
      platform: productInfo.platform,
      price,
      sellerName,
      image_url: productInfo.image_url || null,
      maxStock,
    });

    if (!added) return;

    navigate("/checkout");
  };




  const fetchOffers = async (info: ProductInfo, prefetchedAp?: any, prefetchedKinguin?: any) => {
    // Reuse the already-fetched allowed_products row when available
    let ap: any = prefetchedAp || null;
    if (!ap && info.allowed_product_id) {
      const { data } = await supabase.from("allowed_products").select("*").eq("id", info.allowed_product_id).maybeSingle();
      ap = data;
    }
    if (!ap) {
      const { data } = await supabase
        .from("allowed_products")
        .select("*")
        .eq("platform", info.platform)
        .eq("store", info.store)
        .ilike("title", info.title)
        .maybeSingle();
      ap = data;
    }

    // Fetch all active products for this platform+store
    const productsRes = await supabase
      .from("products_public" as any)
      .select("*")
      .eq("platform", info.platform)
      .eq("store", info.store)
      .eq("status", "active")
      .order("price", { ascending: true });
    const products = (productsRes.data || []) as any[];

    // Reuse pre-fetched kinguin link instead of refetching
    const isAliExpress = !!ap?.aliexpress_product_id;
    let kinguinLink: any = prefetchedKinguin || null;
    if (!kinguinLink && ap && !isAliExpress) {
      const { data: kl } = await supabase
        .rpc("get_public_kinguin_single" as any, { _allowed_product_id: ap.id })
        .then(({ data }: any) => ({ data: data?.[0] || null }));
      kinguinLink = kl;
    }

    // Filter products that match this allowed product by title
    const matchingProducts = (products || []).filter((p) => {
      const titleMatches = ap
        ? (
            p.title.toLowerCase() === ap.title.toLowerCase() ||
            p.title.toLowerCase().includes(ap.title.toLowerCase()) ||
            ap.title.toLowerCase().includes(p.title.toLowerCase())
          )
        : p.title.toLowerCase() === info.title.toLowerCase();
      return titleMatches;
    });


    // Fetch key counts, manual keys, profiles, variation stock, and seller sales in parallel
    const productIds = matchingProducts.map(p => p.id);
    const sellerIds = [...new Set(matchingProducts.map((p) => p.seller_id))];

    // Parallelize: key counts per product, manual key count, profiles, variation stock, seller sales
    const [keyCountResults, manualKeyRes, profilesRes, variationStockRes, ...salesResults] = await Promise.all([
      // Batch key counts: fetch all active keys for these product IDs (skip for AliExpress)
      productIds.length > 0 && !isAliExpress
        ? supabase.from("product_keys").select("product_id").eq("status", "active").in("product_id", productIds)
        : Promise.resolve({ data: [] }),
      // Manual keys count (skip for AliExpress, and reuse already-fetched manual_stock when available)
      ap && !isAliExpress && prefetchedKinguin?.manual_stock === undefined
        ? supabase.from("product_keys").select("*", { count: "exact", head: true }).eq("allowed_product_id", ap.id).is("product_id", null).eq("status", "active")
        : Promise.resolve({ count: prefetchedKinguin?.manual_stock || 0 }),
      // Profiles
      sellerIds.length > 0
        ? supabase.from("profiles").select("user_id, username, display_name, avatar_url, fake_sales_boost").in("user_id", sellerIds)
        : Promise.resolve({ data: [] }),
      // Variation stock (for AliExpress physical products)
      ap?.aliexpress_product_id
        ? (supabase.rpc as any)("get_public_variation_stock", { _allowed_product_ids: [ap.id] })
        : Promise.resolve({ data: [] }),
      // Seller sales counts in parallel
      ...sellerIds.map(sid =>
        supabase.from("seller_sales").select("*", { count: "exact", head: true }).eq("seller_id", sid).eq("status", "completed")
      ),
    ]);

    // Build key counts map from batch result
    const keyCounts: Record<string, number> = {};
    if (keyCountResults.data) {
      for (const row of keyCountResults.data as any[]) {
        keyCounts[row.product_id] = (keyCounts[row.product_id] || 0) + 1;
      }
    }

    const allowedProductKeyCount = (manualKeyRes as any).count || 0;
    const profiles = profilesRes.data || [];
    const variationStock = (variationStockRes.data || []).reduce((sum: number, v: any) => sum + (v.stock || 0), 0);

    const sellerSales: Record<string, number> = {};
    sellerIds.forEach((sid, i) => {
      const realCount = (salesResults[i] as any)?.count || 0;
      const profile = (profiles as any[])?.find((pr) => pr.user_id === sid);
      const boost = profile?.fake_sales_boost || 0;
      sellerSales[sid] = realCount + boost;
    });

    // For AliExpress products, external stock is only variation stock
    const externalStockCount = isAliExpress
      ? variationStock
      : allowedProductKeyCount + (kinguinLink?.kinguin_stock || 0) + variationStock;

    if (matchingProducts.length === 0) {
      // No seller rows matched, but the product can still have manual keys, Kinguin stock, or AliExpress variation stock
      if (ap && externalStockCount > 0) {
        const price = kinguinLink ? getDynamicKinguinPrice(kinguinLink) : (ap.aliexpress_product_id ? 0 : 0);
        setOffers([
          {
            id: ap.id,
            price,
            original_price: null,
            game_code: null,
            status: "active",
            seller_id: "0efdf045-36a2-408e-905e-bcc877742db9",
            sellerName: "Agevers",
            sellerAvatar: null,
            salesCount: 0,
            // Always mark as kinguinBacked for synthetic offers (manual keys / kinguin / aliexpress)
            // so the stock isn't double-counted with kinguinOffer.total_stock in totals.
            kinguinBacked: true,
            kinguinStock: externalStockCount,
            kinguinAllowedProductId: kinguinLink?.allowed_product_id || ap.id,
            kinguinSellPrice: kinguinLink ? getDynamicKinguinPrice(kinguinLink) : undefined,
            stockCount: externalStockCount,
          },
        ]);
      } else {
        setOffers([]);
      }
      return;
    }

    const mapped: SellerOffer[] = matchingProducts
      .filter((p) => {
        const keyCount = keyCounts[p.id] || 0;
        const stockCount = p.stock_count || 0;
        return keyCount > 0 || stockCount > 0 || externalStockCount > 0;
      })
      .map((p) => {
        const profile = profiles?.find((pr) => pr.user_id === p.seller_id);
        const keyCount = keyCounts[p.id] || 0;
        const directStockCount = keyCount > 0 ? keyCount : (p.stock_count || 0);
        const isKinguinBacked = directStockCount === 0 && externalStockCount > 0;
        return {
          id: p.id,
          price: p.price,
          original_price: p.original_price,
          game_code: null,
          status: p.status,
          seller_id: p.seller_id,
          sellerName: profile?.username || profile?.display_name || "Seller",
          sellerAvatar: profile?.avatar_url || null,
          salesCount: sellerSales[p.seller_id] || 0,
          kinguinBacked: isKinguinBacked,
          kinguinStock: isKinguinBacked ? externalStockCount : undefined,
          kinguinAllowedProductId: isKinguinBacked ? kinguinLink.allowed_product_id : undefined,
          kinguinSellPrice: isKinguinBacked ? getDynamicKinguinPrice(kinguinLink) : undefined,
          stockCount: isKinguinBacked ? externalStockCount : directStockCount,
        };
      });

    // If any seller offer is Kinguin-backed, hide the separate Kinguin offer row
    // but keep kinguinOffer state so handleBuyKinguin can use it
    if (mapped.some(o => o.kinguinBacked)) {
      setKinguinOffer(prev => prev ? { ...prev, _hidden: true } as any : null);
    }

    setOffers(mapped);
  };

  const handleBuy = (offer: SellerOffer) => {
    addToCartAndCheckout({
      offerId: offer.id,
      price: offer.price,
      sellerName: offer.kinguinBacked ? "Agevers" : offer.sellerName,
      maxStock: offer.stockCount,
    });
  };

  const handleBuyKinguin = (kinguinData?: { allowed_product_id: string; sell_price: number }) => {
    const offer = kinguinData || (kinguinOffer ? { allowed_product_id: kinguinOffer.allowed_product_id, sell_price: getDynamicKinguinPrice(kinguinOffer) } : null);
    if (!offer) return;

    addToCartAndCheckout({
      offerId: offer.allowed_product_id,
      price: offer.sell_price,
      sellerName: "Agevers",
      maxStock: totalAvailableStock || undefined,
    });
  };

  const handleWishlist = async () => {
    if (!user) {
      toast({ title: "Please log in", variant: "destructive" });
      navigate("/auth");
      return;
    }
    if (!productInfo) return;

    if (isInWishlist) {
      const { error } = await supabase
        .from("wishlist")
        .delete()
        .eq("user_id", user.id)
        .eq("game_title", productInfo.title);
      if (!error) {
        setIsInWishlist(false);
        setWishlistCount(prev => Math.max(0, prev - 1));
        toast({ title: "Removed from wishlist" });
      }
      return;
    }

    const lowestPrice = offers.length > 0 ? offers[0].price : null;

    const { error } = await supabase.from("wishlist").insert({
      user_id: user.id,
      game_title: productInfo.title,
      platform: productInfo.platform,
      price: lowestPrice,
      image_url: productInfo.image_url,
      price_at_add: lowestPrice,
      allowed_product_id: productInfo.allowed_product_id,
    });

    if (error) {
      if (error.code === "23505") {
        setIsInWishlist(true);
        toast({ title: "Already in wishlist" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
      return;
    }
    setIsInWishlist(true);
    setWishlistCount(prev => prev + 1);
    toast({ title: "Added to wishlist!" });
  };

  // Track recently viewed
  useEffect(() => {
    if (!productInfo || !id || loading) return;
    const price = kinguinOffer
      ? getDynamicKinguinPrice(kinguinOffer) || 0
      : offers.length > 0
        ? offers[0].price
        : 0;
    if (price > 0) {
      addRecentlyViewed({
        id,
        title: productInfo.title,
        platform: productInfo.platform,
        image_url: productInfo.image_url,
        price,
      });
    }
  }, [productInfo, id, loading, kinguinOffer, offers]);

  // JSON-LD structured data for SEO
  useEffect(() => {
    if (!productInfo || !id) return;
    const price = kinguinOffer ? getDynamicKinguinPrice(kinguinOffer) : (offers.length > 0 ? offers[0].price : null);
    const productUrl = `https://agevers.com/product/${id}`;
    // Compute availability dynamically
    const isPreOrder = !!productInfo.release_date && new Date(productInfo.release_date) > new Date();
    const totalStock =
      (kinguinOffer?.kinguin_stock || 0) +
      offers.reduce((sum, o) => sum + (o.kinguinStock || 0), 0);
    const availability = isPreOrder
      ? "https://schema.org/PreOrder"
      : totalStock > 0 || price
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";

    // Price valid for 30 days
    const priceValidUntil = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    // Brand: prefer publisher, fallback to store/platform
    const brandName =
      (productInfo.publishers && productInfo.publishers[0]) ||
      productInfo.store ||
      productInfo.platform;

    // Kinguin ID acts as MPN (manufacturer part number)
    const mpn = kinguinOffer?.kinguin_product_id || undefined;

    const productNode: Record<string, unknown> = {
      "@type": "Product",
      "@id": `${productUrl}#product`,
      name: productInfo.title,
      image: productInfo.image_url || undefined,
      description:
        (productInfo.description || `${productInfo.title} - Digital code for ${productInfo.platform}`)
          .replace(/<[^>]*>/g, "")
          .slice(0, 5000),
      brand: { "@type": "Brand", name: brandName },
      sku: id,
      mpn: mpn,
      productID: mpn ? `kinguin:${mpn}` : id,
      category: productInfo.category || productInfo.platform,
      url: productUrl,
      isFamilyFriendly: true,
    };

    if (productInfo.developers && productInfo.developers.length > 0) {
      productNode.manufacturer = {
        "@type": "Organization",
        name: productInfo.developers[0],
      };
    }
    if (productInfo.languages && productInfo.languages.length > 0) {
      productNode.inLanguage = productInfo.languages;
    }
    if (productInfo.release_date) {
      productNode.releaseDate = new Date(productInfo.release_date)
        .toISOString()
        .split("T")[0];
    }
    if (productInfo.region) {
      productNode.audience = {
        "@type": "PeopleAudience",
        geographicArea: {
          "@type": "AdministrativeArea",
          name: productInfo.region,
        },
      };
    }

    // AggregateRating — based on REAL verified-buyer reviews only.
    // No reviews → no rating emitted (Google policy compliant).
    if (ratingStats && ratingStats.review_count > 0 && ratingStats.avg_rating) {
      productNode.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: Number(ratingStats.avg_rating),
        bestRating: 5,
        worstRating: 1,
        ratingCount: ratingStats.review_count,
        reviewCount: ratingStats.review_count,
      };
    }

    if (price) {
      productNode.offers = {
        "@type": "Offer",
        url: productUrl,
        priceCurrency: "EUR",
        price: price.toFixed(2),
        priceValidUntil,
        availability,
        itemCondition: "https://schema.org/NewCondition",
        seller: {
          "@type": "Organization",
          name: "Agever's",
          url: "https://agevers.com/",
        },
        hasMerchantReturnPolicy: {
          "@type": "MerchantReturnPolicy",
          applicableCountry: "WORLDWIDE",
          returnPolicyCategory:
            "https://schema.org/MerchantReturnFiniteReturnWindow",
          merchantReturnDays: 14,
          returnMethod: "https://schema.org/ReturnByMail",
          returnFees: "https://schema.org/FreeReturn",
        },
        shippingDetails: {
          "@type": "OfferShippingDetails",
          shippingRate: {
            "@type": "MonetaryAmount",
            value: "0",
            currency: "EUR",
          },
          shippingDestination: {
            "@type": "DefinedRegion",
            geoMidpoint: { "@type": "GeoCoordinates" },
          },
          deliveryTime: {
            "@type": "ShippingDeliveryTime",
            handlingTime: {
              "@type": "QuantitativeValue",
              minValue: 0,
              maxValue: 0,
              unitCode: "MIN",
            },
            transitTime: {
              "@type": "QuantitativeValue",
              minValue: 0,
              maxValue: 0,
              unitCode: "MIN",
            },
          },
        },
      };
    }

    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        productNode,
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://agevers.com/" },
            { "@type": "ListItem", position: 2, name: productInfo.platform, item: `https://agevers.com/${(productInfo.platform || "").toLowerCase().replace(/\s+/g, "-")}` },
            { "@type": "ListItem", position: 3, name: productInfo.title, item: productUrl },
          ],
        },
        {
          "@type": "QAPage",
          mainEntity: {
            "@type": "Question",
            name: `Is ${productInfo.title} for ${productInfo.platform} available for instant delivery?`,
            text: `Can I buy ${productInfo.title} for ${productInfo.platform} and receive the key instantly?`,
            answerCount: 1,
            acceptedAnswer: {
              "@type": "Answer",
              text: `Yes. ${productInfo.title} is available at Agever's as a digital ${productInfo.platform} key with instant delivery after payment. Region: ${productInfo.region || "Worldwide"}. Sourced from authorised distributors and protected by PayPal Buyer Protection plus a 14-day refund guarantee on undelivered keys.`,
              upvoteCount: 12,
              url: productUrl,
              author: { "@type": "Organization", name: "Agever's" },
            },
          },
        },
      ],
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    script.id = "product-jsonld";
    const existing = document.getElementById("product-jsonld");
    if (existing) existing.remove();
    document.head.appendChild(script);
    // Set page title & meta description
    document.title = `Buy ${productInfo.title} | Cheap ${productInfo.platform} Key — Agever's`;
    const metaDesc = document.querySelector('meta[name="description"]');
    const descText = productInfo.description
      ? productInfo.description.replace(/<[^>]*>/g, '').slice(0, 155) + '…'
      : `Buy ${productInfo.title} cheap ${productInfo.platform} key with instant delivery. Best price guaranteed at Agever's.`;
    if (metaDesc) metaDesc.setAttribute("content", descText);
    // Set canonical URL for this product page
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonical) canonical.href = `https://agevers.com/product/${id}`;
    // hreflang — single English locale, x-default fallback
    const ensureHreflang = (lang: string, href: string) => {
      let el = document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${lang}"]`);
      if (!el) {
        el = document.createElement("link");
        el.rel = "alternate";
        el.hreflang = lang;
        document.head.appendChild(el);
      }
      el.href = href;
    };
    const productHref = `https://agevers.com/product/${id}`;
    ensureHreflang("en", productHref);
    ensureHreflang("x-default", productHref);
    return () => {
      document.getElementById("product-jsonld")?.remove();
      if (canonical) canonical.href = "https://agevers.com/";
      ensureHreflang("en", "https://agevers.com/");
      ensureHreflang("x-default", "https://agevers.com/");
      if (metaDesc) metaDesc.setAttribute("content", "Buy digital game codes for PC, PlayStation, Xbox & Nintendo. Instant delivery, best prices, secure payment. Thousands of games available.");
      document.title = "Agever's - Digital Game Codes | PC, PlayStation, Xbox & Nintendo";
    };
  }, [productInfo, id, kinguinOffer, offers, ratingStats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-48 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="aspect-square bg-muted rounded-lg animate-pulse" />
            <div className="space-y-4">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              <div className="h-12 w-48 bg-muted rounded animate-pulse mt-6" />
              <div className="h-20 w-full bg-muted rounded animate-pulse mt-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleNotifyMe = async () => {
    if (!notifyEmail || !productInfo?.allowed_product_id) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(notifyEmail)) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }
    setNotifySubmitting(true);
    const { error } = await supabase.from("stock_notifications" as any).insert({
      email: notifyEmail,
      allowed_product_id: productInfo.allowed_product_id,
    });
    setNotifySubmitting(false);
    if (error) {
      if (error.code === "23505") {
        setNotifySubmitted(true);
        toast({ title: "You're already subscribed for this product" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
      return;
    }
    setNotifySubmitted(true);
    toast({ title: "We'll notify you when this product is back in stock!" });
  };





  const selectedVar = variations.find((v: any) => v.id === selectedVariation);
  const selectedVariationImage = selectedVar?.image_url || (selectedVar?.sku_id ? variationImageOverrides[String(selectedVar.sku_id)] : null);
  const rawHeroImage = selectedVariationImage || productInfo.image_url || "";
  // format=auto (WebP/AVIF) + a size that matches the actual hero display —
  // JSON-LD's own `image` field further below keeps the untouched original,
  // since Google prefers full-resolution art for rich results.
  const heroImage = standardizeImageUrl(rawHeroImage, { width: 1000, height: 1000, fit: "contain" }) ?? rawHeroImage;
  const sellerLowest = offers.length > 0 ? offers[0].price : null;
  const kinguinPrice = (kinguinOffer && !productInfo?.aliexpress_product_id) ? getDynamicKinguinPrice(kinguinOffer) : null;
  const aliExpressPrice = (productInfo?.aliexpress_product_id && selectedVar?.price) ? selectedVar.price : (productInfo?.aliexpress_product_id && offers.length > 0 ? offers[0].price : null);
  const priceOptions = [sellerLowest, kinguinPrice, aliExpressPrice].filter((p): p is number => p !== null && p > 0);
  const lowestPrice = priceOptions.length > 0 ? Math.min(...priceOptions) : null;
  const highestOriginal = offers.reduce((max, o) => Math.max(max, o.original_price || 0), 0);
  const discount = lowestPrice && highestOriginal > 0
    ? Math.round((1 - lowestPrice / highestOriginal) * 100)
    : 0;

  // Calculate total available stock across all sources (including AliExpress variations)
  const variationTotalStock = variations.length > 0
    ? variations.reduce((sum: number, v: any) => sum + (v.stock || 0), 0)
    : 0;
  const isAliExpressProduct = !!productInfo?.aliexpress_product_id;
  const totalAvailableStock = isAliExpressProduct
    ? Math.max(variationTotalStock, 0)
    : Math.max(
        ...offers.map(o => o.stockCount || 0),
        kinguinOffer ? (kinguinOffer.total_stock ?? kinguinOffer.kinguin_stock ?? 0) : 0,
        variationTotalStock,
        0
      );

  return (
    <>
    <FlyToCartOverlay items={flyingItems} />
    <div className="min-h-screen bg-background pt-[calc(var(--new-account-banner-height,0px)+5rem)] md:pt-[calc(var(--new-account-banner-height,0px)+8rem)]">
      <Navbar />

      {/* OUT OF STOCK Banner */}
      {totalAvailableStock <= 0 && (
        <div className="bg-destructive/10 border-b border-destructive/30">
          <div className="container mx-auto px-4 py-3 flex items-center justify-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <span className="font-display text-sm md:text-base font-bold tracking-wider text-destructive uppercase">
              Out of Stock
            </span>
          </div>
        </div>
      )}

      <div className="relative w-full h-[340px] md:h-[420px] overflow-hidden">
        {heroImage ? (
          <>
            <img src={heroImage} alt="" aria-hidden="true" decoding="async" className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm" />
            <div className="absolute inset-0 bg-background/60" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-secondary to-background" />
        )}
        <div className="relative z-10 container mx-auto px-4 pt-6 md:pt-8">
          <Button
            variant="ghost"
            className="gap-2 text-foreground/80 hover:text-foreground hover:bg-transparent"
            onClick={() => {
              const platformMap: Record<string, string> = {
                "Steam": "/steam",
                "Microsoft Store": "/microsoft-store",
                "GOG": "/gog",
                "Epic Games": "/epic-games",
                "Blizzard": "/blizzard",
                "EA Games": "/ea-games",
                "Rockstar": "/rockstar",
                "Xbox": "/xbox",
                "PlayStation": "/playstation",
                "Nintendo": "/nintendo",
                "Mobile": "/mobile",
              };
              const route = productInfo ? platformMap[productInfo.platform] : null;
              if (route) {
                // For platform-mode pages, map store name to tab
                const platformModePages = ["Xbox", "PlayStation", "Nintendo"];
                const storeToTab: Record<string, string> = {
                  "Games": "games",
                  "Subscriptions": "subscriptions",
                  "Top Ups": "topups",
                };
                const tab = productInfo && platformModePages.includes(productInfo.platform)
                  ? storeToTab[productInfo.store]
                  : null;
                navigate(tab ? `${route}?tab=${tab}` : route);
              } else {
                navigate(-1);
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 -mt-40 md:-mt-48 relative z-10 pb-16 max-w-6xl">
        <div className="flex flex-col md:flex-row gap-6 lg:gap-10 md:items-stretch">
          {/* Cover Image & Gallery */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full md:w-[40%] flex-shrink-0 md:mt-24"
          >
            <div className="relative rounded-xl overflow-hidden shadow-2xl bg-secondary">
              {/* Live viewers badge */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm border border-red-500/50">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <Eye className="h-3 w-3 text-red-400" />
                <span className="text-[11px] font-bold text-red-400">
                  {(() => {
                    const stored = sessionStorage.getItem(`viewers_${id}`);
                    const data = stored ? JSON.parse(stored) : null;
                    if (data && data.count < 8) {
                      sessionStorage.setItem(`viewers_${id}`, JSON.stringify({ v: data.v, count: data.count + 1 }));
                      return data.v;
                    }
                    const v = Math.floor(Math.random() * 80) + 15;
                    sessionStorage.setItem(`viewers_${id}`, JSON.stringify({ v, count: 1 }));
                    return v;
                  })()} people viewing now
                </span>
              </div>
              {heroImage ? (
                <div
                  className="relative"
                  onMouseEnter={() => setIsHoveringCover(true)}
                  onMouseLeave={() => setIsHoveringCover(false)}
                >
                  {isHoveringCover && productInfo.video_url && (() => {
                    const videoId = productInfo.video_url!.includes("youtube.com/watch")
                      ? new URL(productInfo.video_url!).searchParams.get("v")
                      : null;
                    return videoId ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1`}
                        className="absolute inset-0 w-full h-full z-10"
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    ) : null;
                  })()}
                  <img src={heroImage} alt={productInfo.title} fetchPriority="high" decoding="async" className="w-full h-auto object-contain" />
                  {productInfo.video_url && !isHoveringCover && (
                    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm text-[11px] text-muted-foreground">
                      <div className="w-0 h-0 border-l-[6px] border-l-primary border-y-[4px] border-y-transparent" />
                      Hover to play
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center py-16">
                  <Tag className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </div>
          </motion.div>

          {/* Product Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 w-full glass rounded-xl p-6 md:p-8 md:mt-24 flex flex-col"
          >
            {productInfo.region && (
              <RegionCompatibility region={productInfo.region} />
            )}
            <div className="flex items-center gap-2 mt-3 mb-2">
                <h1 className="font-display text-2xl md:text-3xl font-black tracking-wider text-foreground">
                  {getDisplayProductTitle(productInfo.title, productInfo.description || "", productInfo.original_title)}
              </h1>
              {isAdmin && productInfo.allowed_product_id && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
                    title="Edit product"
                    onClick={() => {
                      setEditTitle(productInfo.title);
                      setEditDescription(productInfo.description || "");
                      setEditPlatform(productInfo.platform);
                      setEditStore(productInfo.store);
                      setEditRegion(productInfo.region || "Global");
                      setEditImageUrl(productInfo.image_url || "");
                      const lowestP = offers.length > 0 ? offers[0].price : (kinguinOffer ? getDynamicKinguinPrice(kinguinOffer) : undefined);
                      setEditPrice(lowestP ? String(lowestP) : "");
                      // Load badges from allowed_products
                      supabase.from("allowed_products").select("badges, product_type").eq("id", productInfo.allowed_product_id).maybeSingle().then(({ data }) => {
                        setEditBadges(data?.badges || []);
                        setEditProductType((data as any)?.product_type || (isNoTypeProduct({ store: productInfo.store }) ? "" : "Game"));
                      });
                      setNewBadge("");
                      setEditModalOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
                    title="Paraphrase description"
                    disabled={paraphrasing}
                    onClick={async () => {
                      if (!productInfo.allowed_product_id) return;
                      setParaphrasing(true);
                      try {
                        const { data: sessionData } = await supabase.auth.getSession();
                        const token = sessionData?.session?.access_token;
                        const res = await fetch(
                          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-descriptions`,
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              action: "paraphrase_one",
                              product_id: productInfo.allowed_product_id,
                            }),
                          }
                        );
                        const result = await res.json();
                        if (result.error) throw new Error(result.error);
                        toast({ title: "Paraphrase complete", description: result.title ? `"${result.title}" updated` : "Description updated" });
                        fetchProductData();
                      } catch (err: any) {
                        toast({ title: "Paraphrase failed", description: err.message, variant: "destructive" });
                      } finally {
                        setParaphrasing(false);
                      }
                    }}
                  >
                    <Wand2 className={`h-4 w-4 ${paraphrasing ? "animate-spin" : ""}`} />
                  </Button>
                </>
              )}
            </div>
            {ratingStats && ratingStats.review_count > 0 && (
              <div className="mb-3">
                <ProductRatingSummary stats={ratingStats} />
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4 flex-wrap">
              {(() => {
                // For In-Game Items products, derive Platform + Sub-Platform from platform_details/title.
                // PC stores (Steam/Epic/GOG/...) → Platform=PC, Sub-Platform=<store>.
                // Console platforms (Xbox/PlayStation/Nintendo) → Platform=<console>, Sub-Platform=In-Game Items.
                const isInGameItems =
                  productInfo.platform === "In-Game Items" || productInfo.store === "In-Game Items";
                const PC_STORES = [
                  "Steam", "Epic Games", "GOG", "Battle.net", "EA App", "Origin",
                  "Ubisoft Connect", "Uplay", "MS Store (PC)", "Microsoft Store",
                  "Rockstar", "Bethesda", "Official Website",
                ];
                const matchPcStore = (val: string): string | null => {
                  const v = val.toLowerCase();
                  for (const s of PC_STORES) if (v.includes(s.toLowerCase())) return s;
                  return null;
                };
                const matchConsole = (val: string): string | null => {
                  const v = val.toLowerCase();
                  if (v.includes("xbox")) return "Xbox";
                  if (v.includes("playstation") || /\bps[345]\b/.test(v) || v.includes("psn")) return "PlayStation";
                  if (v.includes("nintendo") || v.includes("switch")) return "Nintendo";
                  return null;
                };
                const inferFromTitle = (title: string) => {
                  const t = title || "";
                  return { pc: matchPcStore(t), console: matchConsole(t) };
                };
                let displayPlatform = productInfo.platform;
                let displaySubPlatform: string | null = productInfo.store || null;
                if (isInGameItems) {
                  const pd = (productInfo.platform_details || "").trim();
                  const pdLower = pd.toLowerCase();
                  const usePd = pd && pdLower !== "other";
                  const pcStore = usePd ? matchPcStore(pd) : null;
                  const consoleP = usePd ? matchConsole(pd) : null;
                  if (pcStore) {
                    displayPlatform = "PC";
                    displaySubPlatform = pcStore;
                  } else if (consoleP) {
                    displayPlatform = consoleP;
                    displaySubPlatform = "In-Game Items";
                  } else {
                    // Fall back to title-based inference
                    const inferred = inferFromTitle(productInfo.title);
                    if (inferred.pc) {
                      displayPlatform = "PC";
                      displaySubPlatform = inferred.pc;
                    } else if (inferred.console) {
                      displayPlatform = inferred.console;
                      displaySubPlatform = "In-Game Items";
                    }
                  }
                }
                return (
                  <>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Platform</span>
                      <span className="text-primary font-medium">{displayPlatform}</span>
                    </div>
                    {displaySubPlatform && displaySubPlatform !== displayPlatform && (
                      <>
                        <span className="text-muted-foreground/40">•</span>
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Sub-Platform</span>
                          <span className="text-primary font-medium">{displaySubPlatform}</span>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
              {(() => {
                const typeLabel = getProductTypeLabel({
                  title: productInfo.title,
                  originalTitle: productInfo.original_title,
                  description: productInfo.description,
                  category: productInfo.category,
                  store: productInfo.store,
                  productType: productInfo.product_type,
                });
                if (!typeLabel) return null;
                return (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Type</span>
                      <span className="text-primary font-medium">
                        {typeLabel}
                        {(() => {
                          const t = productInfo.title.toUpperCase();
                          if (t.includes("ALTERGIFT")) return " • Altergift";
                          if (t.includes("STEAM ACCOUNT") || t.includes("ACCOUNT")) return " • Account";
                          if (t.includes("STEAM GIFT")) return " • Steam Gift";
                          return "";
                        })()}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Expiration Warning - only for future dates */}
            {productInfo.expiration_date && new Date(productInfo.expiration_date) > new Date() && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-sm font-medium text-amber-500">
                  ⚠️ This key must be redeemed by {new Date(productInfo.expiration_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
            )}

            {/* Pre-Order Release Date */}
            {productInfo.release_date && new Date(productInfo.release_date) > new Date() && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/50 mb-2 shadow-[0_0_20px_-5px_rgba(249,115,22,0.4)]">
                <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-orange-500 text-white shrink-0">
                  PRE-ORDER
                </span>
                <span className="text-sm font-semibold text-orange-200">
                  Release date is {new Date(productInfo.release_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
            )}

            {/* Add-on requires base game warning */}
            {isAddonRequiringBaseGame({
              title: productInfo.title,
              originalTitle: productInfo.original_title,
              description: productInfo.description,
              category: productInfo.category,
              store: productInfo.store,
              productType: productInfo.product_type,
            }) && (() => {
              const baseName = extractBaseGameName(productInfo.title);
              const label = getProductTypeLabel({
                title: productInfo.title,
                originalTitle: productInfo.original_title,
                description: productInfo.description,
                category: productInfo.category,
                store: productInfo.store,
                productType: productInfo.product_type,
              });
              if (!label) return null;
              const typeWord = label.toUpperCase();
              return (
                <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-600/15 border-2 border-red-500/60 mb-3 shadow-[0_0_18px_-4px_rgba(239,68,68,0.55)]">
                  <AlertTriangle className="h-6 w-6 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                  <p className="text-sm md:text-base font-bold text-red-500 leading-snug uppercase tracking-wide">
                    THIS IS NOT THE BASE GAME{baseName ? ` (${baseName})` : ""}, THIS IS A {typeWord} AND THE BASE GAME{baseName ? ` (${baseName})` : ""} IS REQUIRED TO ACTIVATE THIS {typeWord}
                  </p>
                </div>
              );
            })()}

            {/* Base game purchase link (shown only when add-on AND base game exists in our catalog) */}
            {baseGameMatch && isAddonRequiringBaseGame({
              title: productInfo.title,
              originalTitle: productInfo.original_title,
              description: productInfo.description,
              category: productInfo.category,
              store: productInfo.store,
              productType: productInfo.product_type,
            }) && (
              <button
                type="button"
                onClick={() => navigate(`/product/${baseGameMatch.slug}`)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600/10 border-2 border-blue-500/50 mb-3 hover:bg-blue-600/20 transition text-left"
              >
                {baseGameMatch.image_url && (
                  <img
                    src={baseGameMatch.image_url}
                    alt={baseGameMatch.title}
                    className="w-12 h-12 rounded object-cover shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-400 mb-0.5">
                    Don't own the base game yet?
                  </p>
                  <p className="text-sm font-bold text-blue-300 truncate">
                    Buy {baseGameMatch.title} →
                  </p>
                </div>
              </button>
            )}

            {/* Base game + Bonus included notice (green) */}
            {!isAddonRequiringBaseGame({
              title: productInfo.title,
              originalTitle: productInfo.original_title,
              description: productInfo.description,
              category: productInfo.category,
              store: productInfo.store,
              productType: productInfo.product_type,
            }) && getProductTypeLabel({
              title: productInfo.title,
              originalTitle: productInfo.original_title,
              description: productInfo.description,
              category: productInfo.category,
              store: productInfo.store,
              productType: productInfo.product_type,
            }) === "GAME + BONUS" && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-emerald-600/15 border-2 border-emerald-500/60 mb-3 shadow-[0_0_18px_-4px_rgba(16,185,129,0.45)]">
                <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm md:text-base font-bold text-emerald-500 leading-snug uppercase tracking-wide">
                  This product includes the full base game + Pre-Order Bonus content. No additional purchase required.
                </p>
              </div>
            )}

            <div className="flex items-center gap-5 mb-4 flex-wrap">
              {(() => {
                const kgStock = kinguinOffer?.total_stock || 0;
                const sellerDirectStock = offers.filter(o => !o.kinguinBacked).reduce((s, o) => s + (o.stockCount || 0), 0);
                const totalStock = kgStock + sellerDirectStock;
                const inStock = totalStock > 0;
                return (
                  <div className="flex items-center gap-1.5 text-sm">
                    {inStock ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-neon-green" />
                        <span className="text-neon-green font-medium">{totalStock} in stock</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-destructive font-bold">Out of stock</span>
                      </>
                    )}
                  </div>
                );
              })()}
              {productInfo.aliexpress_product_id ? (
                <div className="flex items-center gap-1.5 text-sm">
                  {shippingLoading ? (
                    <>
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Checking shipping...</span>
                    </>
                  ) : shippingOptions.length > 0 ? (
                    <>
                      <Truck className="h-4 w-4 text-neon-green" />
                      <span className="text-neon-green font-medium">Ships to you</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-yellow-500 font-medium">No shipment available to your area</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Download className="h-4 w-4" />
                  <span>Instant delivery</span>
                </div>
              )}
            </div>

            {/* Variations for physical products */}
            {productInfo.aliexpress_product_id && variations.length > 0 && (
              <div className="mb-4 p-3 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="font-display text-xs font-bold tracking-wider uppercase text-foreground">Select Variation</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variations.map((v: any) => {
                    const isSelected = selectedVariation === v.id;
                    const varImage = v.image_url || variationImageOverrides[String(v.sku_id)] || null;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariation(v.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                            : "border-border bg-background/50 text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {varImage && (
                          <img src={varImage} alt={v.variation_name} className="h-8 w-8 rounded object-cover" />
                        )}
                        <span className="font-display font-medium">{v.variation_name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shipping options for physical products */}
            {productInfo.aliexpress_product_id && (
              <div className="mb-4 p-3 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    <span className="font-display text-xs font-bold tracking-wider uppercase text-foreground">Shipping Options</span>
                  </div>
                  <select
                    value={shippingCountry}
                    onChange={(e) => setShippingCountry(e.target.value)}
                    className="text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[160px]"
                  >
                    {SHIPPING_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                {shippingLoading ? (
                  <p className="text-xs text-muted-foreground animate-pulse">Loading shipping options...</p>
                ) : shippingOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No shipping available for this country</p>
                ) : (
                  <div className="space-y-2">
                    {shippingOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-md bg-background/50 border border-border/50">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground font-medium">{opt.service_name?.replace(/AliExpress\s*/gi, "").replace(/Selection\s*/gi, "").trim() || "Standard"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {opt.estimated_delivery_time && (
                            <span className="text-muted-foreground">{opt.estimated_delivery_time}</span>
                          )}
                          <span className={`font-bold ${opt.free_shipping ? "text-neon-green" : "text-primary"}`}>
                            {opt.free_shipping ? "Free" : `€${opt.freight_amount}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {lowestPrice && (
              <div className="flex items-baseline gap-3 mb-5">
                <span className="font-display text-3xl font-black text-primary">
                  {formatPrice(lowestPrice)}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Price information"
                      className="self-center inline-flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-center">
                    Final price shown at checkout
                  </TooltipContent>
                </Tooltip>
                {discount > 0 && (
                  <span className="text-xs font-bold bg-neon-green/15 text-neon-green px-2 py-0.5 rounded-full">
                    Save {discount}%
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              {!!lowestPrice && !canAddItem(lowestPrice) ? (
                <Tooltip open={lockedTipOpen} onOpenChange={setLockedTipOpen}>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => {
                        setLockedTipOpen(true);
                        clearTimeout(lockedTipTimerRef.current);
                        lockedTipTimerRef.current = setTimeout(() => setLockedTipOpen(false), 3000);
                      }}
                    >
                      <Button
                        className="h-10 px-6 font-display tracking-wider text-sm gap-2 opacity-50 cursor-not-allowed"
                        disabled
                      >
                        <Clock className="h-4 w-4" />
                        Locked
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-center">
                    New accounts are limited to €{limitEur} total in cart for the first 24 hours.
                  </TooltipContent>
                </Tooltip>
              ) : (
              <>
              <Button
                className="h-10 px-6 font-display tracking-wider text-sm gap-2"
                disabled={!lowestPrice}
                onClick={(e) => {
                  e.stopPropagation();
                  const doAction = () => {
                    if (kinguinOffer && getDynamicKinguinPrice(kinguinOffer) === lowestPrice) {
                      handleBuyKinguin();
                    } else if (offers.length > 0) {
                      handleBuy(offers[0]);
                    }
                  };
                  if (regionMismatch) {
                    pendingRegionActionRef.current = doAction;
                    setShowRegionWarning(true);
                  } else {
                    doAction();
                  }
                }}
              >
                Buy Now
              </Button>
              <Button
                variant="outline"
                className="h-10 px-6 font-display tracking-wider text-sm gap-2 border-border text-muted-foreground hover:text-primary"
                disabled={!lowestPrice}
                onClick={(e) => {
                  e.stopPropagation();
                  const doAction = () => {
                    try { triggerFly(e); } catch {}
                    if (kinguinOffer && getDynamicKinguinPrice(kinguinOffer) === lowestPrice) {
                      addItem({
                        offerId: kinguinOffer.allowed_product_id,
                        title: productInfo?.title || "",
                        platform: productInfo?.platform || "",
                        price: getDynamicKinguinPrice(kinguinOffer),
                        sellerName: "Agevers",
                        image_url: productInfo?.image_url || null,
                        maxStock: totalAvailableStock || undefined,
                      });
                    } else if (offers.length > 0) {
                      addItem({
                        offerId: offers[0].id,
                        title: productInfo?.title || "",
                        platform: productInfo?.platform || "",
                        price: offers[0].price,
                        sellerName: offers[0].sellerName,
                        image_url: productInfo?.image_url || null,
                        maxStock: offers[0].stockCount,
                      });
                    }
                  };
                  if (regionMismatch) {
                    pendingRegionActionRef.current = doAction;
                    setShowRegionWarning(true);
                  } else {
                    doAction();
                  }
                }}
              >
                <ShoppingCart className="h-4 w-4" />
                Add to Cart
              </Button>
              </>
              )}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-10 w-10 border-border ${isInWishlist ? "text-primary bg-primary/10 border-primary/30" : "text-muted-foreground hover:text-primary"}`}
                  onClick={handleWishlist}
                >
                  <Heart className={`h-4 w-4 ${isInWishlist ? "fill-primary" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Notify Me - Out of Stock */}
            {totalAvailableStock <= 0 && productInfo.allowed_product_id && (
              <div className="mt-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="h-4 w-4 text-destructive" />
                  <span className="font-display text-sm font-bold tracking-wider text-destructive uppercase">
                    Get notified when back in stock
                  </span>
                </div>
                {notifySubmitted ? (
                  <div className="flex items-center gap-2 text-sm text-neon-green">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">We'll email you when this product is available!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      className="h-9 text-sm flex-1"
                      onKeyDown={(e) => e.key === "Enter" && handleNotifyMe()}
                    />
                    <Button
                      size="sm"
                      className="h-9 px-4 font-display tracking-wider text-xs uppercase gap-1.5"
                      onClick={handleNotifyMe}
                      disabled={notifySubmitting || !notifyEmail}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      Notify Me
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>

        {/* Screenshots & Video Gallery */}
        {(() => {
          const galleryImages: string[] = [];
          if (productInfo.screenshots?.length) {
            for (const s of productInfo.screenshots) {
              if (s && s !== productInfo.image_url) {
                galleryImages.push(s);
              }
            }
          }
          if (galleryImages.length === 0) return null;
          return (
            <div className="flex gap-3 mt-6 overflow-x-auto pb-2 scrollbar-thin">
              {galleryImages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className="relative flex-shrink-0 w-[180px] rounded-lg overflow-hidden bg-secondary border border-border/50 hover:border-primary/50 transition-all group cursor-pointer"
                >
                  <img src={url} alt="" className="w-full h-auto object-cover aspect-video" />
                </button>
              ))}
            </div>
          );
        })()}

        {cleanedDescription && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 glass rounded-xl p-6 md:p-8"
          >
            <h2 className="font-display text-lg font-bold text-foreground tracking-wider uppercase mb-4">
              Description
            </h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {cleanedDescription}
            </p>
          </motion.div>
        )}

        {/* Product Details */}
        {(() => {
          const hasDevs = productInfo.developers && productInfo.developers.length > 0;
          const hasPubs = productInfo.publishers && productInfo.publishers.length > 0;
          const genreBadges = filterGenreBadges(productInfo.badges);
          const hasGenres = genreBadges.length > 0;
          const hasRegLim = !!productInfo.regional_limitations;
          const hasPlatDet = !!productInfo.platform_details;
          const hasLangs = productInfo.languages && productInfo.languages.length > 0;
          const hasRelDate = !!productInfo.release_date;
          const hasAny = hasDevs || hasPubs || hasGenres || hasRegLim || hasPlatDet || hasLangs || hasRelDate;
          if (!hasAny) return null;

          const rows: { label: string; value: string }[] = [];
          if (hasGenres) rows.push({ label: "Genre", value: genreBadges.join(", ") });
          if (hasDevs) rows.push({ label: "Developers", value: productInfo.developers!.join(", ") });
          if (hasPubs) rows.push({ label: "Publishers", value: productInfo.publishers!.join(", ") });
          if (hasRegLim) rows.push({ label: "Regional Limitations", value: productInfo.regional_limitations! });
          if (hasPlatDet) rows.push({ label: "Platform", value: productInfo.platform_details! });
          if (hasLangs) rows.push({ label: "Languages", value: productInfo.languages!.join(", ") });
          if (hasRelDate) rows.push({ label: "Release Date", value: new Date(productInfo.release_date!).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) });

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="mt-8 glass rounded-xl p-6 md:p-8"
            >
              <h2 className="font-display text-lg font-bold text-foreground tracking-wider uppercase mb-4">
                Product Details
              </h2>
              <div className="grid gap-3">
                {rows.map((row) => (
                  <div key={row.label} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                    <span className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground min-w-[160px]">
                      {row.label}
                    </span>
                    <span className="text-sm text-foreground">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })()}

        {/* System Requirements */}
        {productInfo.system_requirements && (productInfo.system_requirements.minimum || productInfo.system_requirements.recommended) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.23 }}
            className="mt-8 glass rounded-xl p-6 md:p-8"
          >
            <h2 className="font-display text-lg font-bold text-foreground tracking-wider uppercase mb-6">
              System Requirements
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {productInfo.system_requirements.minimum && (
                <div>
                  <h3 className="font-display text-sm font-bold text-primary tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Minimum
                  </h3>
                  <div className="space-y-2.5">
                    {(() => {
                      const req = productInfo.system_requirements.minimum;
                      const fields = [
                        { label: "OS", value: req.os },
                        { label: "Processor", value: req.processor },
                        { label: "Memory", value: req.memory },
                        { label: "Graphics", value: req.graphics },
                        { label: "DirectX", value: req.directX },
                        { label: "Storage", value: req.storage },
                        { label: "Sound", value: req.sound },
                        { label: "Network", value: req.network },
                      ].filter(f => f.value);
                      return fields.map(f => (
                        <div key={f.label} className="flex gap-3">
                          <span className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground min-w-[90px] pt-0.5">{f.label}</span>
                          <span className="text-sm text-foreground">{f.value}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
              {productInfo.system_requirements.recommended && (
                <div>
                  <h3 className="font-display text-sm font-bold text-primary tracking-wider uppercase mb-3 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Recommended
                  </h3>
                  <div className="space-y-2.5">
                    {(() => {
                      const req = productInfo.system_requirements.recommended;
                      const fields = [
                        { label: "OS", value: req.os },
                        { label: "Processor", value: req.processor },
                        { label: "Memory", value: req.memory },
                        { label: "Graphics", value: req.graphics },
                        { label: "DirectX", value: req.directX },
                        { label: "Storage", value: req.storage },
                        { label: "Sound", value: req.sound },
                        { label: "Network", value: req.network },
                      ].filter(f => f.value);
                      return fields.map(f => (
                        <div key={f.label} className="flex gap-3">
                          <span className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground min-w-[90px] pt-0.5">{f.label}</span>
                          <span className="text-sm text-foreground">{f.value}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Key Activation Guide - hide for physical/gaming accessories products */}
        {productInfo.platform !== "Gaming Accessories" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-8 glass rounded-xl p-6 md:p-8"
        >
          <h2 className="font-display text-lg font-bold text-foreground tracking-wider uppercase mb-4">
            Key Activation
          </h2>
          {(() => {
            const activationGuides: Record<string, { label: string; url: string; steps: string[]; notes?: string[] }> = {
              "Binance": {
                label: "Binance Gift Card",
                url: "https://www.binance.com/en/support/faq/binance-gift-card-faqs",
                steps: [
                  "Open the Binance App (if you're a new user, register at binance.com and download the Binance App first).",
                  "Tap the Profile icon in the top left corner, then tap \"Gift Card\".",
                  "Tap \"Receive\" → tap \"Redeem Crypto\".",
                  "Enter your gift card code (16-digit alphanumeric sequence) to redeem it.",
                ],
                notes: [
                  "Make sure not to show your gift card redemption code to anyone, and redeem it as soon as you receive it.",
                  "For more questions, please see the Binance Gift Cards FAQ and the Binance Gift Card Terms and Conditions.",
                ],
              },
              "Windows 11": {
                label: "Windows 11",
                url: "https://www.microsoft.com/software-download/windows11",
                steps: [
                  "Download Windows 11 from the official Microsoft page: https://www.microsoft.com/software-download/windows11",
                  "During installation, enter your product key when prompted.",
                  "Or, after installation, open Start → Settings → System → Activation → Change product key, and enter the key you received.",
                  "If you encounter any errors during activation, run the built-in Activation Troubleshooter (Settings → System → Activation → Troubleshoot).",
                ],
                notes: [
                  "This product cannot be used to upgrade your system from another version — perform a clean install, or make sure the current edition matches the key (e.g. Pro key on a Pro install).",
                  "Retail key: can be transferred between devices, but only one device can be activated with the same key at a time.",
                  "N edition only: media-related features (Windows Media Player, certain Skype/Music/Video/Voice Recorder apps) are not included. If needed, download the free Media Feature Pack for N editions from Microsoft.",
                  "If activation fails online, open the Start menu, type SLUI 04, press Enter, select your country and call the toll-free number to receive a confirmation ID via the automated system.",
                ],
              },
              "Windows 10": {
                label: "Windows 10",
                url: "https://www.microsoft.com/software-download/windows10",
                steps: [
                  "Download Windows 10 from the official Microsoft page: https://www.microsoft.com/software-download/windows10",
                  "During installation, enter your product key when prompted.",
                  "Or, after installation, open Start → Settings → Update & Security → Activation → Change product key, and enter the key you received.",
                  "If activation fails online, open Start, type SLUI 04, press Enter, select your country and call the toll-free number to receive a confirmation ID.",
                ],
                notes: [
                  "This product cannot be used to upgrade your system from another version — perform a clean install, or make sure the current edition matches the key (e.g. Pro key on a Pro install).",
                  "Retail key: can be transferred between devices, but only one device can be activated with the same key at a time.",
                  "N edition only: media-related features (Windows Media Player, Skype, Music, Video, Voice Recorder) are not included. Download the free Media Feature Pack for N editions from Microsoft if needed.",
                  "The system installer must be downloaded from the official Microsoft source (link above).",
                ],
              },
              "Steam": {
                label: "Steam",
                url: "https://store.steampowered.com/account/redeemwalletcode",
                steps: [
                  "Open the Steam client and log in to your account.",
                  "Click on your account name in the top right and select \"Redeem a Steam Wallet Code\".",
                  "Enter your product key and click \"Continue\".",
                  "The game will be added to your library automatically."
                ],
              },
              "PlayStation": {
                label: "PlayStation",
                url: "https://www.playstation.com/en-us/support/store/redeem-ps-store-voucher-code/",
                steps: [
                  "Go to the PlayStation Store on your console or browser.",
                  "Select your avatar icon at the top of the screen.",
                  "Select \"Redeem Codes\" from the dropdown menu.",
                  "Enter the 12-digit code and select \"Redeem\"."
                ],
              },
              "Xbox": {
                label: "Xbox",
                url: "https://www.xbox.com/en-US/redeem",
                steps: [
                  "Go to xbox.com/redeem or open the Microsoft Store on your console.",
                  "Sign in with your Microsoft account.",
                  "Enter the 25-character code and click \"Next\".",
                  "Confirm the redemption to add the content to your account."
                ],
              },
              "Nintendo": {
                label: "Nintendo",
                url: "https://ec.nintendo.com/redeem",
                steps: [
                  "Open the Nintendo eShop on your Nintendo Switch.",
                  "Select \"Enter Code\" on the left side of the screen.",
                  "Enter your 16-digit download code.",
                  "Select \"Confirm\" to redeem and start the download."
                ],
              },
              "Microsoft Store": {
                label: "Microsoft Store / Xbox App",
                url: "https://redeem.microsoft.com/",
                steps: [
                  "Xbox App on Windows: Open the Xbox app, select your gamerpic → Settings → \"Redeem a code\". Enter the 25-character code and follow the prompts.",
                  "Microsoft Store on Windows: Open the Microsoft Store app, click your account icon in the top-right → \"Redeem code or gift cards\". Enter the 25-character code and follow the prompts.",
                  "Web Browser: Visit redeem.microsoft.com, enter your 25-character code, and follow the on-screen instructions."
                ],
              },
              "GOG": {
                label: "GOG",
                url: "https://www.gog.com/redeem",
                steps: [
                  "Go to gog.com/redeem and log in to your GOG account.",
                  "Enter your product code in the redemption field.",
                  "Click \"Continue\" to add the game to your GOG library.",
                  "Download and install via GOG Galaxy or directly from your library."
                ],
              },
              "Epic Games": {
                label: "Epic Games",
                url: "https://store.epicgames.com/en-US/redeem",
                steps: [
                  "Open the Epic Games Store or go to epicgames.com/redeem.",
                  "Log in to your Epic Games account.",
                  "Enter your redemption code.",
                  "The game will appear in your Epic Games library."
                ],
              },
              "Blizzard": {
                label: "Blizzard / Battle.net",
                url: "https://eu.account.battle.net/login/en/password",
                steps: [
                  "Open the Battle.net desktop app and log in.",
                  "Click your account name and select \"Redeem a Code\".",
                  "Enter your product key.",
                  "Click \"Redeem Code\" to add the game to your account."
                ],
              },
              "EA Games": {
                label: "EA Games",
                url: "https://www.ea.com/redeem",
                steps: [
                  "Go to ea.com/redeem and log in to your EA account.",
                  "Enter the product code in the redemption field.",
                  "Click \"Next\" to confirm and redeem.",
                  "The game will be available in your EA app library."
                ],
              },
              "Rockstar": {
                label: "Rockstar Games",
                url: "https://support.rockstargames.com/articles/3WgLWoaEHwgWV70L3UJLhS/redeeming-rockstar-activation-codes-in-the-rockstar-games-launcher",
                steps: [
                  "Open the Rockstar Games Launcher and log in.",
                  "Click the menu icon and select \"Redeem Code\".",
                  "Enter your activation code.",
                  "The game will be added to your Rockstar library."
                ],
              },
              "Just Eat": {
                label: "Just Eat",
                url: "https://www.just-eat.it/",
                steps: [
                  "Go to https://www.just-eat.it/ and log into your account or register a new one.",
                  "Visit your account section, go to \"Redeem a gift card\".",
                  "Enter your Gift Card code.",
                  "Your account will be credited with the amount on the gift card. The account credit will be waiting for you in checkout when you make your next purchase."
                ],
              },
              "Amazon": {
                label: "Amazon",
                url: "https://www.amazon.com/gc/redeem",
                steps: [
                  "Sign in to your Amazon account (or create one if you don't have one yet).",
                  "Navigate to \"Your Account\" and select \"Redeem a Gift Card\".",
                  "Enter the claim code found on your gift card.",
                  "Click \"Apply to Your Balance\" — the funds will be added to your account instantly.",
                  "Note: Once redeemed, gift card funds are tied to your account and cannot be transferred or used to buy other gift cards."
                ],
              },
              "iTunes": {
                label: "iTunes / Apple Gift Card",
                url: "https://support.apple.com/he-il/118242?device-type=iphone",
                steps: [
                  "Follow the official Apple guide for step-by-step redemption instructions on your device.",
                  "Visit: https://support.apple.com/he-il/118242 for full details."
                ],
              },
              "Apple": {
                label: "Apple Gift Card",
                url: "https://support.apple.com/he-il/118242?device-type=iphone",
                steps: [
                  "Open the App Store on your device.",
                  "Sign in to your account.",
                  "Select the \"Redeem Gift Card or Code\" option.",
                  "Enter your Apple gift card code.",
                  "Tap \"Redeem\" to apply the balance to your account."
                ],
              },
              "Google Play": {
                label: "Google Play",
                url: "https://play.google.com/redeem",
                steps: [
                  "Go to play.google.com/redeem and sign in to your Google account.",
                  "Enter your gift card code and click \"Redeem\".",
                  "The balance will be added to your Google Play account instantly.",
                  "Alternatively, open the Google Play Store app on your Android device, tap your profile icon, select \"Payments & subscriptions\" → \"Redeem gift code\", and enter your code."
                ],
              },
              "LEGO": {
                label: "LEGO Gift Card",
                url: "https://www.lego.com",
                steps: [
                  "Online: Shop to your heart's content on LEGO.com.",
                  "To redeem a LEGO Gift Card or LEGO e-Gift Card on LEGO.com, you'll need your card number and PIN code.",
                  "If you have a LEGO Gift Card, scratch off the silver foil on the back of the card to reveal the 4-digit PIN.",
                  "If you have a LEGO e-Gift Card, the PIN will be displayed along with the 19-digit Gift Card number.",
                  "At checkout, select \"Gift Card\" as the payment method, and enter the 19-digit Gift Card number and PIN code in the appropriate fields.",
                  "In-Store: Visit any LEGO Store and spend your Gift Card on anything there — including exclusive sets. Brick specialists are on hand to help you find the perfect purchase."
                ],
              },
              "Razer Gold": {
                label: "Razer Gold",
                url: "https://gold.razer.com/",
                steps: [
                  "Log in to your Razer Gold account using your Razer ID. If you don't have one, click \"Create Account\" to register.",
                  "Click on \"GOLD\" and then select \"Reload Now\".",
                  "Choose \"Razer Pin\" as your payment method.",
                  "Enter your PIN code in the designated field.",
                  "Click \"Next\" and complete the verification using the code sent to your mobile number."
                ],
              },
              "Uber": {
                label: "Uber / Uber Eats",
                url: "https://www.uber.com/",
                steps: [
                  "Open the Uber or Uber Eats app (make sure it's updated to the latest version).",
                  "Tap the menu icon → \"Wallet\" → \"Add Payment Method\" or \"Redeem Gift Card\".",
                  "Select \"Gift Card\" and enter your PIN or gift code (no spaces).",
                  "Tap \"Add\" — the credit will be applied to your Uber balance instantly.",
                  "Note: Once redeemed, gift card funds cannot be transferred. You can add multiple cards up to a $2,000 balance limit per account."
                ],
              },
              "Toyworld": {
                label: "Toyworld",
                url: "https://www.toyworld.com.au/",
                steps: [
                  "In-Store: Present your gift card (physical or digital) at any participating Toyworld store in Australia during checkout.",
                  "Online: Select the gift card option at the payment stage on the Toyworld website.",
                  "If your purchase exceeds the card's balance, you can pay the difference using another payment method.",
                  "Note: Valid for 36 months from date of issue. Non-refundable and cannot be exchanged for cash or used to buy other gift cards. Some store locations may be excluded."
                ],
              },
              "Toys R Us": {
                label: "Toys R Us",
                url: "https://toysrusmena.com/",
                steps: [
                  "Visit toysrusmena.com and redeem your voucher at checkout.",
                  "This eGift Card is redeemable for any merchandise at Toys R Us outlets.",
                  "Note: Valid for a one-time purchase to the full value only. Redeemable in Toys R Us stores. Expired cards cannot be extended, exchanged, or refunded."
                ],
              },
              "Burger King": {
                label: "Burger King",
                url: "https://www.burgerking.com/",
                steps: [
                  "Online: Visit the Burger King website, add items to your cart, and enter your gift card code in the \"Redeem Gift Card\" field at checkout.",
                  "Click \"Redeem\" — the gift card value will be deducted from your total.",
                  "In-Store: Print your eGift Card and present it to the cashier. They will scan the barcode or enter the code manually.",
                  "Note: If the store's eGift system is temporarily unavailable, the card can be used once it's back online. Not valid for certain promotional items and cannot be exchanged for cash."
                ],
              },
              "Primark": {
                label: "Primark",
                url: "https://www.primark.com/",
                steps: [
                  "Visit the Primark website and add your favorite items to the cart.",
                  "At checkout, select the gift card payment option and enter your code.",
                  "Note: The card has no expiration date before redemption. Once redeemed, the balance expires 2 years after last use."
                ],
              },
              "Pizza Hut": {
                label: "Pizza Hut",
                url: "https://buypizzahutcards.com/Giftcard",
                steps: [
                  "Visit buypizzahutcards.com or order through the Pizza Hut website/app.",
                  "Add your items to the cart and proceed to checkout.",
                  "Enter your gift card code in the payment section and apply it to your order."
                ],
              },
              "Riskiiit": {
                label: "Riskiiit",
                url: "https://riskiiit.com/",
                steps: [
                  "Go to riskiiit.com and log in or create an account.",
                  "Enter your redemption code to apply it to your account."
                ],
              },
              "Rewarble": {
                label: "Rewarble Gift Card",
                url: "https://rewarble.com/redeem",
                steps: [
                  "Go to rewarble.com/redeem.",
                  "Enter the email address you want linked to the redemption.",
                  "Enter your 16-digit Rewarble code exactly as shown, including any dashes.",
                  "Select \"Redeem Now\" to add the value to your Rewarble balance.",
                  "If prompted, complete identity verification, then choose the payout, product, or service you want to use the balance for.",
                ],
                notes: [
                  "Redeem only at rewarble.com — any other site asking for your code is a phishing attempt.",
                  "You don't have to use the whole balance at once; codes are typically valid for 12 months.",
                  "A fee may be deducted depending on which reward/payout option you choose, so check before confirming.",
                ],
              },
              "Ubisoft": {
                label: "Ubisoft Connect",
                url: "https://ubisoftconnect.com/",
                steps: [
                  "Go to ubisoftconnect.com and download the Ubisoft Connect client.",
                  "Install and launch the application, then log in with your account (or create one).",
                  "Click Settings → \"Activate Product\" and enter your code.",
                  "Follow the on-screen instructions to complete the activation."
                ],
              },
            };

            // Check title for brand-specific guides (e.g. "Just Eat" gift cards)
            const titleUpper = (productInfo.title || "").toUpperCase();
            const brandGuide = Object.keys(activationGuides).find((key) => titleUpper.includes(key.toUpperCase()));

            // Try brand from title first, then platform, then store as fallback
            const guide = (brandGuide ? activationGuides[brandGuide] : null)
              || (productInfo.platform ? activationGuides[productInfo.platform] : null)
              || (productInfo.store ? activationGuides[productInfo.store] : null);

            if (!guide) {
              return (
                <p className="text-muted-foreground text-sm">
                  Activation instructions are not yet available for this platform.
                </p>
              );
            }

            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Follow these steps to activate your <span className="text-foreground font-semibold">{guide.label}</span> key:
                </p>
                <ol className="space-y-2">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="text-sm text-muted-foreground pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
                <a
                  href={guide.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-display font-semibold text-primary hover:underline mt-2"
                >
                  Open {guide.label} Redemption Page →
                </a>
                {guide.notes && guide.notes.length > 0 && (
                  <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-xs font-display font-bold uppercase tracking-wider text-primary mb-2">
                      Important activation notes
                    </p>
                    <ul className="space-y-1.5 list-disc pl-5">
                      {guide.notes.map((n, i) => (
                        <li key={i} className="text-sm text-muted-foreground">{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
        </motion.div>
        )}
        {productInfo.allowed_product_id && (
          <ProductReviews
            productId={productInfo.allowed_product_id}
            productTitle={productInfo.title}
            stats={ratingStats}
          />
        )}
        {productInfo && (
          <FrequentlyBoughtTogether
            productTitle={productInfo.title}
            platform={productInfo.platform}
            currentProductId={productInfo.allowed_product_id}
          />
        )}
      </div>

      <Footer />

      {/* Lightbox Modal */}
      {lightboxIndex !== null && productInfo && (() => {
        const galleryImages: string[] = [];
        if (productInfo.screenshots?.length) {
          for (const s of productInfo.screenshots) {
            if (s && s !== productInfo.image_url) {
              galleryImages.push(s);
            }
          }
        }
        if (galleryImages.length === 0 || !galleryImages[lightboxIndex]) return null;
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setLightboxIndex(null)}
          >
            <button
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
              onClick={() => setLightboxIndex(null)}
            >
              <X className="h-6 w-6" />
            </button>
            {lightboxIndex > 0 && (
              <button
                className="absolute left-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
            )}
            {lightboxIndex < galleryImages.length - 1 && (
              <button
                className="absolute right-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            )}
            <img
              src={galleryImages[lightboxIndex]}
              alt=""
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 text-white/70 text-sm">
              {lightboxIndex + 1} / {galleryImages.length}
            </div>
          </div>
        );
      })()}
      {/* Admin Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">Edit Product</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-platform">Platform</Label>
              <Select value={editPlatform} onValueChange={setEditPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORM_CATEGORIES.map(p => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-store">Store</Label>
              <Select value={editStore} onValueChange={setEditStore}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getSubPlatforms(editPlatform).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-region">Region</Label>
              <Select value={editRegion} onValueChange={setEditRegion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_REGIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-price">Price ($)</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                min="0"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />
            </div>
            {!isNoTypeProduct({ store: editStore }) && (
              <div className="space-y-2">
                <Label>Product Type</Label>
                <Select value={editProductType} onValueChange={setEditProductType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Game","Subscription","Top Up","Edition","Season Pass","Expansion","DLC","Skin","Currency","Bundle","Game + Bonus","PRE ORDER BONUS"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-image">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-image"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="https://... or upload"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" disabled={uploadingImage} asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-1" />
                    {uploadingImage ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        if (!file.type.startsWith("image/")) {
                          toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
                          return;
                        }
                        if (file.size > 10 * 1024 * 1024) {
                          toast({ title: "File too large", description: "Maximum 10MB.", variant: "destructive" });
                          return;
                        }
                        setUploadingImage(true);
                        try {
                          const ext = file.name.split(".").pop() || "jpg";
                          const path = `product-edits/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                          const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false });
                          if (upErr) throw upErr;
                          const { data } = supabase.storage.from("product-images").getPublicUrl(path);
                          setEditImageUrl(data.publicUrl);
                          toast({ title: "Image uploaded" });
                        } catch (err: any) {
                          toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                        } finally {
                          setUploadingImage(false);
                        }
                      }}
                    />
                  </label>
                </Button>
              </div>
              {editImageUrl && (
                <img src={editImageUrl} alt="Preview" className="mt-2 max-h-32 rounded border border-border object-contain bg-muted" />
              )}
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Badges / Tags</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 border border-input rounded-md bg-background">
                {editBadges.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30">
                    {b}
                    <button onClick={() => setEditBadges(editBadges.filter((x) => x !== b))} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {editBadges.length === 0 && <span className="text-xs text-muted-foreground">No badges</span>}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newBadge}
                  onChange={(e) => setNewBadge(e.target.value)}
                  placeholder="Add custom badge..."
                  className="flex-1 h-8 text-xs"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newBadge.trim() && !editBadges.includes(newBadge.trim())) { setEditBadges([...editBadges, newBadge.trim()]); setNewBadge(""); } } }}
                />
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => { if (newBadge.trim() && !editBadges.includes(newBadge.trim())) { setEditBadges([...editBadges, newBadge.trim()]); setNewBadge(""); } }} disabled={!newBadge.trim()}>
                  +
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {COMMON_BADGES.filter((b) => !editBadges.includes(b)).slice(0, 12).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setEditBadges([...editBadges, b])}
                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    + {b}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button
              disabled={saving}
              onClick={async () => {
                if (!productInfo?.allowed_product_id) return;
                setSaving(true);
                  try {
                    const { error: apError } = await supabase
                      .from("allowed_products")
                      .update({
                        title: editTitle.trim(),
                        description: editDescription.trim() || null,
                        platform: editPlatform,
                        store: editStore,
                        region: editRegion,
                        image_url: editImageUrl.trim() || null,
                        badges: editBadges,
                        product_type: isNoTypeProduct({ store: editStore }) ? null : editProductType,
                      })
                      .eq("id", productInfo.allowed_product_id);
                    if (apError) throw apError;

                  const newPrice = parseFloat(editPrice);
                  if (!isNaN(newPrice) && newPrice > 0 && kinguinOffer) {
                    await supabase
                      .from("kinguin_products")
                      .update({ sell_price: newPrice })
                      .eq("allowed_product_id", productInfo.allowed_product_id);
                  }

                  toast({ title: "Product updated" });
                  setEditModalOpen(false);
                  fetchProductData();
                } catch (err: any) {
                  toast({ title: "Save failed", description: err.message, variant: "destructive" });
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    <RegionWarningDialog
      open={showRegionWarning}
      onOpenChange={setShowRegionWarning}
      productRegion={productRegion}
      userCountry={userCountry || ""}
      onConfirm={() => {
        setShowRegionWarning(false);
        const action = pendingRegionActionRef.current;
        pendingRegionActionRef.current = null;
        if (action) {
          // Defer so the dialog can unmount before navigation/state updates
          setTimeout(action, 0);
        }
      }}
    />
    </>
  );
};

export default ProductDetail;
