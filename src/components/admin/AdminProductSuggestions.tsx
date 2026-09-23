import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Clock, Flame, Trash2, ChevronLeft, ChevronRight, Sparkles, Calendar, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { usePlatformCategories } from "@/hooks/usePlatformCategories";
import { classifyGameItem, ITEM_TYPE_LABELS, ITEM_TYPE_COLORS } from "@/lib/gameItemClassifier";
import { pushImportQueueItem, updateImportQueueItem } from "@/lib/importQueueStore";

interface Suggestion {
  id: string;
  kinguin_product_id: string;
  title: string;
  platform: string | null;
  store: string | null;
  region: string | null;
  image_url: string | null;
  kinguin_price: number | null;
  release_date: string | null;
  category: string;
  status: string;
  admin_note: string | null;
  discovered_at: string;
  metadata: any;
}

const ITEMS_PER_PAGE = 24;

/**
 * Tab categories synced with the main store category tabs (StorePage.tsx).
 * Each tab has a matcher that classifies a suggestion the same way the live store does.
 */
type TabKey =
  | "all"
  | "games"
  | "dlc"
  | "editions"
  | "currency"
  | "skins"
  | "subscriptions"
  | "topups"
  | "giftcards"
  | "preorder";

const TAB_LABELS: Record<TabKey, string> = {
  all: "All",
  games: "Games",
  dlc: "DLC",
  editions: "Editions",
  currency: "Currency",
  skins: "Skins",
  subscriptions: "Subscriptions",
  topups: "Top Ups",
  giftcards: "Gift Cards",
  preorder: "Pre-Order",
};

const TAB_ORDER: TabKey[] = [
  "all",
  "games",
  "dlc",
  "editions",
  "currency",
  "skins",
  "subscriptions",
  "topups",
  "giftcards",
  "preorder",
];

// Broad gift-card / prepaid detector. Matches titles that don't contain the
// literal "gift card" phrase (PSN Card, Xbox Live, Steam Wallet, eShop, etc.).
const GIFT_CARD_RE = /\b(gift ?card|psn card|playstation (store|network|plus)|ps plus|ps now|xbox (live|gift|game pass)|game pass|nintendo (eshop|prepaid|online|switch online)|eshop|steam (wallet|gift)|itunes|app store|apple (gift|card)|google play|amazon\s?(gift|card)|razer gold|netflix|spotify|roblox( gift)?|minecoins|karma koin|paysafe(card)?|neosurf|blizzard balance|battle\.?net balance|wolt|zalando|deliveroo|paypal (gift|card)|skrill|prepaid|voucher|wallet|top.?up card|mol points)\b/i;

const isGiftCardTitle = (title: string, store: string | null): boolean => {
  if (store === "Gift Cards") return true;
  const lower = (title || "").toLowerCase();
  // EXCLUSION: If it contains "steam" AND "gift card" but NOT "wallet" or "top up",
  // and the classifier sees it as a game, we might want to be more careful.
  // However, the user says "Steam Gift Card" in title causes Top Up classification.
  return GIFT_CARD_RE.test(title || "");
};

const matchesTab = (s: { title: string; store: string | null; category: string; metadata: any }, tab: TabKey): boolean => {
  if (tab === "all") return true;

  const title = s.title || "";
  const isPreorder =
    s.category === "pre_order" ||
    s.metadata?.is_preorder ||
    /\bpre[\s-]?order\b/i.test(title);
  const isGiftCard = isGiftCardTitle(title, s.store);
  const isSubscription =
    /subscription|\b\d+\s*(day|month|year)s?\b/i.test(title) ||
    s.store === "Subscriptions";
  const isTopUp = s.store === "Top Ups" || /\btop[\s-]?up\b/i.test(title);
  const itemType = classifyGameItem(title);

  switch (tab) {
    case "preorder":
      return isPreorder;
    case "giftcards":
      return isGiftCard;
    case "subscriptions":
      return isSubscription && !isGiftCard;
    case "topups":
      return isTopUp && !isGiftCard && !isSubscription;
    case "dlc":
      return itemType === "dlc" && !isPreorder && !isGiftCard;
    case "editions":
      return itemType === "edition" && !isPreorder && !isGiftCard;
    case "currency":
      return itemType === "currency" && !isGiftCard;
    case "skins":
      return itemType === "skin" && !isGiftCard;
    case "games":
      return (
        itemType === "base" &&
        !isPreorder &&
        !isGiftCard &&
        !isSubscription &&
        !isTopUp
      );
    default:
      return true;
  }
};

/**
 * Derives the correct category (Games/DLC/Edition/etc.) from title, store and metadata,
 * so the third dropdown is filled automatically instead of manually per product.
 */
const deriveCategory = (s: { title: string; store: string | null; metadata: any }): string => {
  const title = s.title || "";
  const isPreorder =
    s.metadata?.is_preorder || /\bpre[\s-]?order\b/i.test(title);
  if (isGiftCardTitle(title, s.store)) return "giftcards";
  const isSubscription =
    /subscription|\b\d+\s*(day|month|year)s?\b/i.test(title) ||
    s.store === "Subscriptions";
  if (isSubscription) return "subscriptions";
  if (s.store === "Top Ups" || /\btop[\s-]?up\b/i.test(title)) return "topups";
  // Known in-game currency brands (Valorant Points, Riot Points, League RP, etc.)
  // Titles typically follow "VALORANT <ISO> <AMOUNT> CD Key <REGION>" with no
  // explicit "POINTS" keyword, so we short-circuit them to Currency here.
  if (/^\s*(valorant|riot|league of legends|lol\b|wild rift)\b/i.test(title)) {
    return "currency";
  }
  const itemType = classifyGameItem(title);
  // Points / V-Bucks / Coins etc. — classify as In-Game Items (currency),
  // even for pre-orders (pre-order status is orthogonal to item type).
  if (itemType === "currency") return "currency";
  if (itemType === "dlc") return "dlc";
  if (itemType === "edition") return "editions";
  if (itemType === "skin") return "skins";
  if (isPreorder) return "pre_order";
  return "games";
};

/**
 * Derives the sub-platform (second dropdown / `store`) from the platform + derived category.
 * For platforms whose nav sub-items are category-shaped (PlayStation / Xbox / Nintendo:
 * Games / DLC / Subscriptions / Top Ups), we can auto-fill the second dropdown
 * so admins don't have to set it manually per product.
 */
const deriveStore = (
  platform: string | null,
  category: string,
  subs: string[],
): string | null => {
  if (!platform || !subs || subs.length === 0) return null;
  const map: Record<string, string> = {
    games: "Games",
    dlc: "DLC",
    editions: "Games",
    currency: "Top Ups",
    skins: "Games",
    subscriptions: "Subscriptions",
    topups: "Top Ups",
    giftcards: "Gift Cards",
    pre_order: "Games",
  };
  const candidate = map[category];
  if (candidate && subs.includes(candidate)) return candidate;
  return null;
};

/**
 * Platforms whose sub-menu items ARE the type (Games / DLC / Subscriptions / Top Ups).
 * For these, the second dropdown already describes the category, so the third
 * "Type" dropdown is redundant and hidden.
 */
const CATEGORY_SUB_PLATFORMS = new Set(["PlayStation", "Xbox", "Nintendo"]);

/**
 * Brand-based routing rules for prepaid / top-up / in-game brands.
 * Returns the exact platform (1st dropdown), sub-platform (2nd) and
 * category (3rd) so these products are classified automatically.
 */
const deriveBrandRouting = (
  title: string,
): { platform: string; store: string; category: string } | null => {
  const t = title || "";
  // Roblox → In-Game Items
  if (/\broblox\b/i.test(t)) {
    return { platform: "In-Game Items", store: "In-Game Items", category: "currency" };
  }
  // Razer Gold → Gift Cards
  if (/\brazer\s*gold\b/i.test(t)) {
    return { platform: "Gift Cards", store: "Gift Cards", category: "giftcards" };
  }
  // Nintendo eShop / prepaid → Nintendo / Top Ups
  if (/\bnintendo\b|\beshop\b/i.test(t)) {
    return { platform: "Nintendo", store: "Top Ups", category: "topups" };
  }
  // Steam Wallet/Top Ups → PC / Steam / Top Ups
  // ONLY if it explicitly mentions "wallet", "top up", "prepaid" or "card" (without being a game gift)
  if (/\bsteam\b.*\b(wallet|top.?up|prepaid)\b|\b(wallet|top.?up|prepaid)\b.*\bsteam\b/i.test(t)) {
    return { platform: "PC", store: "Steam", category: "topups" };
  }
  // PlayStation / PSN wallet cards → PlayStation / Top Ups
  if (/\b(playstation|psn|ps ?[45]\b)/i.test(t) && /\b(card|wallet|gift ?card|top.?up|store)\b/i.test(t)) {
    return { platform: "PlayStation", store: "Top Ups", category: "topups" };
  }
  // Xbox prepaid / gift cards → Xbox / Top Ups
  if (/\bxbox\b/i.test(t) && /\b(card|wallet|gift ?card|top.?up|live)\b/i.test(t)) {
    return { platform: "Xbox", store: "Top Ups", category: "topups" };
  }
  // Anti-Virus brands → Software / Anti-Virus
  if (/\b(antivirus|anti-virus|bitdefender|kaspersky|norton|avast|eset|mcafee|malwarebytes)\b/i.test(t)) {
    return { platform: "Software", store: "Anti-Virus", category: "games" };
  }
  // Microsoft Office → Software / Office
  if (/\boffice\b/i.test(t) && /\b(microsoft|ms|pro|professional|home|student|plus|standard|2016|2019|2021|2024|365)\b/i.test(t)) {
    return { platform: "Software", store: "Office", category: "games" };
  }
  return null;
};

/** Reverse of deriveStore for CATEGORY_SUB_PLATFORMS — infer category from the sub-platform label. */
const categoryFromStore = (store: string | null): string | null => {
  switch (store) {
    case "Games": return "games";
    case "DLC": return "dlc";
    case "Subscriptions": return "subscriptions";
    case "Top Ups": return "topups";
    default: return null;
  }
};

const AdminProductSuggestions = () => {
  const { categories: PLATFORM_CATEGORIES_DYN, getSubPlatforms } = usePlatformCategories();
  const PLATFORM_OPTIONS = PLATFORM_CATEGORIES_DYN.map((c) => c.name);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [tab, setTab] = useState<TabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPlatform, setBulkPlatform] = useState("");
  const [bulkStore, setBulkStore] = useState("");
  const [page, setPage] = useState(1);
  const [scanLimit, setScanLimit] = useState<number>(100);
  const [importingPopular, setImportingPopular] = useState(false);
  const [importingAll, setImportingAll] = useState(false);
  const [importAllProgress, setImportAllProgress] = useState({ done: 0, total: 0 });
  const stopAllRef = useRef(false);
  // Serial queue so rapid Approve clicks don't race the edge function or the DB.
  const approveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const upsertQueue = updateImportQueueItem;

  const fetchSuggestions = async () => {
    setLoading(true);
    setSelectedIds(new Set());
    const allData: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("kinguin_product_suggestions")
        .select("*")
        .eq("status", filter)
        .order("discovered_at", { ascending: false })
        .range(from, from + 999);
      if (error) { toast.error(error.message); break; }
      if (!data || data.length === 0) break;
      allData.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
    // Auto-fill category (third dropdown) AND store (second dropdown / sub-platform)
    // for rows where the DB value doesn't match the derived one.
    const catGroups: Record<string, string[]> = {};
    const storeGroups: Record<string, string[]> = {};
    const platformGroups: Record<string, string[]> = {};
    for (const row of allData) {
      // Skip auto-derivation for rows an admin has explicitly edited — their
      // manual category / store / platform picks must persist across reloads.
      if (row.admin_edited) continue;
      // Brand routing takes precedence over generic derivation.
      const brand = deriveBrandRouting(row.title || "");
      if (brand && PLATFORM_OPTIONS.includes(brand.platform)) {
        const brandSubs = getSubPlatforms(brand.platform);
        const brandStore = brandSubs.includes(brand.store) ? brand.store : (brandSubs[0] || brand.store);
        if (row.category !== brand.category) {
          (catGroups[brand.category] ||= []).push(row.id);
          row.category = brand.category;
        }
        if (row.platform !== brand.platform) {
          (platformGroups[brand.platform] ||= []).push(row.id);
          row.platform = brand.platform;
        }
        if (row.store !== brandStore) {
          (storeGroups[brandStore] ||= []).push(row.id);
          row.store = brandStore;
        }
        continue;
      }
      const derivedCat = deriveCategory(row);
      if (derivedCat && row.category !== derivedCat) {
        (catGroups[derivedCat] ||= []).push(row.id);
        row.category = derivedCat;
      }
      // Title-based platform override: "GOG" in title → PC / GOG
      if (/\bGOG\b/i.test(row.title || "") && PLATFORM_OPTIONS.includes("PC") && row.platform !== "PC") {
        (platformGroups["PC"] ||= []).push(row.id);
        row.platform = "PC";
      }
      // In-game currency (Valorant Points, Riot Points, V-Bucks etc.) should sit
      // under the "In-Game Items" platform, not PC / Console.
      if (row.category === "currency" && PLATFORM_OPTIONS.includes("In-Game Items") && row.platform !== "In-Game Items") {
        (platformGroups["In-Game Items"] ||= []).push(row.id);
        row.platform = "In-Game Items";
      }
      // Anti-Virus detection
      if (/\b(antivirus|anti-virus|bitdefender|kaspersky|norton|avast|eset|mcafee|malwarebytes)\b/i.test(row.title || "") && row.platform !== "Software") {
        (platformGroups["Software"] ||= []).push(row.id);
        row.platform = "Software";
      }
      if (row.platform) {
        const subs = getSubPlatforms(row.platform);
        // Title-based store overrides (e.g. "EA App" → EA Games on PC)
        const titleStr = row.title || "";
        let titleStore: string | null = null;
        if (/\bEA\s*App\b/i.test(titleStr) && subs.includes("EA Games")) {
          titleStore = "EA Games";
        }
        if (!titleStore && /\bGOG\b/i.test(titleStr) && subs.includes("GOG")) {
          titleStore = "GOG";
        }
        if (/\b(antivirus|anti-virus|bitdefender|kaspersky|norton|avast|eset|mcafee|malwarebytes)\b/i.test(titleStr) && subs.includes("Anti-Virus")) {
          titleStore = "Anti-Virus";
        }
        if (titleStore && titleStore !== row.store) {
          (storeGroups[titleStore] ||= []).push(row.id);
          row.store = titleStore;
          continue;
        }
        // For PS/Xbox/Nintendo, force store to match the derived category
        // (their sub-menu items ARE the type). For PC and others, only fill
        // when empty so we don't overwrite manual choices like Steam/Epic.
        const isCategorySub = CATEGORY_SUB_PLATFORMS.has(row.platform);
        const storeMatchesSub = row.store && subs.includes(row.store);
        if (isCategorySub || !storeMatchesSub) {
          const derivedStore = deriveStore(row.platform, row.category, subs);
          if (derivedStore && derivedStore !== row.store) {
            (storeGroups[derivedStore] ||= []).push(row.id);
            row.store = derivedStore;
          } else if (subs.length === 1 && row.store !== subs[0]) {
            (storeGroups[subs[0]] ||= []).push(row.id);
            row.store = subs[0];
          }
        }
      }
    }
    const updates: PromiseLike<any>[] = [];
    for (const [cat, ids] of Object.entries(catGroups)) {
      updates.push(
        supabase.from("kinguin_product_suggestions").update({ category: cat } as any).in("id", ids),
      );
    }
    for (const [store, ids] of Object.entries(storeGroups)) {
      updates.push(
        supabase.from("kinguin_product_suggestions").update({ store } as any).in("id", ids),
      );
    }
    for (const [platform, ids] of Object.entries(platformGroups)) {
      updates.push(
        supabase.from("kinguin_product_suggestions").update({ platform } as any).in("id", ids),
      );
    }
    if (updates.length) await Promise.all(updates);
    setSuggestions(allData);
    setLoading(false);
  };

  useEffect(() => { fetchSuggestions(); setPage(1); }, [filter]);

  const filtered = useMemo(() =>
    suggestions.filter(
      (s) =>
        (!searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase())) &&
        matchesTab(s, tab),
    ),
    [suggestions, searchQuery, tab],
  );

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = {
      all: 0, games: 0, dlc: 0, editions: 0, currency: 0,
      skins: 0, subscriptions: 0, topups: 0, giftcards: 0, preorder: 0,
    };
    for (const s of suggestions) {
      for (const k of TAB_ORDER) {
        if (matchesTab(s, k)) counts[k] += 1;
      }
    }
    return counts;
  }, [suggestions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [searchQuery, tab]);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("kinguin-discover", {
        body: { limit: scanLimit },
      });
      if (error) throw error;
      toast.success(`Scan complete (top ${data?.scan_limit || scanLimit}): ${data?.new_suggestions || 0} new products found`);
      fetchSuggestions();
    } catch (err: any) {
      toast.error("Scan failed: " + err.message);
    }
    setScanning(false);
  };

  const runImportPopular = async () => {
    if (importingPopular) return;
    if (!confirm("Import top 100 popular games (base games only). Runs in 10 batches of 10 and may take a few minutes.")) return;
    setImportingPopular(true);
    let totalImported = 0;
    let totalSkipped = 0;
    let totalNoMatch = 0;
    let totalErrors = 0;
    const BATCHES = 10;
    const PER_BATCH = 10;
    try {
      for (let i = 0; i < BATCHES; i++) {
        const startPage = i + 1;
        toast.message(`Batch ${i + 1}/${BATCHES}…`, { id: "import-popular", duration: 4000 });
        const { data, error } = await supabase.functions.invoke("import-popular-games", {
          body: { count: PER_BATCH, startPage },
        });
        if (error) {
          totalErrors++;
          console.error("batch failed", error);
          continue;
        }
        totalImported += data?.imported ?? 0;
        totalSkipped += data?.skipped_existing ?? 0;
        totalNoMatch += data?.no_kinguin_match ?? 0;
        totalErrors += data?.import_errors ?? 0;
        const errResults = (data?.results || []).filter((r: any) =>
          typeof r?.status === "string" && r.status.startsWith("import error"),
        );
        if (errResults.length) {
          console.group(`[import-popular] Batch ${i + 1} errors (${errResults.length})`);
          errResults.forEach((r: any) => console.error(r.title, "→", r.status, "pid:", r.kinguinProductId));
          console.groupEnd();
        }
      }
      toast.success(
        `Done: imported ${totalImported} · skipped ${totalSkipped} existing · ${totalNoMatch} not on Kinguin · ${totalErrors} errors`,
        { id: "import-popular", duration: 10000 },
      );
      if (totalErrors > 0) {
        toast.message(`See browser console for the ${totalErrors} error details (grouped by batch).`, { duration: 8000 });
      }
      fetchSuggestions();
    } catch (err: any) {
      toast.error("Popular import failed: " + (err?.message || "unknown"), { id: "import-popular" });
    }
    setImportingPopular(false);
  };

  const updateSuggestionPlatform = async (id: string, platform: string, store: string) => {
    await supabase
      .from("kinguin_product_suggestions")
      .update({ platform, store, admin_edited: true } as any)
      .eq("id", id);
    setSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, platform, store, admin_edited: true } as any : s));
  };

  const updateSuggestionCategory = async (id: string, category: string) => {
    await supabase
      .from("kinguin_product_suggestions")
      .update({ category, admin_edited: true } as any)
      .eq("id", id);
    setSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, category, admin_edited: true } as any : s));
  };

  const handleBulkPlatformUpdate = async () => {
    if (!bulkPlatform || selectedIds.size === 0) {
      toast.error("Select products and a platform first");
      return;
    }
    const store = bulkStore || bulkPlatform;
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("kinguin_product_suggestions")
      .update({ platform: bulkPlatform, store, admin_edited: true } as any)
      .in("id", ids);
    if (error) { toast.error(error.message); return; }
    setSuggestions((prev) => prev.map((s) => ids.includes(s.id) ? { ...s, platform: bulkPlatform, store, admin_edited: true } as any : s));
    toast.success(`Updated ${ids.length} products`);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paged.map((s) => s.id)));
    }
  };

  /**
   * The category the product MUST end up in: the admin's manual pick wins,
   * otherwise brand routing / derived category decide.
   */
  const expectedRouting = (s: Suggestion): { platform: string | null; store: string | null } => {
    const brand = deriveBrandRouting(s.title);
    const category = s.category || deriveCategory(s);
    const platform = s.platform || brand?.platform || (category === "giftcards" ? "Gift Cards" : null);
    const store =
      s.store ||
      brand?.store ||
      deriveStore(platform, category, platform ? getSubPlatforms(platform) : []) ||
      (category === "giftcards" ? "Gift Cards" : null);
    return { platform, store };
  };

  const handleApprove = async (s: Suggestion) => {
    // Optimistically remove from the list so rapid clicks don't shift rows
    // and cause the admin to accidentally click the wrong product.
    setSuggestions((prev) => prev.filter((item) => item.id !== s.id));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; });
    toast.loading(`Queued "${s.title}"…`, { id: `approve-${s.id}` });
    // Add to the visible side-panel queue so the admin can track progress
    // across many rapid Approve clicks.
    pushImportQueueItem({ id: s.id, title: s.title, image: s.image_url, status: "queued", source: "discover" });
    // Chain onto the serial queue so imports run one-at-a-time, no matter
    // how fast the admin clicks. Prevents concurrent edge-function calls
    // from racing on duplicate-detection and dropping products silently.
    const expected = expectedRouting(s);
    const run = approveQueueRef.current.then(async () => {
      toast.loading(`Importing "${s.title}"…`, { id: `approve-${s.id}` });
      upsertQueue(s.id, { status: "importing" });
      try {
      const { data, error } = await supabase.functions.invoke("kinguin-bulk-import", {
        body: {
          kinguinProductId: s.kinguin_product_id,
          query: s.title,
          maxPages: 1,
          // Honor the platform / sub-platform the admin selected in the suggestion row
          // so the imported product lands under the correct category (e.g. In-Game Items → Fortnite)
          // instead of being re-derived from the Kinguin title.
          platformOverride: expected.platform || undefined,
          storeOverride: expected.store || undefined,
        },
      });
      if (error) throw error;

      if (data?.unavailable) {
        toast.warning(`"${s.title}" is no longer available on Kinguin — removed from Discover`, { id: `approve-${s.id}` });
        upsertQueue(s.id, { status: "unavailable", message: "Removed from Kinguin catalog" });
        return;
      }

      const added = Number(data?.added ?? 0);
      const skipped = Number(data?.skipped ?? 0);
      const firstStatus: string = data?.results?.[0]?.status || "";
      const firstApId: string | undefined = data?.results?.[0]?.allowed_product_id;
      if (added + skipped === 0) {
        throw new Error(firstStatus || "Import returned no product");
      }
      if (/^(error|linked-error|blocked|unavailable)/i.test(firstStatus)) {
        throw new Error(firstStatus);
      }
      // Verify a real product row was created / linked. Without an allowed_product_id
      // the "success" is bogus (e.g. Kinguin returned an empty body) and we must NOT
      // mark the suggestion as approved — otherwise it disappears silently.
      if (!firstApId) {
        throw new Error(firstStatus ? `no product row created (${firstStatus})` : "no product row created");
      }
      // "duplicate" means the product ALREADY existed and was linked before —
      // nothing new was added. Warn the admin so they know it isn't a fresh import.
      const isDuplicate = added === 0 && /duplicate/i.test(firstStatus);

      // Verify the imported product really landed in the expected category,
      // and correct it in place if the importer derived something else.
      let categoryNote = "";
      if (expected.platform || expected.store) {
        const { data: apRow } = await supabase
          .from("allowed_products")
          .select("platform, store")
          .eq("id", firstApId)
          .maybeSingle();
        if (apRow) {
          const fix: { platform?: string; store?: string } = {};
          if (expected.platform && apRow.platform !== expected.platform) fix.platform = expected.platform;
          if (expected.store && apRow.store !== expected.store) fix.store = expected.store;
          if (Object.keys(fix).length > 0) {
            const { error: fixErr } = await supabase
              .from("allowed_products")
              .update(fix)
              .eq("id", firstApId);
            categoryNote = fixErr
              ? ` — category fix failed (${fixErr.message})`
              : ` — category corrected to ${expected.platform ?? apRow.platform} / ${expected.store ?? apRow.store}`;
          } else {
            categoryNote = ` — ${apRow.platform} / ${apRow.store}`;
          }
        }
      }

      await supabase
        .from("kinguin_product_suggestions")
        .update({ status: "approved", reviewed_at: new Date().toISOString() } as any)
        .eq("id", s.id);
      if (isDuplicate) {
        toast.warning(`"${s.title}" already existed — marked approved (not re-added)`, { id: `approve-${s.id}` });
        upsertQueue(s.id, { status: "duplicate", message: "Already existed" });
      } else {
        toast.success(`"${s.title}" approved and imported`, { id: `approve-${s.id}` });
        upsertQueue(s.id, { status: "success", message: "Imported" });
      }
      } catch (err: any) {
      toast.error(`Approve failed for "${s.title}": ` + err.message, { id: `approve-${s.id}` });
      upsertQueue(s.id, { status: "error", message: err?.message || "Failed" });
      // Put it back so the admin can retry.
      setSuggestions((prev) => (prev.some((i) => i.id === s.id) ? prev : [s, ...prev]));
      }
    });
    // Swallow errors on the shared chain so one failure doesn't stall the queue.
    approveQueueRef.current = run.catch(() => {});
    return run;
  };

  /** Approve + import every suggestion currently visible in this tab, one by one. */
  const handleApproveAll = async () => {
    const list = [...filtered];
    if (list.length === 0) return;
    if (!confirm(`Import all ${list.length} products in this tab? This runs one by one and may take a while — keep this page open.`)) return;
    stopAllRef.current = false;
    setImportingAll(true);
    let done = 0;
    for (const s of list) {
      if (stopAllRef.current) break;
      try { await handleApprove(s); } catch { /* handled inside */ }
      done++;
      setImportAllProgress({ done, total: list.length });
    }
    setImportingAll(false);
    toast.success(`Finished importing ${done} / ${list.length}`);
  };


  const handleReject = async (id: string) => {
    const removed = suggestions.find((s) => s.id === id);
    setSuggestions((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    const { error } = await supabase
      .from("kinguin_product_suggestions")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast.error("Reject failed: " + error.message);
      if (removed) setSuggestions((prev) => (prev.some((i) => i.id === id) ? prev : [removed, ...prev]));
    } else {
      toast.success("Rejected");
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("kinguin_product_suggestions").delete().eq("id", id);
    fetchSuggestions();
  };

  const bulkStoreOptions = bulkPlatform ? getSubPlatforms(bulkPlatform) : [];

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          {(["pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wide transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:bg-primary/20"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({filter === f ? filtered.length : "…"})
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 h-8 text-xs"
          />
          <Select value={String(scanLimit)} onValueChange={(v) => setScanLimit(parseInt(v, 10))}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Scan size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="100">Top 100</SelectItem>
              <SelectItem value="200">Top 200</SelectItem>
              <SelectItem value="500">Top 500 (wide)</SelectItem>
              <SelectItem value="1000">Top 1000 (max)</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={runScan} disabled={scanning} className="gap-1.5">
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {scanning ? "Scanning..." : `Scan Top ${scanLimit}`}
          </Button>
          <Button size="sm" variant="secondary" onClick={runImportPopular} disabled={importingPopular} className="gap-1.5">
            {importingPopular ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {importingPopular ? "Importing..." : "Import GG.deals Top 100"}
          </Button>
        </div>
      </div>

      {/* Category tabs (synced with main store category tabs) */}
      <div className="flex gap-1.5 flex-wrap border-b border-border pb-2">
        {TAB_ORDER.map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-display font-bold tracking-wide transition-all ${
              tab === k
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/40 text-muted-foreground hover:bg-primary/20"
            }`}
          >
            {TAB_LABELS[k]} ({tabCounts[k]})
          </button>
        ))}
      </div>

      {/* Bulk platform bar */}
      {filter === "pending" && (
        <div className="flex items-center gap-2 flex-wrap bg-secondary/30 rounded-lg p-2.5 border border-border">
          <Checkbox
            checked={paged.length > 0 && selectedIds.size === paged.length}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
          <Select value={bulkPlatform} onValueChange={(v) => { setBulkPlatform(v); setBulkStore(""); }}>
            <SelectTrigger className="w-32 h-7 text-[10px]"><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bulkStore} onValueChange={setBulkStore}>
            <SelectTrigger className="w-36 h-7 text-[10px]"><SelectValue placeholder="Sub-platform" /></SelectTrigger>
            <SelectContent>
              {bulkStoreOptions.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-[10px]" onClick={handleBulkPlatformUpdate} disabled={selectedIds.size === 0 || !bulkPlatform}>
            Apply to {selectedIds.size}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {importingAll && (
              <span className="text-[10px] text-muted-foreground">
                {importAllProgress.done} / {importAllProgress.total}
              </span>
            )}
            {importingAll ? (
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-[10px] gap-1"
                onClick={() => { stopAllRef.current = true; }}
              >
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-[10px] gap-1"
                onClick={handleApproveAll}
                disabled={filtered.length === 0}
              >
                <Download className="h-3 w-3" />
                Import All ({filtered.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No {filter} suggestions found</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {paged.map((s) => {
              const isProcessing = processingIds.has(s.id);
              const storeOptions = s.platform ? getSubPlatforms(s.platform) : [];
              return (
                <div key={s.id} className={`border rounded-lg bg-secondary/20 overflow-hidden ${selectedIds.has(s.id) ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                  <div className="relative">
                    {filter === "pending" && (
                      <div className="absolute top-1.5 left-1.5 z-10">
                        <Checkbox
                          checked={selectedIds.has(s.id)}
                          onCheckedChange={() => toggleSelect(s.id)}
                          className="bg-background/80 backdrop-blur-sm"
                        />
                      </div>
                    )}
                    {s.image_url ? (
                      <a
                        href={`https://www.kinguin.net/category/${s.kinguin_product_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open on Kinguin"
                      >
                        <img src={s.image_url} alt={s.title} className="w-full h-36 object-cover hover:opacity-80 transition-opacity cursor-pointer" loading="lazy" />
                      </a>
                    ) : (
                      <a
                        href={`https://www.kinguin.net/category/${s.kinguin_product_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full h-36 bg-muted flex items-center justify-center text-muted-foreground text-xs hover:bg-muted/70 transition-colors"
                      >
                        No Image
                      </a>
                    )}
                    {/valid\s+(until|till|through)/i.test(s.title) && (
                      <span className="absolute top-1.5 right-1.5 bg-red-600 text-white text-sm font-black px-2.5 py-1 rounded shadow-lg border border-red-400 animate-pulse">EXP</span>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-start gap-1.5">
                      {(s.category === "pre_order" || s.metadata?.is_preorder || /\bpre[\s-]?order\b/i.test(s.title)) ? (
                        <Clock className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      ) : (
                        <Flame className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      )}
                      <a
                        href={`https://www.kinguin.net/category/${s.kinguin_product_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-display font-bold text-foreground leading-tight line-clamp-2 hover:text-primary transition-colors"
                      >
                        {s.title}
                      </a>
                    </div>

                    {/* Status badges (PRE-ORDER / NEW / Year) */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {(s.category === "pre_order" || s.metadata?.is_preorder || /\bpre[\s-]?order\b/i.test(s.title)) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-400 bg-amber-500/10">
                          <Clock className="h-2.5 w-2.5 mr-0.5" />PRE-ORDER
                        </Badge>
                      )}
                      {s.metadata?.is_new && !s.metadata?.is_preorder && s.category !== "pre_order" && !/\bpre[\s-]?order\b/i.test(s.title) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" />NEW
                        </Badge>
                      )}
                      {(() => {
                        const itemType = classifyGameItem(s.title);
                        if (itemType === "base") return null;
                        return (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ITEM_TYPE_COLORS[itemType]}`}>
                            {ITEM_TYPE_LABELS[itemType].toUpperCase()}
                          </Badge>
                        );
                      })()}
                      {/valid\s+(until|till|through)|expires?\s+(on|at)/i.test(s.title) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/50 text-red-400 bg-red-500/10">
                          EXP
                        </Badge>
                      )}
                      {/gift\s*card/i.test(s.title) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-500/50 text-cyan-400 bg-cyan-500/10">
                          GIFT CARD
                        </Badge>
                      )}
                      {/subscription|\b\d+\s*(day|month|year)s?\b/i.test(s.title) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-indigo-500/50 text-indigo-400 bg-indigo-500/10">
                          SUB
                        </Badge>
                      )}
                      {s.release_date && !isNaN(new Date(s.release_date).getTime()) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground">
                          <Calendar className="h-2.5 w-2.5 mr-0.5" />{new Date(s.release_date).getFullYear()}
                        </Badge>
                      )}
                    </div>

                    {/* Platform & Store display + edit */}
                    <div className="flex gap-1.5">
                      <Select
                        value={s.platform || ""}
                        onValueChange={(v) => updateSuggestionPlatform(s.id, v, getSubPlatforms(v)[0] || v)}
                      >
                        <SelectTrigger className="h-6 text-[10px] flex-1 min-w-0">
                          <SelectValue placeholder="Platform" />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORM_OPTIONS.map((p) => (
                            <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={s.store || ""}
                        onValueChange={async (v) => {
                          await updateSuggestionPlatform(s.id, s.platform || "PC", v);
                          // For PS/Xbox/Nintendo the sub-platform IS the type,
                          // so keep `category` in sync automatically.
                          if (s.platform && CATEGORY_SUB_PLATFORMS.has(s.platform)) {
                            const cat = categoryFromStore(v);
                            if (cat && cat !== s.category) await updateSuggestionCategory(s.id, cat);
                          }
                        }}
                      >
                        <SelectTrigger className="h-6 text-[10px] flex-1 min-w-0">
                          <SelectValue placeholder="Store" />
                        </SelectTrigger>
                        <SelectContent>
                          {storeOptions.map((st) => (
                            <SelectItem key={st} value={st} className="text-xs">{st}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Type (tab category) selector — shown only for PC, where the sub-platform
                        is a store (Steam/Epic/etc.) and doesn't imply the type. On PS/Xbox/Nintendo
                        the sub-platform already mirrors the type axis. */}
                    {s.platform === "PC" && (
                    <div className="flex gap-1.5">
                      <Select
                        value={s.category || "games"}
                        onValueChange={(v) => updateSuggestionCategory(s.id, v)}
                      >
                        <SelectTrigger className="h-6 text-[10px] flex-1 min-w-0">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="games" className="text-xs">Game</SelectItem>
                          <SelectItem value="dlc" className="text-xs">DLC</SelectItem>
                          <SelectItem value="editions" className="text-xs">Edition</SelectItem>
                          <SelectItem value="currency" className="text-xs">Currency</SelectItem>
                          <SelectItem value="skins" className="text-xs">Skin</SelectItem>
                          <SelectItem value="subscriptions" className="text-xs">Subscription</SelectItem>
                          <SelectItem value="topups" className="text-xs">Top Up</SelectItem>
                          <SelectItem value="giftcards" className="text-xs">Gift Card</SelectItem>
                          <SelectItem value="pre_order" className="text-xs">Pre-Order</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    )}

                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {s.kinguin_price && (
                        <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-bold">
                          €{s.kinguin_price.toFixed(2)}
                        </span>
                      )}
                      {s.release_date && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">
                          {s.release_date}
                        </span>
                      )}
                      {s.metadata?.qty != null && (
                        <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold">
                          Stock: {s.metadata.qty}
                        </span>
                      )}
                    </div>

                    {filter === "pending" && (
                      <div className="flex gap-1.5 pt-1">
                        <Button size="sm" onClick={() => handleApprove(s)} disabled={isProcessing} className="flex-1 h-7 text-[10px] gap-1">
                          {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(s.id)} disabled={isProcessing} className="flex-1 h-7 text-[10px] gap-1">
                          <XCircle className="h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {filter === "rejected" && (
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)} className="w-full h-7 text-[10px] gap-1 text-destructive">
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (currentPage <= 4) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = currentPage - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`h-7 w-7 rounded text-xs font-bold transition-all ${
                        pageNum === currentPage
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/60 text-muted-foreground hover:bg-primary/20"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] text-muted-foreground ml-2">
                {filtered.length} total
              </span>
            </div>
          )}
        </>
      )}

    </div>
  );
};

export default AdminProductSuggestions;
