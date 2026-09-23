import { useEffect, useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNoIndex } from "@/hooks/useNoIndex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { KinguinManager } from "@/components/admin/KinguinManager";
import { kinguinBuyPrice } from "@/lib/kinguinMarkup";
import { logAuditEvent } from "@/lib/auditLog";
import { isNoTypeProduct } from "@/lib/gameItemClassifier";
import { FakeSellerGenerator } from "@/components/admin/FakeSellerGenerator";
import AdminTickets from "@/components/admin/AdminTickets";
import AdminChatAttachments from "@/components/admin/AdminChatAttachments";
import AdminNavButtons from "@/components/admin/AdminNavButtons";
import AdminManualKeys from "@/components/admin/AdminManualKeys";
import AdminWithdrawals from "@/components/admin/AdminWithdrawals";
import AdminFraudDashboard from "@/components/admin/AdminFraudDashboard";
import AdminCollections from "@/components/admin/AdminCollections";
import AdminPricing from "@/components/admin/AdminPricing";
import AdminPriceComparison from "@/components/admin/AdminPriceComparison";
import AdminNewsletter from "@/components/admin/AdminNewsletter";
import AdminGameGroups from "@/components/admin/AdminGameGroups";
import AdminOrders from "@/components/admin/AdminOrders";
import AdminNavMenu from "@/components/admin/AdminNavMenu";
import AgeverBot from "@/components/admin/AgeverBot";
import AliExpressManager from "@/components/admin/AliExpressManager";
import AdminProductSuggestions from "@/components/admin/AdminProductSuggestions";
import AdminDiscountCodes from "@/components/admin/AdminDiscountCodes";
import AdminBusinessPortal from "@/components/admin/AdminBusinessPortal";
import AdminSocialPosts from "@/components/admin/AdminSocialPosts";
import AdminSearchLogs from "@/components/admin/AdminSearchLogs";
import AdminSEOGenerator from "@/components/admin/AdminSEOGenerator";
import AdminDailyDeals from "@/components/admin/AdminDailyDeals";
import AdminAuditLog from "@/components/admin/AdminAuditLog";
import AdminOverpricedCards from "@/components/admin/AdminOverpricedCards";
import AdminBundles from "@/components/admin/AdminBundles";
import AdminRateLimiting from "@/components/admin/AdminRateLimiting";
import AdminGuides from "@/components/admin/AdminGuides";
import AdminNews from "@/components/admin/AdminNews";
import AdminIndexNow from "@/components/admin/AdminIndexNow";

import AdminKinguinSync from "@/components/admin/AdminKinguinSync";
import AdminTitleReformatter from "@/components/admin/AdminTitleReformatter";
import AdminGiveaways from "@/components/admin/AdminGiveaways";
import AdminReceiptsSettings from "@/components/admin/AdminReceiptsSettings";
import AdminSyncCenter from "@/components/admin/AdminSyncCenter";
import { ParaphraseQueuePanel, paraphraseQueue } from "@/components/admin/ParaphraseQueue";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import AdminFreeGiftSettings from "@/components/admin/AdminFreeGiftSettings";
import AdminFunctionHealth from "@/components/admin/AdminFunctionHealth";
import AdminEmailProvider from "@/components/admin/AdminEmailProvider";
import AdminEmailLogs from "@/components/admin/AdminEmailLogs";
import AdminMarketingEmails from "@/components/admin/AdminMarketingEmails";
import AdminTrendingResearch from "@/components/admin/AdminTrendingResearch";
import AdminGamePlays from "@/components/admin/AdminGamePlays";
import AdminCustomerSuggestions from "@/components/admin/AdminCustomerSuggestions";
import AdminPendingPayPalOrders from "@/components/admin/AdminPendingPayPalOrders";
import {
  Shield,
  Trash2,
  Plus,
  Package,
  Pencil,
  Inbox,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Crown,
  Loader2,
  X,
  MessageSquare,
  Key,
  Search,
  ChevronLeft,
  ChevronRight,
  Unlink,
  ExternalLink,
  Power,
  Wand2,
  Layers,
  Download,
  Upload,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { usePlatformCategories } from "@/hooks/usePlatformCategories";
import { ALL_REGIONS } from "@/lib/regions";

const PRODUCT_TYPES = ["Game", "Subscription", "Top Up", "Edition", "Season Pass", "Expansion", "DLC", "Skin", "Currency", "Bundle", "Game + Bonus", "PRE ORDER BONUS"];

const AdminSection = () => {
  useNoIndex();
  const { subPlatformMap: SUB_PLATFORM_MAP, getSubPlatforms } = usePlatformCategories();
  const { section } = useParams<{section: string;}>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Products state
  const [allowedProducts, setAllowedProducts] = useState<{id: string;title: string;platform: string;store: string;region: string;image_url: string | null;description: string | null;description_paraphrased: boolean;product_type?: string | null;original_title?: string | null;platform_details?: string | null;}[]>([]);
  const [newProductTitle, setNewProductTitle] = useState("");
  const [newProductPlatform, setNewProductPlatform] = useState("PC");
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newProductDescription, setNewProductDescription] = useState("");
  const [newProductRegion, setNewProductRegion] = useState("Global");
  const [newProductStore, setNewProductStore] = useState("Steam");
  const [newProductType, setNewProductType] = useState("Game");
  const [addingProduct, setAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<{id: string;title: string;platform: string;store: string;region: string;image_url: string | null;description: string | null;sell_price?: number;kinguin_product_id?: string;product_type?: string;} | null>(null);
  const [editProductImage, setEditProductImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Kinguin-linked allowed product IDs with full data
  interface KinguinLinkData {
    id: string;
    kinguin_product_id: string;
    kinguin_price: number | null;
    sell_price: number;
    is_active: boolean;
    kinguin_stock: number | null;
    last_stock_check: string | null;
    last_webhook_update: string | null;
    last_change_summary: string | null;
    last_change_at: string | null;
    last_change_source: string | null;
  }
  const [kinguinLinkedApIds, setKinguinLinkedApIds] = useState<Record<string, KinguinLinkData>>({});
  // Products with manual keys and their counts
  const [manualKeyApIds, setManualKeyApIds] = useState<Record<string, number>>({});

  // Manual keys dialog state
  const [manualKeysProduct, setManualKeysProduct] = useState<{ id: string; title: string } | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchStopping, setBatchStopping] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ processed: number; total: number; status: string } | null>(null);
  const [bulkPlatform, setBulkPlatform] = useState("PC");
  const [bulkStore, setBulkStore] = useState("Steam");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Search, filter & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterStore, setFilterStore] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  // Sort/filter by last update source (webhook vs cron)
  // "none" | "webhook_newest" | "webhook_oldest" | "cron_newest" | "never_webhook"
  const [updateSort, setUpdateSort] = useState<string>("none");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const ITEMS_PER_PAGE = itemsPerPage;
  const [totalCount, setTotalCount] = useState(0);
  const [productsLoading, setProductsLoading] = useState(false);
  const [paraphrasingId, setParaphrasingId] = useState<string | null>(null);
  // Expiring products (next 30 days or already expired)
  const [expiringProducts, setExpiringProducts] = useState<{id: string; title: string; expiration_date: string;}[]>([]);
  const [autoParaphrase, setAutoParaphrase] = useState<{ running: boolean; done: number; total: number; stop: boolean }>({ running: false, done: 0, total: 0, stop: false });
  const autoStopRef = { current: false };

  const runAutoParaphrasePage = async () => {
    const targets = allowedProducts.filter(p => !p.description_paraphrased && p.description && p.description.trim());
    if (targets.length === 0) {
      toast.info("No products on this page need paraphrasing");
      return;
    }
    autoStopRef.current = false;
    setAutoParaphrase({ running: true, done: 0, total: targets.length, stop: false });
    // Seed the side queue so the admin sees every product before it starts.
    targets.forEach((p) =>
      paraphraseQueue.enqueue({ id: p.id, title: p.title, image: p.image_url })
    );
    let done = 0;
    for (const p of targets) {
      if (autoStopRef.current) break;
      setParaphrasingId(p.id);
      paraphraseQueue.update(p.id, { status: "running", message: "Paraphrasing…" });
      try {
        const { data, error } = await supabase.functions.invoke("paraphrase-description", {
          body: { description: p.description, title: p.title },
        });
        if (error) throw error;
        // Short descriptions are intentionally skipped — mark as paraphrased so
        // they never re-enter the queue.
        if ((data as any)?.skipped) {
          await supabase
            .from("allowed_products")
            .update({ description_paraphrased: true } as any)
            .eq("id", p.id);
          done++;
          setAutoParaphrase(prev => ({ ...prev, done }));
          paraphraseQueue.update(p.id, { status: "success", message: "Skipped (too short)" });
          continue;
        }
        const paraphrased = (data as any)?.paraphrased;
        if (!paraphrased) throw new Error("No paraphrased text returned");
        if (paraphrased.trim() === (p.description || "").trim()) {
          // No real change — flag it so we don't retry endlessly.
          await supabase
            .from("allowed_products")
            .update({ description_paraphrased: true } as any)
            .eq("id", p.id);
          done++;
          setAutoParaphrase(prev => ({ ...prev, done }));
          paraphraseQueue.update(p.id, { status: "success", message: "Unchanged — marked done" });
          continue;
        }
        const { error: upErr } = await supabase
          .from("allowed_products")
          .update({ description: paraphrased, description_paraphrased: true } as any)
          .eq("id", p.id);
        if (upErr) throw upErr;
        done++;
        setAutoParaphrase(prev => ({ ...prev, done }));
        paraphraseQueue.update(p.id, { status: "success", message: "Done" });
      } catch (e: any) {
        toast.error(`${p.title}: ${e.message || "failed"}`);
        paraphraseQueue.update(p.id, { status: "error", message: e?.message || "failed" });
      }
    }
    setParaphrasingId(null);
    setAutoParaphrase({ running: false, done, total: targets.length, stop: false });
    toast.success(`Auto paraphrase done: ${done}/${targets.length}`);
    fetchAllowedProducts();
  };

  const allSelected = allowedProducts.length > 0 && selectedIds.size === allowedProducts.length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());else
    setSelectedIds(new Set(allowedProducts.map((p) => p.id)));
  };

  const handleBulkPlatformChange = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    const { error } = await supabase.from("allowed_products").update({ platform: bulkPlatform, store: bulkStore } as any).in("id", Array.from(selectedIds));
    if (error) toast.error(error.message);else
    {toast.success(`Updated ${selectedIds.size} products`);setSelectedIds(new Set());setBulkAction(null);fetchAllowedProducts();}
    setBulkProcessing(false);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} products permanently?`)) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.rpc("delete_allowed_products_bulk", { product_ids: ids });
    if (error) toast.error(error.message);
    else {
      logAuditEvent({ action_type: "delete", entity_type: "product", entity_title: `Bulk delete ${selectedIds.size} products`, changes: { product_ids: ids } });
      toast.success(`Deleted ${selectedIds.size} products`);
      setSelectedIds(new Set());
      setBulkAction(null);
      fetchAllowedProducts();
    }
    setBulkProcessing(false);
  };

  // Requests state
  const [productRequests, setProductRequests] = useState<{id: string;title: string;platform: string;store: string;region: string;description: string | null;status: string;admin_note: string | null;created_at: string;requested_by: string;}[]>([]);

  // Seller apps state
  const [sellerApps, setSellerApps] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) checkAdmin();
  }, [user]);

  // Re-fetch data when navigating between admin sections OR when search/filters/page change (products only)
  useEffect(() => {
    if (!isAdmin) return;
    if (section === "products") fetchAllowedProducts();
    if (section === "products") fetchExpiringProducts();
    if (section === "requests") fetchProductRequests();
    if (section === "seller-apps") fetchSellerApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, isAdmin, location.key, debouncedSearch, filterPlatform, filterStore, filterRegion, updateSort, currentPage, itemsPerPage]);

  // Debounce the search input (300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const callAdmin = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-users", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const checkAdmin = async () => {
    try {
      await callAdmin({ action: "list_users" });
      setIsAdmin(true);
      if (section === "products") fetchAllowedProducts();
      if (section === "requests") fetchProductRequests();
    if (section === "seller-apps") {fetchSellerApps();}
    if (section === "giveaways") { /* Handled by AdminGiveaways component */ }
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllowedProducts = async () => {
    setProductsLoading(true);
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    // When sorting/filtering by update source, drive the query through kinguin_products
    // (the timestamps live there) and embed the parent allowed_products row.
    if (updateSort !== "none") {
      let kpQ = supabase
        .from("kinguin_products")
        .select(
          "id, allowed_product_id, kinguin_product_id, kinguin_price, sell_price, is_active, kinguin_stock, last_stock_check, last_webhook_update, last_change_summary, last_change_at, last_change_source, allowed_products!inner(id, title, platform, store, region, image_url, description, description_paraphrased, product_type, original_title, platform_details, created_at)",
          { count: "exact" }
        );

      if (filterPlatform !== "all") kpQ = kpQ.eq("allowed_products.platform", filterPlatform);
      if (filterStore !== "all") kpQ = kpQ.eq("allowed_products.store", filterStore);
      if (filterRegion !== "all") kpQ = kpQ.eq("allowed_products.region", filterRegion);
      if (debouncedSearch.trim()) {
        const words = debouncedSearch.trim().split(/\s+/).filter(Boolean);
        for (const w of words) {
          kpQ = kpQ.ilike("allowed_products.title", `%${w}%`);
        }
      }

      if (updateSort === "webhook_newest") {
        kpQ = kpQ.not("last_webhook_update", "is", null).order("last_webhook_update", { ascending: false });
      } else if (updateSort === "webhook_oldest") {
        kpQ = kpQ.not("last_webhook_update", "is", null).order("last_webhook_update", { ascending: true });
      } else if (updateSort === "cron_newest") {
        kpQ = kpQ.not("last_stock_check", "is", null).order("last_stock_check", { ascending: false });
      } else if (updateSort === "never_webhook") {
        kpQ = kpQ.is("last_webhook_update", null).order("last_stock_check", { ascending: false, nullsFirst: false });
      }

      const { data: kpData, count, error } = await kpQ.range(from, to);
      if (error) {
        toast.error("Failed to load products: " + error.message);
        setProductsLoading(false);
        return;
      }

      const products = (kpData || []).map((row: any) => row.allowed_products).filter(Boolean);
      setAllowedProducts(products);
      setTotalCount(count || 0);

      const kgRec: Record<string, KinguinLinkData> = {};
      (kpData || []).forEach((k: any) => {
        kgRec[k.allowed_product_id] = {
          id: k.id,
          kinguin_product_id: k.kinguin_product_id,
          kinguin_price: k.kinguin_price,
          sell_price: k.sell_price,
          is_active: k.is_active,
          kinguin_stock: k.kinguin_stock,
          last_stock_check: k.last_stock_check,
          last_webhook_update: k.last_webhook_update,
          last_change_summary: k.last_change_summary ?? null,
          last_change_at: k.last_change_at ?? null,
          last_change_source: k.last_change_source ?? null,
        };
      });
      setKinguinLinkedApIds(kgRec);

      const pageIds = products.map((p: any) => p.id);
      if (pageIds.length === 0) {
        setManualKeyApIds({});
        setProductsLoading(false);
        return;
      }
      const { data: mkData } = await supabase.rpc("get_manual_key_counts");
      const mkRec: Record<string, number> = {};
      const pageIdSet = new Set(pageIds);
      (mkData as any[] || []).forEach((k: any) => {
        if (pageIdSet.has(k.allowed_product_id)) mkRec[k.allowed_product_id] = Number(k.key_count);
      });
      setManualKeyApIds(mkRec);
      setProductsLoading(false);
      return;
    }

    let query = supabase
      .from("allowed_products")
      .select("id, title, platform, store, region, image_url, description, description_paraphrased, product_type, original_title, platform_details", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filterPlatform !== "all") query = query.eq("platform", filterPlatform);
    if (filterStore !== "all") query = query.eq("store", filterStore);
    if (filterRegion !== "all") query = query.eq("region", filterRegion);
    if (debouncedSearch.trim()) {
      const words = debouncedSearch.trim().split(/\s+/).filter(Boolean);
      // Build AND of ILIKE patterns by chaining .ilike() — Supabase chains add AND conditions.
      for (const w of words) {
        query = query.ilike("title", `%${w}%`);
      }
    }

    const { data: apData, count, error } = await query.range(from, to);
    if (error) {
      toast.error("Failed to load products: " + error.message);
      setProductsLoading(false);
      return;
    }
    setAllowedProducts((apData as any) || []);
    setTotalCount(count || 0);

    // Fetch Kinguin links and manual key counts ONLY for the current page IDs
    const pageIds = (apData || []).map((p: any) => p.id);
    if (pageIds.length === 0) {
      setKinguinLinkedApIds({});
      setManualKeyApIds({});
      setProductsLoading(false);
      return;
    }

    const [{ data: kpData }, { data: mkData }] = await Promise.all([
      supabase
        .from("kinguin_products")
        .select("id, allowed_product_id, kinguin_product_id, kinguin_price, sell_price, is_active, kinguin_stock, last_stock_check, last_webhook_update, last_change_summary, last_change_at, last_change_source")
        .in("allowed_product_id", pageIds),
      supabase.rpc("get_manual_key_counts"),
    ]);

    const kgRec: Record<string, KinguinLinkData> = {};
    (kpData || []).forEach((k: any) => {
      kgRec[k.allowed_product_id] = {
        id: k.id,
        kinguin_product_id: k.kinguin_product_id,
        kinguin_price: k.kinguin_price,
        sell_price: k.sell_price,
        is_active: k.is_active,
        kinguin_stock: k.kinguin_stock,
        last_stock_check: k.last_stock_check,
        last_webhook_update: k.last_webhook_update,
        last_change_summary: k.last_change_summary ?? null,
        last_change_at: k.last_change_at ?? null,
        last_change_source: k.last_change_source ?? null,
      };
    });
    setKinguinLinkedApIds(kgRec);

    const mkRec: Record<string, number> = {};
    const pageIdSet = new Set(pageIds);
    (mkData as any[] || []).forEach((k: any) => {
      if (pageIdSet.has(k.allowed_product_id)) {
        mkRec[k.allowed_product_id] = Number(k.key_count);
      }
    });
    setManualKeyApIds(mkRec);
    setProductsLoading(false);
  };

  const fetchProductRequests = async () => {
    const { data } = await supabase.from("product_requests").select("*").order("created_at", { ascending: false });
    if (data) setProductRequests(data as any);
  };

  const fetchSellerApps = async () => {
    const { data } = await supabase.from("seller_applications").select("*").order("created_at", { ascending: false });
    if (data) setSellerApps(data);
  };

  const handleAddAllowedProduct = async () => {
    if (!newProductTitle.trim()) return;
    setAddingProduct(true);
    let imageUrl: string | null = null;
    if (newProductImage) {
      const fileExt = newProductImage.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, newProductImage);
      if (uploadError) {toast.error("Image upload failed: " + uploadError.message);setAddingProduct(false);return;}
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }
    const { error } = await supabase.from("allowed_products").insert({
      title: newProductTitle.trim().toUpperCase(),
      platform: newProductPlatform,
      store: newProductStore,
      region: newProductRegion,
      image_url: imageUrl,
      product_type: newProductType,
      description: newProductDescription.trim() || null
    } as any);
    if (error) {toast.error(error.code === "23505" ? "Product already exists" : error.message);} else
    {
      logAuditEvent({ action_type: "create", entity_type: "product", entity_title: newProductTitle.trim().toUpperCase() });
      toast.success("Product added");
      setNewProductTitle("");setNewProductPlatform("PC");setNewProductImage(null);setImagePreview(null);setNewProductDescription("");setNewProductRegion("Global");setNewProductStore("Steam");setNewProductType("Game");
      fetchAllowedProducts();
    }
    setAddingProduct(false);
  };

  const handleRemoveAllowedProduct = async (id: string, title: string) => {
    if (!confirm(`Remove "${title}"?`)) return;
    // Delete linked kinguin_products and seller listings first
    await supabase.from("kinguin_products").delete().eq("allowed_product_id", id);
    await supabase.from("products").delete().eq("title", title);
    const { error } = await supabase.from("allowed_products").delete().eq("id", id);
    if (error) toast.error(error.message);else
    {logAuditEvent({ action_type: "delete", entity_type: "product", entity_id: id, entity_title: title });toast.success("Removed");fetchAllowedProducts();fetchExpiringProducts();}
  };

  const fetchExpiringProducts = async () => {
    const cutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("allowed_products")
      .select("id, title, expiration_date")
      .not("expiration_date", "is", null)
      .lte("expiration_date", cutoff)
      .order("expiration_date", { ascending: true });
    if (!error && data) setExpiringProducts(data as any);
  };

  const handleStartEdit = async (p: typeof allowedProducts[0]) => {
    setEditProductImage(null);setEditImagePreview(p.image_url);
    // Fetch kinguin price if linked
    const { data: kp } = await supabase.from("kinguin_products").select("id, sell_price").eq("allowed_product_id", p.id).maybeSingle();
    const { data: apRow } = await supabase.from("allowed_products").select("product_type").eq("id", p.id).maybeSingle();
    setEditingProduct({ ...p, sell_price: kp?.sell_price ?? undefined, kinguin_product_id: kp?.id ?? undefined, product_type: (apRow as any)?.product_type || (isNoTypeProduct({ store: p.store }) ? "" : "Game") });
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    setSavingProduct(true);
    let imageUrl = editingProduct.image_url;
    if (editProductImage) {
      const fileExt = editProductImage.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(fileName, editProductImage);
      if (uploadError) {toast.error("Image upload failed: " + uploadError.message);setSavingProduct(false);return;}
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }
    const { error } = await supabase.from("allowed_products").update({
      title: editingProduct.title.trim().toUpperCase(),
      platform: editingProduct.platform,
      store: editingProduct.store,
      region: editingProduct.region,
      image_url: imageUrl,
      description: editingProduct.description?.trim() || null,
      product_type: isNoTypeProduct({ store: editingProduct.store }) ? null : (editingProduct.product_type || "Game"),
    } as any).eq("id", editingProduct.id);
    if (error) {toast.error(error.message);setSavingProduct(false);return;}
    // Update or create kinguin sell price record (synthetic for manual products)
    if (editingProduct.sell_price != null && editingProduct.sell_price > 0) {
      if (editingProduct.kinguin_product_id) {
        await supabase.from("kinguin_products").update({ sell_price: editingProduct.sell_price, is_active: true } as any).eq("id", editingProduct.kinguin_product_id);
      } else {
        await supabase.from("kinguin_products").insert({
          allowed_product_id: editingProduct.id,
          kinguin_product_id: `manual:${editingProduct.id}`,
          sell_price: editingProduct.sell_price,
          kinguin_price: 0,
          kinguin_stock: 0,
          is_active: true,
        } as any);
      }
    }
    logAuditEvent({ action_type: "update", entity_type: "product", entity_id: editingProduct.id, entity_title: editingProduct.title, changes: { platform: editingProduct.platform, store: editingProduct.store, region: editingProduct.region, sell_price: editingProduct.sell_price } });
    toast.success("Product updated");setEditingProduct(null);fetchAllowedProducts();
    setSavingProduct(false);
  };

  const handleApproveRequest = async (req: typeof productRequests[0]) => {
    const { error: insertErr } = await supabase.from("allowed_products").insert({
      title: req.title, platform: req.platform, store: req.store, region: req.region, description: req.description
    } as any);
    if (insertErr) {toast.error(insertErr.message);return;}
    await supabase.from("product_requests").update({ status: "approved" } as any).eq("id", req.id);
    toast.success(`"${req.title}" approved`);
    fetchProductRequests();
  };

  const handleRejectRequest = async (id: string, note?: string) => {
    await supabase.from("product_requests").update({ status: "rejected", admin_note: note || "Rejected by admin" } as any).eq("id", id);
    toast.success("Request rejected");
    fetchProductRequests();
  };

  const handleDeleteRequest = async (id: string) => {
    await supabase.from("product_requests").delete().eq("id", id);
    fetchProductRequests();
  };

  const handleApproveSellerApp = async (app: any) => {
    try {
      await callAdmin({ action: "set_role", userId: app.user_id, role: "seller", remove: false });
    } catch (err: any) {toast.error("Failed: " + err.message);return;}
    await supabase.from("seller_applications").update({ status: "approved" } as any).eq("id", app.id);
    toast.success(`${app.full_name} is now a seller`);
    fetchSellerApps();
  };

  const handleRejectSellerApp = async (id: string) => {
    const note = prompt("Rejection reason (optional):");
    await supabase.from("seller_applications").update({ status: "rejected", admin_note: note || "Rejected" } as any).eq("id", id);
    toast.success("Application rejected");
    fetchSellerApps();
  };

  const handleDeleteSellerApp = async (id: string) => {
    if (!confirm("Delete this application permanently?")) return;
    await supabase.from("seller_applications").delete().eq("id", id);
    toast.success("Application deleted");
    fetchSellerApps();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>);

  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="font-display text-2xl text-foreground">Access Denied</h1>
        </div>
      </div>);

  }

  const sectionTitles: Record<string, {title: string;icon: React.ReactNode;}> = {
    products: { title: "Manage Allowed Products", icon: <Package className="h-5 w-5 text-primary" /> },
    orders: { title: "Orders Management", icon: <Package className="h-5 w-5 text-primary" /> },
    collections: { title: "Collections Manager", icon: <Layers className="h-5 w-5 text-primary" /> },
    "nav-menu": { title: "Navigation Menu", icon: <Package className="h-5 w-5 text-primary" /> },
    requests: { title: "Product Requests", icon: <Inbox className="h-5 w-5 text-primary" /> },
    "seller-apps": { title: "Seller Applications", icon: <ClipboardList className="h-5 w-5 text-primary" /> },
    kinguin: { title: "Kinguin Integration", icon: <Crown className="h-5 w-5 text-primary" /> },
    fraud: { title: "Fraud Prevention", icon: <Shield className="h-5 w-5 text-primary" /> },
    "fake-sellers": { title: "Fake Seller Generator", icon: <Crown className="h-5 w-5 text-primary" /> },
    tickets: { title: "Support Tickets", icon: <MessageSquare className="h-5 w-5 text-primary" /> },
    withdrawals: { title: "Withdrawal Requests", icon: <Crown className="h-5 w-5 text-primary" /> },
    pricing: { title: "Pricing Rules", icon: <Package className="h-5 w-5 text-primary" /> },
    "price-compare": { title: "AllKeyShop Price Comparison", icon: <Crown className="h-5 w-5 text-primary" /> },
    newsletter: { title: "Newsletter Subscribers", icon: <MessageSquare className="h-5 w-5 text-primary" /> },
    aliexpress: { title: "AliExpress Import", icon: <Package className="h-5 w-5 text-primary" /> },
    suggestions: { title: "Product Discovery", icon: <Inbox className="h-5 w-5 text-primary" /> },
    "discount-codes": { title: "Discount Codes", icon: <Package className="h-5 w-5 text-primary" /> },
    "social-posts": { title: "Social Media Posts", icon: <MessageSquare className="h-5 w-5 text-primary" /> },
    "sync-center": { title: "Sync Center", icon: <Package className="h-5 w-5 text-primary" /> },
    "email-provider": { title: "Email Provider", icon: <Package className="h-5 w-5 text-primary" /> },
    "email-logs": { title: "Sent Emails", icon: <Package className="h-5 w-5 text-primary" /> },
  };

  const currentSection = sectionTitles[section || ""] || { title: "Unknown", icon: null };

  const stopRef = { current: false };

  const handleBatchProcess50 = async () => {
    setBatchProcessing(true);
    setBatchStopping(false);
    stopRef.current = false;
    setBatchProgress({ processed: 0, total: 0, status: "Starting..." });

    // First, get total count of unparaphrased
    const { count: initialRemaining } = await supabase
      .from("allowed_products")
      .select("id", { count: "exact", head: true })
      .eq("description_paraphrased", false)
      .not("description", "is", null)
      .neq("description", "");

    const totalToProcess = initialRemaining ?? 0;
    if (totalToProcess === 0) {
      toast.success("All products already paraphrased!");
      setBatchProcessing(false);
      setBatchProgress(null);
      return;
    }

    let totalProcessed = 0;

    while (!stopRef.current) {
      setBatchProgress({ processed: totalProcessed, total: totalToProcess, status: "Processing batch..." });

      try {
        const { data, error } = await supabase.functions.invoke("batch-paraphrase-parallel", {
          body: { batchSize: 50 },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.credits_exhausted) {
          toast.error("AI credits exhausted! Stopping.");
          break;
        }

        if (data?.rate_limited) {
          setBatchProgress(prev => prev ? { ...prev, status: "Rate limited — waiting 60s..." } : prev);
          for (let i = 60; i > 0 && !stopRef.current; i--) {
            setBatchProgress(prev => prev ? { ...prev, status: `Rate limited — retrying in ${i}s...` } : prev);
            await new Promise(r => setTimeout(r, 1000));
          }
          continue; // retry same batch
        }

        totalProcessed += data?.processed || 0;
        const remaining = data?.remaining ?? 0;

        setBatchProgress({ processed: totalProcessed, total: totalToProcess, status: `✅ ${totalProcessed} done — ${remaining} left` });

        if (remaining === 0) {
          toast.success(`🎉 All done! ${totalProcessed} products paraphrased.`);
          break;
        }

        // 20s cooldown
        for (let i = 20; i > 0 && !stopRef.current; i--) {
          setBatchProgress(prev => prev ? { ...prev, status: `Next batch in ${i}s... (${totalProcessed}/${totalToProcess})` } : prev);
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (err: any) {
        toast.error("Batch error: " + (err?.message || "Unknown"));
        break;
      }
    }

    if (stopRef.current) {
      toast.info(`Stopped. ${totalProcessed} products processed so far.`);
    }

    await fetchAllowedProducts();
    setBatchProcessing(false);
    setBatchProgress(null);
  };

  const handleStopBatch = () => {
    stopRef.current = true;
    setBatchStopping(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50 px-6 py-3">
        <AdminNavButtons />
      </div>
      <div className="w-full px-6 py-8 space-y-6">

        {/* Products Section */}
        {section === "products" &&
        <div className="space-y-6">
            {/* Sync jobs (paraphrase, image compression) moved to /admin/sync-center */}

            {batchProgress && (
              <div className="bg-secondary/20 border border-border rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>⚡ Manual Batch</span>
                  <span>{batchProgress.status}</span>
                </div>
                <Progress value={batchProgress.total > 0 ? (batchProgress.processed / batchProgress.total) * 100 : 0} className="h-3" />
              </div>
            )}

            {/* Expiring Products Alert */}
            {expiringProducts.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Expiring Soon ({expiringProducts.length})
                </h3>
                {expiringProducts.map((p) => {
                  const expDate = new Date(p.expiration_date);
                  const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const isExpired = daysLeft <= 0;
                  const isUrgent = daysLeft > 0 && daysLeft <= 7;
                  return (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                      isExpired ? 'bg-destructive/10 border-destructive/30' :
                      isUrgent ? 'bg-amber-500/10 border-amber-500/30' :
                      'bg-amber-500/5 border-amber-500/20'
                    }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className={`h-4 w-4 shrink-0 ${
                          isExpired ? 'text-destructive' : isUrgent ? 'text-amber-500' : 'text-muted-foreground'
                        }`} />
                        <span className="text-sm font-medium text-foreground truncate">{p.title}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-bold ${
                          isExpired ? 'text-destructive' : isUrgent ? 'text-amber-500' : 'text-muted-foreground'
                        }`}>
                          {isExpired ? '⚠️ EXPIRED' : `${daysLeft} days left`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {expDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                        {isExpired && (
                          <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => handleRemoveAllowedProduct(p.id, p.title)}>
                            <Trash2 className="h-3 w-3 mr-1" /> Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-destructive-foreground">Sellers can only list products from this list.</p>
            </div>



            <div className="space-y-3 border border-border rounded-lg p-4 bg-secondary/30">
              <h3 className="font-display text-sm font-semibold text-destructive">Add New Product</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Title *</label>
                  <Input value={newProductTitle} onChange={(e) => setNewProductTitle(e.target.value)} placeholder="e.g. GTA V" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Platform *</label>
                  <select value={newProductPlatform} onChange={(e) => {setNewProductPlatform(e.target.value);setNewProductStore(getSubPlatforms(e.target.value)[0]);}} className="w-full h-10 px-3 rounded-md bg-secondary border border-border font-body focus:outline-none focus:ring-1 focus:ring-primary text-[sidebar-primary-foreground] text-card-foreground">
                    {Object.keys(SUB_PLATFORM_MAP).map((platform) => (
                      <option key={platform} value={platform}>{platform}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Region *</label>
                  <select value={newProductRegion} onChange={(e) => setNewProductRegion(e.target.value)} className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary">
                    {ALL_REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Sub Platform *</label>
                  <select value={newProductStore} onChange={(e) => setNewProductStore(e.target.value)} className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary">
                    {getSubPlatforms(newProductPlatform).map((sp) =>
                  <option key={sp} value={sp}>{sp}</option>
                  )}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Product Type *</label>
                  <select value={newProductType} onChange={(e) => setNewProductType(e.target.value)} className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary">
                    {PRODUCT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Image</label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary border border-border text-sm text-foreground font-body hover:bg-accent transition-colors">
                      <Plus className="h-4 w-4" />
                      {newProductImage ? newProductImage.name : "Choose file"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setNewProductImage(file);
                      setImagePreview(file ? URL.createObjectURL(file) : null);
                    }} />
                    </label>
                    {imagePreview && <img src={imagePreview} alt="Preview" className="w-10 h-10 rounded object-cover border border-border" />}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Description</label>
                  <textarea value={newProductDescription} onChange={(e) => setNewProductDescription(e.target.value)} placeholder="Product description..." rows={3} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                </div>
              </div>
              <Button onClick={handleAddAllowedProduct} disabled={addingProduct} className="gap-2">
                <Plus className="h-4 w-4" />
                {addingProduct ? "Adding..." : "Add Product"}
              </Button>
            </div>

            {/* Search, Filters & Products list */}
            {(() => {
              // Static filter values from config (instead of derived from in-memory products)
              const uniquePlatforms = Object.keys(SUB_PLATFORM_MAP);
              const uniqueStores = filterPlatform === "all"
                ? Array.from(new Set(Object.values(SUB_PLATFORM_MAP).flat())).sort()
                : getSubPlatforms(filterPlatform);
              const uniqueRegions = ALL_REGIONS.map(r => r.value);

              // Server-side pagination — pageItems = current page rows; totalCount = full match count
              const pageItems = allowedProducts;
              const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
              const safePage = Math.min(currentPage, totalPages);
              const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
              const allFilteredSelected = pageItems.length > 0 && pageItems.every(p => selectedIds.has(p.id));

              return (
                <div className="space-y-3">
                  {/* Search & Filters */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search products..."
                        className="pl-9 h-9"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    <select value={filterPlatform} onChange={(e) => { setFilterPlatform(e.target.value); setFilterStore("all"); setCurrentPage(1); }} className="h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground font-body">
                      <option value="all">All Platforms</option>
                      {uniquePlatforms.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={filterStore} onChange={(e) => { setFilterStore(e.target.value); setCurrentPage(1); }} className="h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground font-body">
                      <option value="all">All Sub-Platforms</option>
                      {uniqueStores.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={filterRegion} onChange={(e) => { setFilterRegion(e.target.value); setCurrentPage(1); }} className="h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground font-body">
                      <option value="all">All Regions</option>
                      {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select
                      value={updateSort}
                      onChange={(e) => { setUpdateSort(e.target.value); setCurrentPage(1); }}
                      className="h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground font-body"
                      title="Sort/filter by last update source"
                    >
                      <option value="none">Update: Default</option>
                      <option value="webhook_newest">Webhook · Newest first</option>
                      <option value="webhook_oldest">Webhook · Oldest first</option>
                      <option value="cron_newest">Cron · Newest first</option>
                      <option value="never_webhook">Never received Webhook</option>
                    </select>
                    <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="h-9 px-3 rounded-md bg-secondary border border-border text-xs text-foreground font-body">
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={150}>150 / page</option>
                      <option value={200}>200 / page</option>
                    </select>
                  </div>

                  {/* Header with select all & count */}
                  <div className="flex items-center gap-4">
                    {pageItems.length > 0 && (
                      <div className="flex items-center gap-2 pl-4">
                        <Checkbox checked={allFilteredSelected} onCheckedChange={() => {
                          if (allFilteredSelected) {
                            const next = new Set(selectedIds);
                            pageItems.forEach(p => next.delete(p.id));
                            setSelectedIds(next);
                          } else {
                            const next = new Set(selectedIds);
                            pageItems.forEach(p => next.add(p.id));
                            setSelectedIds(next);
                          }
                        }} />
                        <span className="text-xs text-muted-foreground">Select Page</span>
                      </div>
                    )}
                    <h3 className="font-display text-sm font-semibold text-foreground">
                      Products ({totalCount}){productsLoading && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
                    </h3>
                    {(searchQuery || filterPlatform !== "all" || filterStore !== "all" || filterRegion !== "all" || updateSort !== "none") && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setSearchQuery(""); setFilterPlatform("all"); setFilterStore("all"); setFilterRegion("all"); setUpdateSort("none"); setCurrentPage(1); }}>
                        <X className="h-3 w-3" /> Clear Filters
                      </Button>
                    )}
                  </div>

                  {/* Bulk Actions Bar */}
                  {selectedIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
                      <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
                      <span className="text-muted-foreground">|</span>
                      {bulkAction === "platform" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={bulkPlatform} onChange={(e) => {setBulkPlatform(e.target.value);setBulkStore(getSubPlatforms(e.target.value)[0]);}} className="h-8 px-2 rounded-md bg-secondary border border-border text-xs text-foreground">
                            {Object.keys(SUB_PLATFORM_MAP).map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <select value={bulkStore} onChange={(e) => setBulkStore(e.target.value)} className="h-8 px-2 rounded-md bg-secondary border border-border text-xs text-foreground">
                            {getSubPlatforms(bulkPlatform).map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                          </select>
                          <Button size="sm" className="h-8 text-xs" onClick={handleBulkPlatformChange} disabled={bulkProcessing}>
                            {bulkProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setBulkAction(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setBulkAction("platform")}>
                            Change Platform
                          </Button>
                          <Button variant="destructive" size="sm" className="h-8 text-xs gap-1" onClick={handleBulkDelete} disabled={bulkProcessing}>
                            {bulkProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            Delete ({selectedIds.size})
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedIds(new Set())}>
                            <X className="h-3 w-3" /> Clear
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Product rows */}
                  {pageItems.length > 0 ? (
                    <div className="space-y-2">
                      {pageItems.map((p) => {
                        const kgLink = p.id in kinguinLinkedApIds ? kinguinLinkedApIds[p.id] : null;
                        const mkCount = manualKeyApIds[p.id] || 0;
                        return (
                        <div key={p.id} onClick={() => navigate(`/product/${p.id}`)} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg px-3 sm:px-4 py-3 border transition-colors cursor-pointer hover:border-primary/50 gap-2 ${selectedIds.has(p.id) ? 'bg-primary/5 border-primary/30' : 'bg-secondary/50 border-border/50'}`}>
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} /></div>
                            {p.image_url && <img src={p.image_url} alt={p.title} className="w-8 h-8 sm:w-10 sm:h-10 rounded object-cover shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <span className="text-xs sm:text-sm font-body font-medium text-foreground line-clamp-1">{p.title}</span>
                              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                                {kgLink && (
                                  <span className={`text-[10px] sm:text-xs font-display font-bold px-1 sm:px-1.5 py-0.5 rounded border ${kgLink.is_active ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-destructive/20 text-destructive border-destructive/30'}`}>
                                    KG {kgLink.kinguin_stock || 0}{!kgLink.is_active && ' ⏸'}
                                  </span>
                                )}
                                {mkCount > 0 && <span className="text-[10px] sm:text-xs font-display font-bold px-1 sm:px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">MK {mkCount}</span>}
                                {kgLink && !kgLink.is_active && (kgLink.kinguin_stock || 0) === 0 && mkCount === 0 && (
                                  <span className="text-[10px] sm:text-xs font-display font-bold px-1 sm:px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30">OUT OF STOCK</span>
                                )}
                                {p.description_paraphrased && <span className="text-[10px] sm:text-xs font-display font-bold px-1 sm:px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 border border-violet-500/30">✓ PR</span>}
                                {!isNoTypeProduct({ store: p.store }) && (
                                  <span className="text-[10px] sm:text-xs font-body px-1.5 sm:px-2 py-0.5 rounded-full bg-muted text-foreground border border-border">{p.product_type || "Game"}</span>
                                )}
                                <span className="text-[10px] sm:text-xs font-body px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p.platform}</span>
                                <span className="text-[10px] sm:text-xs font-body px-1.5 sm:px-2 py-0.5 rounded-full bg-secondary text-foreground">{p.store}</span>
                                <span className="text-[10px] sm:text-xs font-body px-1.5 sm:px-2 py-0.5 rounded-full bg-accent/10 text-accent">{p.region}</span>
                                {kgLink && (() => {
                                   const actualCost = kgLink.kinguin_price ? kinguinBuyPrice(kgLink.kinguin_price) : 0;
                                   const profit = kgLink.sell_price - actualCost;
                                   return (
                                     <span className="text-[10px] sm:text-xs text-muted-foreground">
                                       Buy: €{actualCost ? actualCost.toFixed(2) : '?'} • Sell: €{kgLink.sell_price.toFixed(2)} • Profit: <span className={profit > 0 ? 'text-green-500' : 'text-destructive'}>{profit >= 0 ? '+' : ''}€{profit.toFixed(2)}</span>
                                     </span>
                                   );
                                 })()}
                                {kgLink && (() => {
                                  const wh = kgLink.last_webhook_update ? new Date(kgLink.last_webhook_update).getTime() : 0;
                                  const cr = kgLink.last_stock_check ? new Date(kgLink.last_stock_check).getTime() : 0;
                                  if (!wh && !cr) {
                                    return <span className="text-[10px] sm:text-xs font-display font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">Never updated</span>;
                                  }
                                  const useWebhook = wh >= cr;
                                  const ts = useWebhook ? kgLink.last_webhook_update! : kgLink.last_stock_check!;
                                  const diffMs = Date.now() - new Date(ts).getTime();
                                  const mins = Math.floor(diffMs / 60000);
                                  const rel = mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins/60)}h ago` : `${Math.floor(mins/1440)}d ago`;
                                  const cls = useWebhook
                                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                                    : "bg-orange-500/20 text-orange-300 border-orange-500/30";
                                  const fullTime = new Date(ts).toLocaleString();
                                  return (
                                    <span
                                      className={`text-[10px] sm:text-xs font-display font-bold px-1.5 py-0.5 rounded border ${cls}`}
                                      title={`Last update: ${fullTime}${kgLink.last_webhook_update ? ` · Webhook: ${new Date(kgLink.last_webhook_update).toLocaleString()}` : ' · No webhook yet'}${kgLink.last_stock_check ? ` · Cron: ${new Date(kgLink.last_stock_check).toLocaleString()}` : ''}`}
                                    >
                                      {useWebhook ? "⚡ Webhook" : "⏱ Cron"} · {rel}
                                    </span>
                                  );
                                })()}
                              </div>
                              {(p.platform_details || (p.original_title && p.original_title !== p.title)) && (
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] sm:text-xs font-display font-bold px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-300 border-blue-500/30">
                                    KINGUIN
                                  </span>
                                  {p.platform_details && (
                                    <span
                                      className={`text-[10px] sm:text-xs font-mono px-1.5 py-0.5 rounded ${p.platform_details.toUpperCase() !== p.platform.toUpperCase() ? 'bg-amber-500/15 text-amber-300' : 'bg-muted text-muted-foreground'}`}
                                      title="Raw platform field from Kinguin's catalog at import time — compare against our Platform badge above"
                                    >
                                      {p.platform_details}
                                    </span>
                                  )}
                                  {p.original_title && p.original_title !== p.title && (
                                    <span className="text-[10px] sm:text-xs text-muted-foreground italic truncate max-w-[260px]" title={p.original_title}>
                                      "{p.original_title}"
                                    </span>
                                  )}
                                </div>
                              )}
                              {kgLink?.last_change_summary && (
                                <div className="mt-1">
                                  <span
                                    className="inline-block text-[10px] sm:text-xs px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-mono"
                                    title={`${kgLink.last_change_source === 'webhook' ? '⚡ Webhook' : '⏱ Cron'} · ${kgLink.last_change_at ? new Date(kgLink.last_change_at).toLocaleString() : ''}`}
                                  >
                                    Δ {kgLink.last_change_summary}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 flex-wrap sm:flex-nowrap pl-6 sm:pl-0" onClick={(e) => e.stopPropagation()}>
                            {!isNoTypeProduct({ store: p.store }) && (
                              <select
                                value={p.product_type || "Game"}
                                onChange={async (e) => {
                                  const nextType = e.target.value;
                                  const { error } = await supabase.from("allowed_products").update({ product_type: nextType } as any).eq("id", p.id);
                                  if (error) {
                                    toast.error(error.message);
                                    return;
                                  }
                                  setAllowedProducts((prev) => prev.map((item) => item.id === p.id ? { ...item, product_type: nextType } : item));
                                  toast.success("Product type updated");
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-7 sm:h-8 w-28 sm:w-36 px-2 rounded-md bg-secondary border border-border text-xs text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary"
                                title="Product Type"
                              >
                                {PRODUCT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                              </select>
                            )}
                            {kgLink && (
                              <>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="w-16 sm:w-20 h-7 sm:h-8 text-xs"
                                  defaultValue={kgLink.sell_price}
                                  onBlur={async (e) => {
                                    const price = parseFloat(e.target.value);
                                    if (isNaN(price) || price <= 0) return;
                                    await supabase.from("kinguin_products").update({ sell_price: price } as any).eq("id", kgLink.id);
                                    toast.success("Price updated");
                                    fetchAllowedProducts();
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <button
                                  onClick={() => {
                                    supabase.from("kinguin_products").update({ is_active: !kgLink.is_active } as any).eq("id", kgLink.id).then(() => fetchAllowedProducts());
                                  }}
                                  className={`p-1 sm:p-1.5 transition-colors ${kgLink.is_active ? 'text-emerald-400 hover:text-emerald-300' : 'text-muted-foreground hover:text-foreground'}`}
                                  title={kgLink.is_active ? "Deactivate" : "Activate"}
                                >
                                  <Power className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </button>
                                <a
                                  href={`https://www.kinguin.net/category/${kgLink.kinguin_product_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-primary transition-colors p-1 sm:p-1.5"
                                  title="View on Kinguin"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </a>
                                <button
                                  onClick={async () => {
                                    if (!confirm("Unlink Kinguin from this product?")) return;
                                    await supabase.from("kinguin_products").delete().eq("id", kgLink.id);
                                    toast.success("Kinguin unlinked");
                                    fetchAllowedProducts();
                                  }}
                                  className="text-muted-foreground hover:text-destructive transition-colors p-1 sm:p-1.5"
                                  title="Unlink Kinguin"
                                >
                                  <Unlink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </button>
                              </>
                            )}
                            <button onClick={() => setManualKeysProduct({ id: p.id, title: p.title })} className="text-muted-foreground hover:text-amber-400 transition-colors p-1 sm:p-1.5" title="Manual Keys">
                              <Key className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>


                            <button onClick={() => handleStartEdit(p)} className="text-muted-foreground hover:text-primary transition-colors p-1 sm:p-1.5">
                              <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (paraphrasingId) return;
                                if (!p.description || !p.description.trim()) {
                                  toast.error("No description to paraphrase");
                                  return;
                                }
                                setParaphrasingId(p.id);
                                paraphraseQueue.enqueue({ id: p.id, title: p.title, image: p.image_url });
                                paraphraseQueue.update(p.id, { status: "running", message: "Paraphrasing…" });
                                try {
                                  const { data, error } = await supabase.functions.invoke("paraphrase-description", {
                                    body: { description: p.description, title: p.title },
                                  });
                                  if (error) throw error;
                                  if ((data as any)?.skipped) {
                                    await supabase
                                      .from("allowed_products")
                                      .update({ description_paraphrased: true } as any)
                                      .eq("id", p.id);
                                    toast.info("Description too short — marked as done");
                                    paraphraseQueue.update(p.id, { status: "success", message: "Skipped (too short)" });
                                    fetchAllowedProducts();
                                    return;
                                  }
                                  const paraphrased = (data as any)?.paraphrased;
                                  if (!paraphrased) throw new Error("No paraphrased text returned");
                                  if (paraphrased.trim() === (p.description || "").trim()) {
                                    await supabase
                                      .from("allowed_products")
                                      .update({ description_paraphrased: true } as any)
                                      .eq("id", p.id);
                                    toast.info("AI returned unchanged text — marked as done");
                                    paraphraseQueue.update(p.id, { status: "success", message: "Unchanged — marked done" });
                                    fetchAllowedProducts();
                                    return;
                                  }
                                  const { error: upErr } = await supabase
                                    .from("allowed_products")
                                    .update({ description: paraphrased, description_paraphrased: true } as any)
                                    .eq("id", p.id);
                                  if (upErr) throw upErr;
                                  toast.success("Description paraphrased");
                                  paraphraseQueue.update(p.id, { status: "success", message: "Done" });
                                  fetchAllowedProducts();
                                } catch (e: any) {
                                  toast.error(e.message || "Paraphrase failed");
                                  paraphraseQueue.update(p.id, { status: "error", message: e?.message || "failed" });
                                } finally {
                                  setParaphrasingId(null);
                                }
                              }}
                              disabled={paraphrasingId === p.id}
                              className="text-muted-foreground hover:text-violet-400 transition-colors p-1 sm:p-1.5 disabled:opacity-50"
                              title="Paraphrase description with AI"
                            >
                              {paraphrasingId === p.id ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                            </button>
                            <button onClick={() => handleRemoveAllowedProduct(p.id, p.title)} className="text-muted-foreground hover:text-destructive transition-colors p-1 sm:p-1.5">
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm font-body text-muted-foreground">
                      {allowedProducts.length === 0 ? "No products in the allowed list yet." : "No products match the current filters."}
                    </p>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex items-center gap-2">
                        {autoParaphrase.running && (
                          <span className="text-xs font-mono text-violet-400">
                            Paraphrasing {autoParaphrase.done}/{autoParaphrase.total}...
                          </span>
                        )}
                        {autoParaphrase.running ? (
                          <Button size="sm" variant="destructive" onClick={() => { autoStopRef.current = true; }}>
                            Stop
                          </Button>
                        ) : (
                          <Button size="sm" onClick={runAutoParaphrasePage} className="gap-2 bg-violet-600 hover:bg-violet-700">
                            <Wand2 className="h-4 w-4" />
                            Auto Paraphrase Page
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground font-body">
                          Showing {startIdx + 1}–{Math.min(startIdx + ITEMS_PER_PAGE, totalCount)} of {totalCount}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                            .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                              acc.push(p);
                              return acc;
                            }, [])
                            .map((p, i) =>
                              p === 'ellipsis' ? (
                                <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                              ) : (
                                <Button key={p} variant={p === safePage ? "default" : "outline"} size="sm" className="h-8 w-8 text-xs p-0" onClick={() => setCurrentPage(p as number)}>
                                  {p}
                                </Button>
                              )
                            )}
                          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Edit Product Modal */}
            {editingProduct &&
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
                <div className="bg-background rounded-2xl shadow-2xl border border-border p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold text-foreground">Edit Product</h2>
                    <button onClick={() => setEditingProduct(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground font-body mb-1 block">Title *</label>
                      <Input value={editingProduct.title} onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-body mb-1 block">Platform *</label>
                      <select value={editingProduct.platform} onChange={(e) => {const p = e.target.value;setEditingProduct({ ...editingProduct, platform: p, store: getSubPlatforms(p)[0] });}} className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary">
                        {Object.keys(SUB_PLATFORM_MAP).map((platform) => (
                          <option key={platform} value={platform}>{platform}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-body mb-1 block">Sub Platform *</label>
                      <select value={editingProduct.store} onChange={(e) => setEditingProduct({ ...editingProduct, store: e.target.value })} className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary">
                        {getSubPlatforms(editingProduct.platform).map((sp) =>
                    <option key={sp} value={sp}>{sp}</option>
                    )}
                      </select>
                    </div>
                    {!isNoTypeProduct({ store: editingProduct.store }) && (
                      <div>
                        <label className="text-xs text-muted-foreground font-body mb-1 block">Product Type *</label>
                        <select
                          value={editingProduct.product_type || "Game"}
                          onChange={(e) => setEditingProduct({ ...editingProduct, product_type: e.target.value })}
                          className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {PRODUCT_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground font-body mb-1 block">Region *</label>
                      <select value={editingProduct.region} onChange={(e) => setEditingProduct({ ...editingProduct, region: e.target.value })} className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary">
                        {ALL_REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground font-body mb-1 block">Image</label>
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary border border-border text-sm text-foreground font-body hover:bg-accent transition-colors">
                          <Plus className="h-4 w-4" />
                          {editProductImage ? editProductImage.name : "Change image"}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setEditProductImage(file);
                        if (file) setEditImagePreview(URL.createObjectURL(file));
                      }} />
                        </label>
                        {editImagePreview && <img src={editImagePreview} alt="Preview" className="w-10 h-10 rounded object-cover border border-border" />}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground font-body mb-1 block">Description</label>
                      <textarea value={editingProduct.description || ""} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} placeholder="Product description..." rows={3} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-body mb-1 block">Sell Price ($)</label>
                      <Input type="number" step="0.01" min="0" placeholder="0.00" value={editingProduct.sell_price ?? ""} onChange={(e) => setEditingProduct({ ...editingProduct, sell_price: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveProduct} disabled={savingProduct} className="gap-2">{savingProduct ? "Saving..." : "Save Changes"}</Button>
                    <Button variant="ghost" onClick={() => setEditingProduct(null)}>Cancel</Button>
                  </div>
                </div>
              </div>
          }

          {/* Manual Keys Dialog */}
          {user && manualKeysProduct && (
            <AdminManualKeys
              open={!!manualKeysProduct}
              onOpenChange={(open) => { if (!open) setManualKeysProduct(null); }}
              allowedProductId={manualKeysProduct.id}
              productTitle={manualKeysProduct.title}
              userId={user.id}
              onKeysChanged={fetchAllowedProducts}
            />
          )}
          </div>
        }

        {/* Collections Section */}
        {section === "collections" && <AdminCollections />}

        {/* Requests Section */}
        {section === "requests" &&
        <div className="space-y-3">
            {productRequests.length === 0 ?
          <p className="text-sm text-muted-foreground font-body text-center py-8">No product requests yet.</p> :

          <div className="space-y-3">
                {productRequests.map((r) =>
            <div key={r.id} className={`rounded-lg border p-4 space-y-2 ${
            r.status === "pending" ? "border-yellow-500/30 bg-yellow-500/5" :
            r.status === "approved" ? "border-green-500/30 bg-green-500/5" :
            "border-destructive/30 bg-destructive/5"}`
            }>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{r.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.platform}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground">{r.store}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground">{r.region}</span>
                        </div>
                        {r.description && <p className="text-xs text-muted-foreground mt-2">{r.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${
                r.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                r.status === "approved" ? "bg-green-500/20 text-green-400" :
                "bg-destructive/20 text-destructive"}`
                }>{r.status}</span>
                    </div>
                    {r.status === "pending" &&
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => handleApproveRequest(r)}>
                          <CheckCircle2 className="h-3 w-3" /> Approve & Add
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => {
                  const note = prompt("Rejection reason (optional):");
                  handleRejectRequest(r.id, note || undefined);
                }}>
                          <XCircle className="h-3 w-3" /> Reject
                        </Button>
                      </div>
              }
                    {r.status !== "pending" &&
              <div className="flex justify-end pt-1">
                        <button onClick={() => handleDeleteRequest(r.id)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                      </div>
              }
                  </div>
            )}
              </div>
          }
          </div>
        }

        {/* Seller Apps Section */}
        {section === "seller-apps" && !selectedApp &&
        <div className="space-y-4">
            {sellerApps.length === 0 ?
          <p className="text-sm text-muted-foreground font-body text-center py-8">No seller applications yet.</p> :

          <div className="space-y-1">
                {sellerApps.map((app) =>
            <button key={app.id} onClick={() => setSelectedApp(app)} className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-secondary/60 transition-colors text-left">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{app.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{app.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{new Date(app.created_at).toLocaleDateString()}</span>
                      <span className={`text-xs font-display font-bold px-2 py-0.5 rounded-full capitalize ${
                app.status === "pending" ? "bg-yellow-600/20 text-yellow-700" :
                app.status === "approved" ? "bg-green-700/20 text-green-700" :
                "bg-destructive/20 text-destructive"}`
                }>{app.status}</span>
                    </div>
                  </button>
            )}
              </div>
          }
          </div>
        }

        {/* Seller App Detail */}
        {section === "seller-apps" && selectedApp &&
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm font-body">
              <div><span className="text-muted-foreground">Email: </span><span className="text-foreground">{selectedApp.email || "—"}</span></div>
              <div><span className="text-muted-foreground">Phone: </span><span className="text-foreground">{selectedApp.phone || "—"}</span></div>
              <div><span className="text-muted-foreground">Country: </span><span className="text-foreground">{selectedApp.country || "—"}</span></div>
              <div><span className="text-muted-foreground">Business Name: </span><span className="text-foreground">{selectedApp.business_name || "—"}</span></div>
              <div><span className="text-muted-foreground">Applied: </span><span className="text-foreground">{new Date(selectedApp.created_at).toLocaleDateString()}</span></div>
              <div><span className="text-muted-foreground">Status: </span><span className={`text-xs font-display font-bold px-2 py-0.5 rounded-full capitalize ${
              selectedApp.status === "pending" ? "bg-yellow-600/20 text-yellow-700" :
              selectedApp.status === "approved" ? "bg-green-700/20 text-green-700" :
              "bg-destructive/20 text-destructive"}`
              }>{selectedApp.status}</span></div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 space-y-3 text-sm">
              <div><span className="font-semibold text-foreground">Products they want to sell:</span><p className="text-muted-foreground mt-0.5">{selectedApp.product_types || "—"}</p></div>
              <div><span className="font-semibold text-foreground">Selling Experience:</span><p className="text-muted-foreground mt-0.5">{selectedApp.experience || "—"}</p></div>
              <div><span className="font-semibold text-foreground">Why they want to sell with us:</span><p className="text-muted-foreground mt-0.5">{selectedApp.why_sell || "—"}</p></div>
            </div>
            {(selectedApp.id_document_url || selectedApp.selfie_url || selectedApp.business_document_url || selectedApp.supplier_receipts_urls && selectedApp.supplier_receipts_urls.length > 0) &&
          <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">📎 Documents</p>
                <div className="flex flex-wrap gap-2">
                  {selectedApp.id_document_url &&
              <button type="button" className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium" onClick={async () => {
                const { data } = await supabase.storage.from("seller-documents").createSignedUrl(selectedApp.id_document_url, 300);
                if (data?.signedUrl) window.open(data.signedUrl, "_blank");else toast.error("Failed to load document");
              }}>🪪 ID Document</button>
              }
                  {selectedApp.selfie_url &&
              <button type="button" className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium" onClick={async () => {
                const { data } = await supabase.storage.from("seller-documents").createSignedUrl(selectedApp.selfie_url, 300);
                if (data?.signedUrl) window.open(data.signedUrl, "_blank");else toast.error("Failed to load document");
              }}>🤳 Selfie</button>
              }
                  {selectedApp.business_document_url &&
              <button type="button" className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium" onClick={async () => {
                const { data } = await supabase.storage.from("seller-documents").createSignedUrl(selectedApp.business_document_url, 300);
                if (data?.signedUrl) window.open(data.signedUrl, "_blank");else toast.error("Failed to load document");
              }}>🏢 Business Doc</button>
              }
                  {selectedApp.supplier_receipts_urls && selectedApp.supplier_receipts_urls.map((url: string, idx: number) =>
              <button key={idx} type="button" className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium" onClick={async () => {
                const { data } = await supabase.storage.from("seller-documents").createSignedUrl(url, 300);
                if (data?.signedUrl) window.open(data.signedUrl, "_blank");else toast.error("Failed to load document");
              }}>🧾 Receipt #{idx + 1}</button>
              )}
                </div>
              </div>
          }
            {selectedApp.admin_note && selectedApp.status === "rejected" &&
          <p className="text-sm text-destructive">Note: {selectedApp.admin_note}</p>
          }
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              {selectedApp.status === "pending" &&
            <>
                  <Button size="sm" className="gap-1" onClick={() => {handleApproveSellerApp(selectedApp);setSelectedApp(null);}}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => {handleRejectSellerApp(selectedApp.id);setSelectedApp(null);}}><XCircle className="h-3.5 w-3.5" /> Reject</Button>
                </>
            }
              {selectedApp.status !== "pending" &&
            <Button size="sm" variant="destructive" className="gap-1" onClick={() => {handleDeleteSellerApp(selectedApp.id);setSelectedApp(null);}}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            }
              <Button size="sm" variant="ghost" onClick={() => setSelectedApp(null)}>Back</Button>
            </div>
          </div>
        }

        {/* Orders Section */}
        {section === "orders" && <AdminOrders />}

        {/* Kinguin Section */}
        {section === "kinguin" && <KinguinManager key={location.key} />}

        {/* Fraud Prevention Section */}
        {section === "fraud" && <AdminFraudDashboard />}

        {/* Fake Sellers Section */}
        {section === "fake-sellers" && <FakeSellerGenerator />}

        {/* Support Tickets Section */}
        {section === "tickets" && <AdminTickets />}

        {/* Chat Attachments Section */}
        {section === "chat-attachments" && <AdminChatAttachments />}

        {/* Withdrawals Section */}
        {section === "withdrawals" && <AdminWithdrawals />}

        {/* Pricing Section */}
        {section === "pricing" && <AdminPricing />}

        {/* Nav Menu Section */}
        {section === "nav-menu" && <AdminNavMenu />}

        {/* GG.deals Price Comparison Section */}
        {section === "price-compare" && <AdminPriceComparison />}

        {/* Newsletter Section */}
        {section === "newsletter" && <AdminNewsletter />}

        {/* Game Groups Section */}
        {section === "game-groups" && <AdminGameGroups />}

        {/* AliExpress Section */}
        {section === "aliexpress" && <AliExpressManager />}

        {/* Product Discovery Section */}
        {section === "suggestions" && <AdminProductSuggestions />}

        {/* Discount Codes Section */}
        {section === "discount-codes" && <AdminDiscountCodes />}

        {/* Business Portal Section */}
        {section === "business-portal" && <AdminBusinessPortal />}

        {/* Social Posts Section */}
        {section === "social-posts" && <AdminSocialPosts />}

        {/* Search Analytics Section */}
        {section === "search-logs" && <AdminSearchLogs />}

        {/* SEO Generator Section */}
        {section === "seo-generator" && <AdminSEOGenerator />}

        {/* Daily Deals Section */}
        {section === "daily-deals" && <AdminDailyDeals />}

        {/* Help & Guides */}
        {section === "guides" && <AdminGuides />}


        {/* News Manager */}
        {section === "news" && <AdminNews />}

        {/* Audit Log */}
        {section === "audit-log" && <AdminAuditLog />}

        {/* Bundles */}
        {section === "bundles" && <AdminBundles />}

        {/* Giveaways */}
      {section === "giveaways" && (
        <div className="space-y-6">
          <AdminGiveaways />
          
          <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Free Gift Program
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Manage which products are available for the one-time "Free Gift" claim program. 
              Users who haven't claimed a gift yet will see the banner on the homepage.
            </p>
            
            <AdminFreeGiftSettings />
          </div>
        </div>
      )}

        {/* Rate Limiting */}
        {section === "rate-limiting" && <AdminRateLimiting />}
        {section === "customer-suggestions" && <AdminCustomerSuggestions />}

        {/* Overpriced Cards */}
        {section === "overpriced-cards" && <AdminOverpricedCards />}

        {/* IndexNow */}
        {section === "indexnow" && <AdminIndexNow />}

        {/* Kinguin Sync Status */}
        {section === "kinguin-sync" && <AdminKinguinSync />}

        {/* Title Reformatter */}
        {section === "title-reformatter" && <AdminTitleReformatter />}

        {/* Receipts (Invoice Maven) */}
        {section === "receipts" && <AdminReceiptsSettings />}

        {/* Sync Center — centralized hub for paraphrase, compression, stock & price sync */}
        {section === "sync-center" && <AdminSyncCenter />}
        {section === "analytics" && <AdminAnalytics />}
        {section === "function-health" && <AdminFunctionHealth />}
        {section === "email-provider" && <AdminEmailProvider />}
        {section === "email-logs" && <AdminEmailLogs />}
        {section === "marketing-emails" && <AdminMarketingEmails />}
        {section === "trending-research" && <AdminTrendingResearch />}
        {section === "game-plays" && <AdminGamePlays />}
        {section === "pending-paypal" && <AdminPendingPayPalOrders />}
      </div>
      <AgeverBot />
      <ParaphraseQueuePanel />
    </div>);

};

export default AdminSection;