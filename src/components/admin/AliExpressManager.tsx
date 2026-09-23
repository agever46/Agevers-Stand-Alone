import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, Download, Loader2, ExternalLink, Check, Package, Key, RefreshCw, Copy, CheckCircle, XCircle, Clock, Truck, Eye, Image, FileText, List } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DOMPurify from "dompurify";

const ALIEXPRESS_CATEGORIES = [
  { id: "", label: "All Categories" },
  { id: "200001081", label: "Computer Peripherals (keyboards, mice)" },
  { id: "200048142", label: "DIY Gaming Computer" },
  { id: "100000310", label: "Games & Accessories" },
  { id: "200001076", label: "Computer Components" },
  { id: "200001077", label: "Networking" },
  { id: "200001074", label: "Storage Devices" },
  { id: "200003803", label: "Smart Electronics" },
  { id: "629", label: "Electronics Accessories" },
  { id: "100000308", label: "Home Audio & Video" },
  { id: "200386159", label: "High Tech Toys" },
];

const SHIPPING_COUNTRIES = [
  { code: "US", label: "🇺🇸 USA" },
  { code: "GB", label: "🇬🇧 UK" },
  { code: "DE", label: "🇩🇪 Germany" },
  { code: "FR", label: "🇫🇷 France" },
  { code: "IL", label: "🇮🇱 Israel" },
  { code: "NL", label: "🇳🇱 Netherlands" },
  { code: "ES", label: "🇪🇸 Spain" },
  { code: "IT", label: "🇮🇹 Italy" },
  { code: "AU", label: "🇦🇺 Australia" },
  { code: "CA", label: "🇨🇦 Canada" },
  { code: "BR", label: "🇧🇷 Brazil" },
  { code: "AE", label: "🇦🇪 UAE" },
  { code: "SA", label: "🇸🇦 Saudi Arabia" },
  { code: "PL", label: "🇵🇱 Poland" },
  { code: "SE", label: "🇸🇪 Sweden" },
];

interface ShippingOption {
  service_name: string;
  freight_amount: string;
  delivery_days: string;
  currency: string;
}

interface AliProduct {
  product_id: string;
  product_title: string;
  product_main_image_url: string;
  target_sale_price: string;
  target_original_price: string;
  sale_price: string;
  original_price: string;
  evaluate_rate: string;
  orders_count?: number;
  product_detail_url?: string;
}

interface TokenStatus {
  has_token: boolean;
  token_preview: string | null;
  has_refresh: boolean;
  token_expires_at: string | null;
  refresh_expires_at: string | null;
  updated_at: string | null;
}

const normalizeAliExpressRatingToStars = (value?: string | number | null): number | null => {
  if (value == null || value === "") return null;

  const rate = typeof value === "number"
    ? value
    : parseFloat(String(value).replace("%", "").trim());

  if (Number.isNaN(rate)) return null;
  if (rate <= 1) return rate * 5;
  if (rate <= 5) return rate;
  return rate / 20;
};

const cleanVariationPreviewName = (rawName: string, index = 0): string => {
  const fallback = `Style ${String.fromCharCode(65 + (index % 26))}`;
  const normalized = String(rawName || "")
    .replace(/\b\d+(?:[:#._-]\d+)+(?:#)?\b/g, " ")
    .replace(/\b[a-z]*\d+[a-z\d:_-]*\b/gi, " ")
    .replace(/#[^\s]+/g, " ")
    .replace(/[|;,]+/g, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\b(mech|ember|edition|version|model|style|default|option|color|colour|size)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!normalized || /^[^a-zA-Z]+$/.test(normalized)) return fallback;

  const renamed: Record<string, string> = {
    white: "Arctic White",
    black: "Charcoal Black",
    grey: "Graphite Gray",
    gray: "Graphite Gray",
    "shadow ember": "Charcoal Black",
    "mech white": "Arctic White",
    "sakura pink": "Rose Pink",
  };

  const key = normalized.toLowerCase();
  if (renamed[key]) return renamed[key];

  return normalized
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const normalizeAliImageUrl = (value?: string | null) => {
  if (!value) return null;
  return value.startsWith("//") ? `https:${value}` : value;
};

const AliExpressManager = () => {
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [allResults, setAllResults] = useState<AliProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());

  // Load already-imported AliExpress product IDs from DB
  useEffect(() => {
    const loadImported = async () => {
      const { data } = await supabase
        .from("allowed_products")
        .select("aliexpress_product_id")
        .not("aliexpress_product_id", "is", null);
      if (data) {
        setImported(new Set(data.map((r) => r.aliexpress_product_id!).filter(Boolean)));
      }
    };
    loadImported();
  }, []);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [sortBy, setSortBy] = useState("RELEVANCE");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [minOrders, setMinOrders] = useState("");
  const [shippingCountry, setShippingCountry] = useState("IL");
  const [shippingData, setShippingData] = useState<Record<string, ShippingOption[]>>({});
  const [shippingLoading, setShippingLoading] = useState<Set<string>>(new Set());
  const [authCode, setAuthCode] = useState("");
  const [refreshTokenInput, setRefreshTokenInput] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenResult, setTokenResult] = useState<any>(null);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [stockData, setStockData] = useState<Record<string, number | null>>({});
  const [markupPct, setMarkupPct] = useState("50");

  // Reactive filtering by rating and orders
  const results = useMemo(() => {
    let filtered = [...allResults];
    if (minRating && minRating !== "all") {
      const minR = parseFloat(minRating);
      filtered = filtered.filter((p) => {
        const rate = normalizeAliExpressRatingToStars(p.evaluate_rate);
        if (rate == null) return false;
        return rate >= minR;
      });
    }
    if (minOrders && minOrders !== "all") {
      const minO = parseInt(minOrders);
      filtered = filtered.filter((p) => (p.orders_count || 0) >= minO);
    }
    return filtered;
  }, [allResults, minRating, minOrders]);

  const appKey = "530956"; // Public app key for auth URL

  const fetchTokenStatus = async () => {
    try {
      const { data } = await supabase.functions.invoke("aliexpress-api", {
        body: { action: "token_status" },
      });
      if (data) setTokenStatus(data);
    } catch {}
  };

  useEffect(() => { fetchTokenStatus(); }, []);

  const handleExchangeToken = async () => {
    if (!authCode.trim()) return;
    setTokenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("aliexpress-api", {
        body: { action: "exchange_token", code: authCode.trim() },
      });
      if (error) throw new Error(error.message);
      setTokenResult(data);
      if (data?.access_token) {
        toast.success("Token received and saved automatically! ✅");
        fetchTokenStatus();
      } else {
        toast.error("No token received - check the code");
      }
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setTokenLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    if (!refreshTokenInput.trim()) return;
    setTokenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("aliexpress-api", {
        body: { action: "refresh_token", refresh_token: refreshTokenInput.trim() },
      });
      if (error) throw new Error(error.message);
      setTokenResult(data);
      if (data?.access_token) {
        toast.success("Token refreshed and saved! ✅");
        fetchTokenStatus();
      } else {
        toast.error("Refresh failed");
      }
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setTokenLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const fetchShipping = async (productId: string) => {
    setShippingLoading((prev) => new Set(prev).add(productId));
    try {
      const { data, error } = await supabase.functions.invoke("aliexpress-api", {
        body: { action: "shipping", product_id: productId, country_code: shippingCountry },
      });
      if (error) throw new Error(error.message);

      // Parse shipping response
      const responseKey = Object.keys(data || {})[0];
      const freightResult = data?.[responseKey]?.result || data?.[responseKey]?.data;
      let options: ShippingOption[] = [];

      const freightList = freightResult?.aeop_freight_calculate_result_for_buyer_d_t_o_list?.aeop_freight_calculate_result_for_buyer_dto
        || freightResult?.freight_list || [];

      if (Array.isArray(freightList)) {
        options = freightList.map((f: any) => ({
          service_name: f.service_name || f.logistics_name || "Standard",
          freight_amount: f.freight?.amount || f.freight_amount || f.shipping_fee || "0",
          delivery_days: f.estimated_delivery_time || f.delivery_days || f.time || "N/A",
          currency: f.freight?.currency_code || f.currency || "USD",
        }));
      }

      setShippingData((prev) => ({ ...prev, [productId]: options }));
      if (options.length === 0) {
        toast.info("No shipping options available for this country");
      }
    } catch (err: any) {
      toast.error("Shipping error: " + err.message);
    } finally {
      setShippingLoading((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const fetchAllShipping = async () => {
    if (results.length === 0) return;
    toast.info(`Checking shipping for ${results.length} products...`);
    for (const p of results) {
      await fetchShipping(p.product_id);
    }
    toast.success("Shipping check complete!");
  };

  const fetchProductDetail = async (productId: string) => {
    setDetailLoading(productId);
    try {
      const { data, error } = await supabase.functions.invoke("aliexpress-api", {
        body: { action: "product_detail", product_id: productId, ship_to_country: shippingCountry },
      });
      if (error) throw new Error(error.message);

      const responseKey = Object.keys(data || {})[0];
      const result = data?.[responseKey]?.result || data?.[responseKey]?.data || data;
      const skuList = result?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o || [];
      const totalStock = Array.isArray(skuList)
        ? skuList.reduce((sum: number, sku: any) => sum + Number(sku?.sku_available_stock || 0), 0)
        : null;

      setStockData((prev) => ({ ...prev, [productId]: totalStock }));

      const baseInfo = result?.ae_item_base_info_dto || {};
      const multimedia = result?.ae_multimedia_info_dto || {};
      const allImages = multimedia?.image_urls
        ? String(multimedia.image_urls).split(";").filter(Boolean).map((u: string) => u.startsWith("//") ? "https:" + u : u)
        : [];
      const description = baseInfo?.detail || baseInfo?.mobile_detail || "";
      const properties = result?.ae_item_properties?.ae_item_property || [];

      setDetailProduct({ ...result, _product_id: productId, _allImages: allImages, _description: description, _properties: properties });
      setShowDetailDialog(true);
    } catch (err: any) {
      toast.error("Failed to load details: " + err.message);
    } finally {
      setDetailLoading(null);
    }
  };

  const handleSearch = async (pageNo = 1) => {
    if (!keyword.trim()) return;
    setLoading(true);
    setPage(pageNo);
    try {
      const body: Record<string, string> = {
        action: "search",
        keyword: keyword.trim(),
        page_no: String(pageNo),
        page_size: "50",
        sort: sortBy,
      };
      if (categoryId && categoryId !== "all") body.category_id = categoryId;
      if (minPrice) body.min_price = minPrice;
      if (maxPrice) body.max_price = maxPrice;

      const { data, error } = await supabase.functions.invoke("aliexpress-api", {
        body,
      });

      if (error) throw new Error(error.message);
      setRawResponse(data);

      // Detect AliExpress API errors (token expired, rate limit, bad signature, etc.)
      const findError = (obj: any, depth = 0): { code?: string; msg?: string; sub_msg?: string } | null => {
        if (!obj || typeof obj !== "object" || depth > 4) return null;
        if (obj.error_response) return obj.error_response;
        if ((obj.code && obj.code !== "0" && obj.code !== 0) && (obj.msg || obj.message)) {
          return { code: String(obj.code), msg: obj.msg || obj.message, sub_msg: obj.sub_msg };
        }
        for (const k of Object.keys(obj)) {
          const nested = findError(obj[k], depth + 1);
          if (nested) return nested;
        }
        return null;
      };
      const apiError = findError(data);
      if (apiError) {
        const code = apiError.code || "";
        const baseMsg = apiError.sub_msg || apiError.msg || "Unknown AliExpress error";
        let friendly = baseMsg;
        if (/IllegalAccessToken|invalid.*token|expired/i.test(`${code} ${baseMsg}`)) {
          friendly = "AliExpress access token is invalid or expired. Go to the 'Authorization' tab and refresh the token (or run the OAuth flow again).";
        } else if (/IncompleteSignature|InvalidSignature/i.test(`${code} ${baseMsg}`)) {
          friendly = "AliExpress signature error. Check that ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET are correct.";
        } else if (/isv\.invalid-parameter|MissingParameter/i.test(code)) {
          friendly = `Invalid parameter sent to AliExpress: ${baseMsg}`;
        } else if (/call limited|flow.?limit|frequency/i.test(baseMsg)) {
          friendly = "AliExpress rate limit reached. Please wait a minute and try again.";
        }
        toast.error(`Search failed${code ? ` (${code})` : ""}: ${friendly}`, { duration: 10000 });
        setAllResults([]);
        setLoading(false);
        return;
      }

      // Parse response - AliExpress wraps in different keys depending on the method
      let products: AliProduct[] = [];
      const responseKey = Object.keys(data || {})[0];
      const responseData = data?.[responseKey];

      // text.search format: data.products.selection_search_product
      if (responseData?.data?.products?.selection_search_product) {
        const raw = responseData.data.products.selection_search_product;
        const totalCount = parseInt(responseData?.data?.total_record_count || responseData?.data?.totalRecordCount || "0") || 0;
        setTotalResults(totalCount);
        products = (Array.isArray(raw) ? raw : []).map((p: any) => ({
          product_id: p.itemId || p.product_id || "",
          product_title: p.title || p.product_title || "",
          product_main_image_url: p.itemMainPic ? (p.itemMainPic.startsWith("//") ? "https:" + p.itemMainPic : p.itemMainPic) : (p.product_main_image_url || ""),
          target_sale_price: p.targetSalePrice || p.target_sale_price || p.salePrice || "",
          target_original_price: p.targetOriginalPrice || p.target_original_price || p.originalPrice || "",
          sale_price: p.salePrice || p.sale_price || "",
          original_price: p.originalPrice || p.original_price || "",
          evaluate_rate: p.evaluateRate || p.evaluate_rate || "",
          orders_count: typeof p.orders === "string" ? parseInt(p.orders.replace(/[,+]/g, "")) || 0 : (p.orders_count || 0),
          product_detail_url: p.itemUrl ? (p.itemUrl.startsWith("//") ? "https:" + p.itemUrl : p.itemUrl) : (p.product_detail_url || ""),
        }));
      }
      // recommend.feed format: result.products (array)
      else if (responseData?.result?.products) {
        const raw = responseData.result.products;
        products = Array.isArray(raw) ? raw : [];
      } else if (responseData?.resp_result?.result?.products) {
        const raw = responseData.resp_result.result.products;
        products = Array.isArray(raw) ? raw : [];
      }

      if (pageNo > 1) {
        // Append, dedupe by product_id
        setAllResults((prev) => {
          const seen = new Set(prev.map((p) => p.product_id));
          const merged = [...prev];
          for (const p of products) {
            if (!seen.has(p.product_id)) {
              merged.push(p);
              seen.add(p.product_id);
            }
          }
          return merged;
        });
        if (products.length === 0) {
          toast.info("No more results.");
        }
      } else {
        setAllResults(products);
        if (products.length === 0) {
          toast.info("No products found. Try different keywords.");
        }
      }
    } catch (err: any) {
      toast.error("Search failed: " + err.message);
    } finally {
      setLoading(false);
    }
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
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map((p) => p.product_id)));
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    setImporting(true);
    try {
      const selectedProducts = results.filter((p) => selectedIds.has(p.product_id));
      toast.info(`Fetching full details for ${selectedProducts.length} products before import...`);

      const products = [];
      for (const p of selectedProducts) {
        let description = "";
        let allImages: string[] = [];
        let specs: string[] = [];
        let variations: any[] = [];

        try {
          const { data: detailData } = await supabase.functions.invoke("aliexpress-api", {
            body: { action: "product_detail", product_id: p.product_id, ship_to_country: shippingCountry },
          });
          const rKey = Object.keys(detailData || {})[0];
          const detail = detailData?.[rKey]?.result || detailData?.[rKey]?.data || {};

          // Extract description (strip HTML tags for clean text)
          const baseInfo = detail?.ae_item_base_info_dto || {};
          const rawDesc = baseInfo?.detail || baseInfo?.mobile_detail || "";
          description = rawDesc.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

          // Extract all images
          const multimedia = detail?.ae_multimedia_info_dto || {};
          if (multimedia?.image_urls) {
            allImages = String(multimedia.image_urls).split(";").filter(Boolean).map((u: string) => u.startsWith("//") ? "https:" + u : u);
          }

          // Extract specifications
          const props = detail?.ae_item_properties?.ae_item_property || [];
          specs = props.map((prop: any) => {
            const name = prop.attr_name || prop.attr_name_desc || "";
            const value = prop.attr_value || prop.attr_value_name || "";
            return name && value ? `${name}: ${value}` : "";
          }).filter(Boolean);

          // Extract SKU variations
          const skuList = detail?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o
            || detail?.aeop_ae_product_s_k_us?.aeop_ae_product_sku
            || [];
          const skuProps = detail?.ae_item_properties?.ae_item_property
            || detail?.aeop_ae_product_propertys?.aeop_ae_product_property
            || [];
          const propMap: Record<string, string> = {};
          for (const prop of skuProps) {
            const pid = prop.attr_name_id || prop.attr_id || prop.property_id;
            const vid = prop.attr_value_id || prop.value_id || prop.property_value_id;
            const name = prop.attr_value || prop.attr_value_name || prop.value_name || prop.property_value_definition_name || "";
            if (pid && vid) propMap[`${pid}:${vid}`] = name;
          }
          for (const sku of skuList) {
            const skuId = sku.sku_id || sku.id || "";
            if (!skuId) continue;
            const skuAttr = sku.sku_attr || sku.id || sku.aeop_s_k_u_property_list?.aeop_sku_property?.map((sp: any) => `${sp.sku_property_id}:${sp.property_value_id_long || sp.property_value_id}`).join(";") || "";
            const varParts = skuAttr.split(";").filter(Boolean).map((part: string) => propMap[part] || part);
            const varName = cleanVariationPreviewName(varParts.join(" / "), variations.length);
            const price = sku.offer_sale_price || sku.sku_price || null;
            const stock = sku.sku_available_stock ?? sku.s_k_u_available_stock ?? sku.ipm_sku_stock ?? 0;
            const skuImg = normalizeAliImageUrl(
              sku.sku_image
              || sku.sku_image_url
              || sku.image_url
              || sku.img_url
              || sku.aeop_s_k_u_property_list?.aeop_sku_property?.find((sp: any) => sp?.sku_property_image_path)?.sku_property_image_path
            );
            variations.push({
              sku_id: String(skuId),
              variation_name: varName,
              image_url: skuImg || null,
              price: price ? parseFloat(String(price).replace(/[^0-9.]/g, "")) : null,
              stock: Number(stock) || 0,
              sku_attr: skuAttr || null,
            });
          }
        } catch (e) {
          console.log(`[Import] Could not fetch details for ${p.product_id}:`, e);
        }

        // Build rich description - remove AliExpress references
        const descParts: string[] = [];
        if (description) {
          // Strip AliExpress branding from description
          const cleanDesc = description
            .replace(/aliexpress/gi, "")
            .replace(/ali\s*express/gi, "")
            .replace(/\bae\s*store\b/gi, "")
            .replace(/\bour\s+store\b/gi, "our shop")
            .replace(/\bdropship(ping)?\b/gi, "")
            .replace(/wish\s*list/gi, "favorites")
            .replace(/\s{2,}/g, " ")
            .trim();
          descParts.push(cleanDesc);
        }
        if (specs.length > 0) descParts.push("\n\nSpecifications:\n" + specs.join("\n"));
        const finalDescription = descParts.join("") || "";

        // Clean title - remove AliExpress-style junk words
        const cleanedTitle = p.product_title
          .replace(/\b(aliexpress|ali\s*express)\b/gi, "")
          .replace(/\b(dropship(ping)?|wholesale|cheap|hot\s*sale|free\s*shipping|in\s*stock)\b/gi, "")
          .replace(/\b\d+%\s*off\b/gi, "")
          .replace(/[!]{2,}/g, "")
          .replace(/\s{2,}/g, " ")
          .trim();

        products.push({
          title: cleanedTitle,
          image_url: p.product_main_image_url,
          description: finalDescription,
          aliexpress_product_id: p.product_id,
          price: (() => {
            const raw = p.target_original_price || p.original_price || p.target_sale_price || p.sale_price || "0";
            const cost = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
            const m = parseFloat(markupPct) || 50;
            return !isNaN(cost) ? (cost * (1 + m / 100)).toFixed(2) : raw;
          })(),
          screenshots: allImages.length > 0 ? allImages : undefined,
          variations: variations.length > 0 ? variations : undefined,
        });
      }

      const { data, error } = await supabase.functions.invoke("aliexpress-api", {
        body: { action: "import", products },
      });

      if (error) throw new Error(error.message);

      toast.success(`Imported ${data.imported} products into Gaming Accessories`);
      if (data.errors?.length > 0) {
        data.errors.forEach((e: string) => toast.error(e));
      }

      setImported((prev) => {
        const next = new Set(prev);
        selectedIds.forEach((id) => next.add(id));
        return next;
      });
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error("Import failed: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const authUrl = `https://api-sg.aliexpress.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=https://agevers-gamecodes.lovable.app&client_id=${appKey}`;

  return (
    <Tabs defaultValue="search" className="space-y-4">
      <TabsList>
        <TabsTrigger value="search" className="font-display text-xs">🔍 Product Search</TabsTrigger>
        <TabsTrigger value="auth" className="font-display text-xs">🔑 OAuth Token</TabsTrigger>
      </TabsList>

      <TabsContent value="auth" className="space-y-4">
        {/* Token Status */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <h3 className="text-sm font-display font-bold flex items-center gap-2">
            Token Status
            {tokenStatus?.has_token ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
          </h3>
          {tokenStatus ? (
            <div className="space-y-1 text-xs text-muted-foreground">
               <p>{tokenStatus.has_token ? `✅ Active token: ${tokenStatus.token_preview}` : "❌ No token saved"}</p>
              {tokenStatus.has_refresh && <p>🔄 Refresh token available</p>}
              {tokenStatus.token_expires_at && (
                <p className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expires: {new Date(tokenStatus.token_expires_at).toLocaleDateString("en-US")} {new Date(tokenStatus.token_expires_at).toLocaleTimeString("en-US")}
                </p>
              )}
              {tokenStatus.updated_at && <p>Last updated: {new Date(tokenStatus.updated_at).toLocaleString("en-US")}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Loading...</p>
          )}
        </div>

        <div className="rounded-lg border border-border p-4 space-y-4">
          <h3 className="text-sm font-display font-bold">Step 1: Get Authorization Code</h3>
          <p className="text-xs text-muted-foreground">
            Click the link below, authorize access, then copy the <code>code</code> from the redirect URL.
          </p>
          <a
            href={authUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-display"
          >
            <ExternalLink className="h-3 w-3" />
            Open AliExpress Authorization
          </a>

          <h3 className="text-sm font-display font-bold mt-4">Step 2: Exchange Code for Token</h3>
          <div className="flex gap-2">
            <Input
              placeholder="Paste the code from the URL here..."
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              className="font-display text-xs flex-1"
            />
            <Button onClick={handleExchangeToken} disabled={tokenLoading || !authCode.trim()} size="sm" className="font-display text-xs">
              {tokenLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Key className="h-4 w-4 mr-1" />}
              Get Token
            </Button>
          </div>

          <h3 className="text-sm font-display font-bold mt-4">Or: Refresh Existing Token</h3>
          <div className="flex gap-2">
            <Input
              placeholder="Paste refresh_token..."
              value={refreshTokenInput}
              onChange={(e) => setRefreshTokenInput(e.target.value)}
              className="font-display text-xs flex-1"
            />
            <Button onClick={handleRefreshToken} disabled={tokenLoading || !refreshTokenInput.trim()} size="sm" variant="outline" className="font-display text-xs">
              {tokenLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Refresh Token
            </Button>
          </div>

          {tokenResult && (
            <div className="mt-4 p-3 rounded-lg bg-muted space-y-2">
              {tokenResult.access_token && (
                <div className="space-y-1">
                  <p className="text-xs font-display font-bold text-foreground">Access Token:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] bg-background p-1 rounded border border-border break-all flex-1">
                      {tokenResult.access_token}
                    </code>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(tokenResult.access_token)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              {tokenResult.refresh_token && (
                <div className="space-y-1">
                  <p className="text-xs font-display font-bold text-foreground">Refresh Token:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] bg-background p-1 rounded border border-border break-all flex-1">
                      {tokenResult.refresh_token}
                    </code>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(tokenResult.refresh_token)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              {tokenResult.expires_in && (
                <p className="text-[10px] text-muted-foreground">Expires: {tokenResult.expires_in}</p>
              )}
              <details>
                <summary className="text-[10px] text-muted-foreground cursor-pointer">Raw Response</summary>
                <pre className="text-[10px] mt-1 overflow-auto max-h-32">{JSON.stringify(tokenResult.raw, null, 2)}</pre>
              </details>
              {tokenResult.saved_to_db ? (
                <p className="text-xs text-green-600 font-display mt-2">✅ Token saved automatically!</p>
              ) : (
                <p className="text-xs text-destructive font-display mt-2">⚠️ Auto-save failed - copy and save manually</p>
              )}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="search" className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search AliExpress (e.g. gaming headset, controller...)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(1)}
            className="pl-10 font-display text-sm"
          />
        </div>
        <Button onClick={() => handleSearch(1)} disabled={loading || !keyword.trim()} className="font-display text-xs">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
          Search
        </Button>
      </div>

      {/* Filters row */}
      <div className="flex items-end gap-3 flex-wrap p-3 rounded-lg border border-border bg-muted/30">
        <div className="space-y-1">
          <label className="text-[10px] font-display text-muted-foreground">Category</label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-[200px] font-display text-xs h-8">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {ALIEXPRESS_CATEGORIES.map((cat) => (
                <SelectItem key={cat.id || "all"} value={cat.id || "all"} className="font-display text-xs">
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-display text-muted-foreground">Sort By</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] font-display text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RELEVANCE" className="font-display text-xs">Relevance</SelectItem>
              <SelectItem value="min_price" className="font-display text-xs">Price: Low → High</SelectItem>
              <SelectItem value="max_price" className="font-display text-xs">Price: High → Low</SelectItem>
              <SelectItem value="orders" className="font-display text-xs">Orders (Popular)</SelectItem>
              <SelectItem value="comments" className="font-display text-xs">Comments</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-display text-muted-foreground">Min Rating</label>
          <Select value={minRating} onValueChange={setMinRating}>
            <SelectTrigger className="w-[100px] font-display text-xs h-8">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-display text-xs">All</SelectItem>
              <SelectItem value="4" className="font-display text-xs">⭐ 4.0+</SelectItem>
              <SelectItem value="4.5" className="font-display text-xs">⭐ 4.5+</SelectItem>
              <SelectItem value="4.7" className="font-display text-xs">⭐ 4.7+</SelectItem>
              <SelectItem value="4.9" className="font-display text-xs">⭐ 4.9+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-display text-muted-foreground">Min Orders</label>
          <Select value={minOrders} onValueChange={setMinOrders}>
            <SelectTrigger className="w-[110px] font-display text-xs h-8">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-display text-xs">All</SelectItem>
              <SelectItem value="50" className="font-display text-xs">50+</SelectItem>
              <SelectItem value="100" className="font-display text-xs">100+</SelectItem>
              <SelectItem value="500" className="font-display text-xs">500+</SelectItem>
              <SelectItem value="1000" className="font-display text-xs">1,000+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-1.5">
          <div className="space-y-1">
            <label className="text-[10px] font-display text-muted-foreground">Min Price (€)</label>
            <Input
              type="number"
              placeholder="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-[70px] font-display text-xs h-8"
            />
          </div>
          <span className="text-xs text-muted-foreground pb-1">—</span>
          <div className="space-y-1">
            <label className="text-[10px] font-display text-muted-foreground">Max Price (€)</label>
            <Input
              type="number"
              placeholder="∞"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-[70px] font-display text-xs h-8"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-display text-muted-foreground">💰 Markup %</label>
          <Input
            type="number"
            placeholder="50"
            value={markupPct}
            onChange={(e) => setMarkupPct(e.target.value)}
            className="w-[70px] font-display text-xs h-8"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-display text-muted-foreground">🚚 Shipping Country</label>
          <div className="flex items-end gap-1.5">
            <Select value={shippingCountry} onValueChange={(v) => { setShippingCountry(v); setShippingData({}); }}>
              <SelectTrigger className="w-[140px] font-display text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIPPING_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="font-display text-xs">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchAllShipping} disabled={results.length === 0} className="font-display text-[10px] h-8">
              <Truck className="h-3 w-3 mr-1" />
              Check All Shipping
            </Button>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="flex items-center gap-3 mb-2">
          <Button variant="outline" size="sm" onClick={selectAll} className="font-display text-xs">
            {selectedIds.size === results.length ? "Deselect All" : "Select All"}
          </Button>
          <Button
            size="sm"
            disabled={selectedIds.size === 0 || importing}
            onClick={handleImport}
            className="font-display text-xs"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Import {selectedIds.size} to Gaming Accessories
          </Button>
          <span className="text-xs text-muted-foreground font-display">
            {results.length} shown{totalResults > 0 ? ` / ${totalResults} total` : ""} | Page {page}{totalResults > 0 ? ` of ${Math.ceil(totalResults / 50)}` : ""}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || (totalResults > 0 && page >= Math.ceil(totalResults / 50))}
            onClick={() => handleSearch(page + 1)}
            className="font-display text-xs"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Load More (Page {page + 1})
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {results.map((product) => {
          const isSelected = selectedIds.has(product.product_id);
          const isImported = imported.has(product.product_id);
          const rawPrice = product.target_original_price || product.original_price || product.target_sale_price || product.sale_price || "N/A";
          const costNum = parseFloat(String(rawPrice).replace(/[^0-9.]/g, ""));
          const markup = parseFloat(markupPct) || 50;
          const sellPrice = !isNaN(costNum) ? (costNum * (1 + markup / 100)).toFixed(2) : "N/A";
          const normalizedRating = normalizeAliExpressRatingToStars(product.evaluate_rate);

          return (
            <div
              key={product.product_id}
              onClick={() => !isImported && toggleSelect(product.product_id)}
              className={`relative rounded-xl overflow-hidden border cursor-pointer transition-all ${
                isImported
                  ? "border-green-500/50 opacity-60 cursor-default"
                  : isSelected
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border/50 hover:border-primary/50"
              }`}
            >
              {/* Checkbox */}
              <div className="absolute top-2 left-2 z-10">
                {isImported ? (
                  <div className="h-5 w-5 rounded bg-green-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                ) : (
                  <Checkbox checked={isSelected} className="bg-background/80" />
                )}
              </div>

              {/* Image */}
              <div className="aspect-square overflow-hidden bg-muted">
                {product.product_main_image_url ? (
                  <img
                    src={product.product_main_image_url}
                    alt={product.product_title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2.5 space-y-1">
                <p className="text-xs font-display font-semibold text-foreground line-clamp-2 leading-tight">
                  {product.product_title}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-primary font-display">€{sellPrice}</span>
                  <span className="text-[10px] text-muted-foreground">(cost: €{rawPrice})</span>
                </div>
                {normalizedRating !== null && (
                  <p className="text-[10px] text-muted-foreground">
                    ⭐ {normalizedRating.toFixed(1)}/5 {product.orders_count ? `• ${product.orders_count} orders` : ""}
                  </p>
                )}
                {stockData[product.product_id] !== undefined && (
                  <p className="text-[10px] text-muted-foreground">
                    📦 Stock: <span className="font-semibold text-foreground">{stockData[product.product_id] ?? "—"}</span>
                  </p>
                )}
                {product.product_detail_url && (
                  <a
                    href={product.product_detail_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                    View on AliExpress
                  </a>
                )}
                {/* Shipping info */}
                {shippingData[product.product_id] ? (
                  <div className="mt-1 p-1.5 rounded bg-muted/50 space-y-0.5">
                    <p className="text-[10px] font-display font-semibold text-foreground flex items-center gap-1">
                      <Truck className="h-2.5 w-2.5" /> Shipping to {SHIPPING_COUNTRIES.find(c => c.code === shippingCountry)?.label || shippingCountry}:
                    </p>
                    {shippingData[product.product_id].length > 0 ? (
                      shippingData[product.product_id].slice(0, 3).map((s, i) => (
                        <p key={i} className="text-[9px] text-muted-foreground">
                          {s.service_name}: <span className="font-semibold text-foreground">${s.freight_amount}</span>
                          {s.delivery_days !== "N/A" && ` • ${s.delivery_days} days`}
                        </p>
                      ))
                    ) : (
                      <p className="text-[9px] text-muted-foreground">No shipping available</p>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[9px] px-1.5 mt-0.5 font-display"
                    disabled={shippingLoading.has(product.product_id)}
                    onClick={(e) => { e.stopPropagation(); fetchShipping(product.product_id); }}
                  >
                    {shippingLoading.has(product.product_id) ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin mr-0.5" />
                    ) : (
                      <Truck className="h-2.5 w-2.5 mr-0.5" />
                    )}
                    Check Shipping
                  </Button>
                )}
                {/* View Details button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-5 text-[9px] px-1.5 mt-0.5 font-display w-full"
                  disabled={detailLoading === product.product_id}
                  onClick={(e) => { e.stopPropagation(); fetchProductDetail(product.product_id); }}
                >
                  {detailLoading === product.product_id ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin mr-0.5" />
                  ) : (
                    <Eye className="h-2.5 w-2.5 mr-0.5" />
                  )}
                  View Details
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Product Detail / Variations Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-sm">Product Details</DialogTitle>
          </DialogHeader>
          {detailProduct && (
            <div className="space-y-4">
              <p className="text-xs font-display font-semibold">{detailProduct.product_title || detailProduct.subject || "Product"}</p>

              {/* All Product Images */}
              {detailProduct._allImages?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-display font-bold flex items-center gap-1"><Image className="h-3 w-3" /> Product Images ({detailProduct._allImages.length})</h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {detailProduct._allImages.map((img: string, i: number) => (
                      <img key={i} src={img} alt={`Product image ${i + 1}`} className="h-24 w-24 rounded-lg object-cover border border-border flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => window.open(img, "_blank")} />
                    ))}
                  </div>
                </div>
              )}

              {/* Specifications / Properties */}
              {detailProduct._properties?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-display font-bold flex items-center gap-1"><List className="h-3 w-3" /> Specifications</h4>
                  <div className="grid grid-cols-2 gap-1 p-2 rounded-lg bg-muted/50 border border-border">
                    {detailProduct._properties.map((prop: any, i: number) => {
                      const name = prop.attr_name || prop.attr_name_desc || prop.property_name || `Attr ${i}`;
                      const value = prop.attr_value || prop.attr_value_name || prop.property_value_definition_name || "—";
                      return (
                        <div key={i} className="flex gap-1 text-[10px]">
                          <span className="text-muted-foreground font-display">{name}:</span>
                          <span className="text-foreground font-display font-medium">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description (HTML) */}
              {detailProduct._description && (
                <div className="space-y-2">
                  <h4 className="text-xs font-display font-bold flex items-center gap-1"><FileText className="h-3 w-3" /> Description</h4>
                  <div className="text-[11px] text-muted-foreground border border-border rounded-lg p-3 max-h-60 overflow-y-auto prose prose-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detailProduct._description) }} />
                </div>
              )}

              {/* SKU Variations */}
              {(() => {
                const skuList = detailProduct.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o
                  || detailProduct.aeop_ae_product_s_k_us?.aeop_ae_product_sku
                  || detailProduct.ae_sku_info?.aeop_s_k_u_property
                  || [];
                const skuProps = detailProduct.ae_item_properties?.ae_item_property
                  || detailProduct.aeop_ae_product_propertys?.aeop_ae_product_property
                  || [];

                // Build property value map: { "200007763:201336100": "Black" }
                const propMap: Record<string, string> = {};
                for (const prop of skuProps) {
                  const pid = prop.attr_name_id || prop.attr_id || prop.property_id;
                  const vid = prop.attr_value_id || prop.value_id || prop.property_value_id;
                  const name = prop.attr_value || prop.attr_value_name || prop.value_name || prop.property_value_definition_name || "";
                  if (pid && vid) propMap[`${pid}:${vid}`] = name;
                }

                if (skuList.length === 0) {
                  return <p className="text-xs text-muted-foreground">No variations found for this product.</p>;
                }

                return (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground font-display">{skuList.length} variation(s)</p>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left font-display">Variation</th>
                            <th className="p-2 text-left font-display">Image</th>
                            <th className="p-2 text-right font-display">Price</th>
                            <th className="p-2 text-right font-display">Stock</th>
                            <th className="p-2 text-right font-display">SKU ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {skuList.map((sku: any, i: number) => {
                            // Parse variation name from sku_attr or id
                            const skuAttr = sku.sku_attr || sku.id || sku.aeop_s_k_u_property_list?.aeop_sku_property?.map((p: any) => `${p.sku_property_id}:${p.property_value_id_long || p.property_value_id}`).join(";") || "";
                            const varParts = skuAttr.split(";").filter(Boolean).map((part: string) => propMap[part] || part);
                            const varName = cleanVariationPreviewName(varParts.join(" / "), i);
                            const price = sku.offer_sale_price || sku.sku_price || sku.aeop_s_k_u_property_list?.price || "—";
                            const stock = sku.sku_available_stock ?? sku.s_k_u_available_stock ?? sku.ipm_sku_stock ?? "—";
                            const skuId = sku.sku_id || sku.id || "";
                            const skuImg = normalizeAliImageUrl(
                              sku.sku_image
                              || sku.sku_image_url
                              || sku.image_url
                              || sku.img_url
                              || sku.aeop_s_k_u_property_list?.aeop_sku_property?.find((sp: any) => sp?.sku_property_image_path)?.sku_property_image_path
                            );

                            return (
                              <tr key={i} className="border-t border-border">
                                <td className="p-2 font-display text-foreground">{varName}</td>
                                <td className="p-2">
                                  {skuImg ? (
                                    <img src={skuImg.startsWith("//") ? "https:" + skuImg : skuImg} className="h-8 w-8 rounded object-cover" alt="" />
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="p-2 text-right font-display font-semibold text-primary">€{price}</td>
                                <td className="p-2 text-right font-display">{stock}</td>
                                <td className="p-2 text-right font-display text-muted-foreground text-[10px]">{skuId}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Raw detail debug */}
              <details>
                <summary className="text-[10px] text-muted-foreground cursor-pointer font-display">Raw Detail Response</summary>
                <pre className="text-[9px] mt-1 overflow-auto max-h-48 bg-muted p-2 rounded">{JSON.stringify(detailProduct, null, 2)}</pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Debug: Raw response (admin only) */}
      {rawResponse && results.length === 0 && !loading && (
        <details className="mt-4">
          <summary className="text-xs text-muted-foreground font-display cursor-pointer">
            Debug: Raw API Response
          </summary>
          <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-64">
            {JSON.stringify(rawResponse, null, 2)}
          </pre>
        </details>
      )}
      </TabsContent>
    </Tabs>
  );
};

export default AliExpressManager;
