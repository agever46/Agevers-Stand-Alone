import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYNC_API_BASE = "https://api-sg.aliexpress.com/sync";
const REST_API_BASE = "https://api-sg.aliexpress.com/rest";

const SUPPLIER_WORDS = [
  "aliexpress",
  "choice",
  "edition",
  "version",
  "model",
  "style",
  "bundle",
  "default",
  "option",
  "type",
  "color",
  "colour",
  "size",
  "plug",
  "ships from",
];

const VARIATION_RENAMES: Record<string, string> = {
  "mech white": "Arctic White",
  "shadow ember": "Charcoal Black",
  "sakura pink": "Rose Pink",
  "ice blue": "Frost Blue",
  "midnight black": "Midnight Black",
  "obsidian black": "Obsidian Black",
  "ash black": "Slate Black",
  "silver gray": "Silver Gray",
  "silver grey": "Silver Gray",
  "space gray": "Graphite Gray",
  "space grey": "Graphite Gray",
  "gun gray": "Gunmetal Gray",
  "gun grey": "Gunmetal Gray",
  "sky blue": "Sky Blue",
  "mint green": "Mint Green",
  "forest green": "Forest Green",
  "lavender purple": "Lavender",
  "mecha white": "Arctic White",
  "white": "Arctic White",
  "black": "Charcoal Black",
  "gray": "Graphite Gray",
  "grey": "Graphite Gray",
};

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sanitizeVariationName(rawName: string, index = 0): string {
  const original = String(rawName || "").trim();
  if (!original) return `Style ${String.fromCharCode(65 + (index % 26))}`;

  let cleaned = original
    .replace(/\b\d+(?:[:#._-]\d+)+(?:#)?\b/g, " ")
    .replace(/\bsku\b[^\s]*/gi, " ")
    .replace(/#[^\s]+/g, " ")
    .replace(/\b[a-z]*\d+[a-z\d:_-]*\b/gi, " ")
    .replace(/[|;,]+/g, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[+]/g, " ")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const parts = cleaned
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^\d+$/.test(part))
    .filter((part) => !SUPPLIER_WORDS.includes(part.toLowerCase()));

  cleaned = parts.join(" ").trim();
  const normalized = cleaned.toLowerCase();

  if (!cleaned || /^[^a-zA-Z]+$/.test(cleaned)) {
    return `Style ${String.fromCharCode(65 + (index % 26))}`;
  }

  if (VARIATION_RENAMES[normalized]) {
    return VARIATION_RENAMES[normalized];
  }

  if (cleaned.split(/\s+/).length > 3) {
    cleaned = cleaned.split(/\s+/).slice(0, 3).join(" ");
  }

  return toTitleCase(cleaned);
}

function sanitizeVariationList(variations: any[]): any[] {
  const usedNames = new Set<string>();

  return variations.map((variation, index) => {
    const baseName = sanitizeVariationName(variation?.variation_name || variation?.sku_attr || "", index);
    let finalName = baseName;
    let dup = 1;

    while (usedNames.has(finalName.toLowerCase())) {
      dup += 1;
      finalName = `${baseName} ${dup}`;
    }

    usedNames.add(finalName.toLowerCase());

    return {
      ...variation,
      variation_name: finalName,
    };
  });
}

function normalizeAliImageUrl(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeAliImageUrl(item);
      if (normalized) return normalized;
    }
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidates = [
      record.url,
      record.image_url,
      record.img_url,
      record.sku_image,
      record.sku_image_url,
      record.sku_property_image_path,
      record.property_value_image,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeAliImageUrl(candidate);
      if (normalized) return normalized;
    }
  }

  return null;
}

function extractAliSkuImage(sku: any, skuProps: any[] = []): string | null {
  const directCandidates = [
    sku?.sku_image,
    sku?.sku_image_url,
    sku?.image_url,
    sku?.img_url,
    sku?.sku_big_image,
    sku?.aeop_sku_image,
    sku?.aeop_sku_image_url,
    sku?.sku_image_list,
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeAliImageUrl(candidate);
    if (normalized) return normalized;
  }

  const skuPropertyList = sku?.aeop_s_k_u_property_list?.aeop_sku_property
    || sku?.ae_sku_property_dtos?.ae_sku_property_d_t_o
    || sku?.sku_property_list
    || [];

  for (const property of skuPropertyList) {
    const normalized = normalizeAliImageUrl(
      property?.sku_image
      || property?.sku_property_image_path
      || property?.property_value_image
      || property?.image_url
      || property?.img_url
    );

    if (normalized) return normalized;
  }

  const propertyPairs = new Set(
    skuPropertyList
      .map((property: any) => {
        const pid = property?.sku_property_id || property?.property_id || property?.attr_name_id;
        const vid = property?.property_value_id_long || property?.property_value_id || property?.value_id || property?.attr_value_id;
        return pid && vid ? `${pid}:${vid}` : null;
      })
      .filter(Boolean)
  );

  for (const property of skuProps) {
    const pid = property?.attr_name_id || property?.attr_id || property?.property_id;
    const vid = property?.attr_value_id || property?.value_id || property?.property_value_id;
    const pair = pid && vid ? `${pid}:${vid}` : null;

    if (pair && propertyPairs.has(pair)) {
      const normalized = normalizeAliImageUrl(
        property?.sku_property_image_path
        || property?.property_value_image
        || property?.image_url
        || property?.img_url
        || property?.attr_value_pic
      );

      if (normalized) return normalized;
    }
  }

  return null;
}

function generateSign(
  params: Record<string, string>,
  appSecret: string
): string {
  const payload = { ...params };
  let baseString = "";

  if (typeof payload.method === "string" && payload.method.includes("/")) {
    baseString = payload.method;
    delete payload.method;
  }

  baseString += Object.entries(payload)
    .filter(([, value]) => value != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((acc, [key, value]) => acc + key + String(value), "");

  console.log("[AliExpress] sign baseString:", baseString.substring(0, 300));

  return createHmac("sha256", appSecret).update(baseString, "utf8").digest("hex").toUpperCase();
}

async function callAliExpress(
  method: string,
  bizParams: Record<string, string>,
  sessionToken?: string | null
): Promise<any> {
  const appKey = Deno.env.get("ALIEXPRESS_APP_KEY")?.trim();
  const appSecret = Deno.env.get("ALIEXPRESS_APP_SECRET")?.trim();
  if (!appKey || !appSecret) throw new Error("AliExpress credentials not configured");

  const systemParams: Record<string, string> = {
    app_key: appKey,
    method,
    sign_method: "sha256",
    timestamp: String(Date.now()),
    ...bizParams,
  };

  // Use provided session token or fall back to env
  const accessToken = sessionToken || Deno.env.get("ALIEXPRESS_ACCESS_TOKEN") || Deno.env.get("ALIEXPRESS_SESSION");
  if (accessToken) {
    systemParams.session = accessToken;
  }

  console.log("[AliExpress] method:", method);
  console.log("[AliExpress] params keys:", Object.keys(systemParams).sort().join(", "));

  const signPreview = Object.entries(systemParams)
    .filter(([, value]) => value != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}${String(value)}`)
    .join("");
  // Sign payload intentionally not logged: it embeds the session access token.

  console.log("[AliExpress] token configured:", Boolean(accessToken));

  const sign = generateSign(systemParams, appSecret);
  systemParams.sign = sign;
  console.log("[AliExpress] sign:", sign);

  const baseUrl = method.includes("/") ? `${REST_API_BASE}${method}` : SYNC_API_BASE;
  const query = Object.entries(systemParams)
    .filter(([, value]) => value != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");

  console.log("[AliExpress] calling:", baseUrl);

  const resp = await fetch(`${baseUrl}?${query}`, { method: "POST" });
  const respText = await resp.text();
  console.log("[AliExpress] response status:", resp.status, "body:", respText.substring(0, 500));

  try {
    return JSON.parse(respText);
  } catch {
    throw new Error(`AliExpress API ${resp.status}: ${respText}`);
  }
}

// --- Simple per-IP rate limit for the unauthenticated shipping quote ---
const publicShippingHits = new Map<string, number[]>();
function allowPublicShipping(ip: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const hits = (publicShippingHits.get(ip) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    publicShippingHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  publicShippingHits.set(ip, hits);
  if (publicShippingHits.size > 5000) publicShippingHits.clear();
  return true;
}

// --- Get access token from DB or env ---
async function getAccessToken(supabaseAdmin: any): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("aliexpress_config")
      .select("access_token, token_expires_at")
      .eq("id", 1)
      .single();
    if (data?.access_token) {
      console.log("[AliExpress] Using token from DB, expires:", data.token_expires_at);
      return data.access_token;
    }
  } catch (e) {
    console.log("[AliExpress] No DB token, falling back to env");
  }
  return Deno.env.get("ALIEXPRESS_ACCESS_TOKEN") || Deno.env.get("ALIEXPRESS_SESSION") || null;
}

// --- Save token to DB ---
async function saveTokenToDB(supabaseAdmin: any, accessToken: string, refreshToken: string | null, expiresIn: number | null, refreshExpiresIn: number | null) {
  const update: Record<string, any> = {
    access_token: accessToken,
    updated_at: new Date().toISOString(),
  };
  if (refreshToken) update.refresh_token = refreshToken;
  if (expiresIn) update.token_expires_at = new Date(Date.now() + expiresIn).toISOString();
  if (refreshExpiresIn) update.refresh_expires_at = new Date(Date.now() + refreshExpiresIn).toISOString();

  const { error } = await supabaseAdmin
    .from("aliexpress_config")
    .update(update)
    .eq("id", 1);
  if (error) console.error("[AliExpress] Failed to save token to DB:", error.message);
  else console.log("[AliExpress] Token saved to DB successfully");
}

// --- Auth check ---
async function verifyAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return false;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return false;

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "super_admin"])
    .limit(1);
  return (data && data.length > 0) || false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, ...params } = await req.json();

    // --- Public endpoint: shipping quote for a publicly listed product only ---
    // The supplier access token is used server-side and never returned. Access is
    // narrowed to active, publicly visible AliExpress products and rate limited
    // per caller IP so the endpoint cannot be used to drain the supplier quota.
    if (action === "public_shipping") {
      const { allowed_product_id, country_code = "US", quantity = "1", sku_id } = params;
      if (!allowed_product_id) throw new Error("allowed_product_id required");

      const callerIp =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-real-ip") ||
        (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
        "unknown";
      if (!allowPublicShipping(callerIp)) {
        return new Response(JSON.stringify({ error: "Too many shipping requests, please slow down" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Look up the AliExpress product ID from the allowed_products table.
      // Only active (publicly listed) products may be quoted.
      const { data: product } = await supabaseAdmin
        .from("allowed_products")
        .select("aliexpress_product_id")
        .eq("id", allowed_product_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!product?.aliexpress_product_id) {
        return new Response(JSON.stringify({ shipping_options: [], message: "Not an AliExpress product" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sessionToken = await getAccessToken(supabaseAdmin);

      // Auto-fetch default SKU if not provided
      let resolvedSkuId = sku_id;
      if (!resolvedSkuId) {
        try {
          const detailResult = await callAliExpress("aliexpress.ds.product.get", {
            product_id: product.aliexpress_product_id,
            ship_to_country: String(country_code),
            target_currency: "EUR",
            target_language: "EN",
          }, sessionToken);
          const productInfo = detailResult?.aliexpress_ds_product_get_response?.result;
          const skuList = productInfo?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o || [];
          if (skuList.length > 0) {
            resolvedSkuId = skuList[0].sku_id || skuList[0].id;
          }
        } catch (e) {
          console.log("[AliExpress] Could not auto-fetch SKU:", e);
        }
      }

      const deliveryReq: Record<string, string | number> = {
        productId: product.aliexpress_product_id,
        countryCode: String(country_code),
        shipToCountry: String(country_code),
        quantity: Number(quantity),
        productNum: Number(quantity),
        sendGoodsCountryCode: "CN",
        locale: "en_US",
        language: "en_US",
        currency: "EUR",
      };
      if (resolvedSkuId) deliveryReq.selectedSkuId = String(resolvedSkuId);

      const result = await callAliExpress("aliexpress.ds.freight.query", {
        queryDeliveryReq: JSON.stringify(deliveryReq),
        language: "en_US",
      }, sessionToken);

      // Parse shipping options from response (supports both old and new API response formats)
      const freightResult = result?.aliexpress_ds_freight_query_response?.result;
      const oldOptions = freightResult?.aeop_freight_calculate_result_for_buyer_d_t_o_list?.aeop_freight_calculate_result_for_buyer_dto || [];
      const newOptions = freightResult?.delivery_options?.delivery_option_d_t_o || [];
      const options = newOptions.length > 0 ? newOptions : oldOptions;

      const shippingOptions = options.map((opt: any) => ({
        service_name: opt.company || opt.service_name || opt.code || "Standard",
        freight_amount: opt.shipping_fee_cent || opt.freight?.amount || "0.00",
        currency: opt.shipping_fee_currency || opt.freight?.currency || "EUR",
        estimated_delivery_time: opt.delivery_date_desc || opt.estimated_delivery_time || opt.time || null,
        tracking: opt.tracking === true || opt.tracking_available === "true" || opt.tracking_available === true,
        free_shipping: opt.free_shipping === true,
        min_days: opt.min_delivery_days || null,
        max_days: opt.max_delivery_days || null,
      }));

      return new Response(JSON.stringify({ shipping_options: shippingOptions, raw: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "public_variations") {
      const { allowed_product_id, ship_to_country = "US" } = params;
      if (!allowed_product_id) throw new Error("allowed_product_id required");

      const { data: product } = await supabaseAdmin
        .from("allowed_products")
        .select("aliexpress_product_id")
        .eq("id", allowed_product_id)
        .single();

      if (!product?.aliexpress_product_id) {
        return new Response(JSON.stringify({ variations: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sessionToken = await getAccessToken(supabaseAdmin);
      const detailResult = await callAliExpress("aliexpress.ds.product.get", {
        product_id: String(product.aliexpress_product_id),
        ship_to_country: String(ship_to_country),
        target_currency: "EUR",
        target_language: "EN",
      }, sessionToken);

      const responseKey = Object.keys(detailResult || {})[0];
      const detail = detailResult?.[responseKey]?.result || detailResult?.[responseKey]?.data || {};
      const skuList = detail?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o
        || detail?.aeop_ae_product_s_k_us?.aeop_ae_product_sku
        || [];
      const skuProps = detail?.ae_item_properties?.ae_item_property
        || detail?.aeop_ae_product_propertys?.aeop_ae_product_property
        || [];

      // Also try to get images from the product's main image list mapped by property values
      const productImages = detail?.ae_multimedia_info_dto?.image_urls?.split(";")
        || detail?.image_u_r_ls?.split(";")
        || [];


      const variations = skuList
        .map((sku: any, idx: number) => {
          const extracted = extractAliSkuImage(sku, skuProps);
          const fallbackImage = !extracted && productImages.length > idx
            ? normalizeAliImageUrl(productImages[idx])
            : null;
          return {
            sku_id: String(sku?.sku_id || sku?.id || ""),
            image_url: extracted || fallbackImage,
          };
        })
        .filter((variation: any) => variation.sku_id);

      return new Response(JSON.stringify({ variations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- OAuth token exchange ---
    if (action === "exchange_token") {
      const { code } = params;
      if (!code) throw new Error("authorization code is required");

      const appKey = Deno.env.get("ALIEXPRESS_APP_KEY")?.trim();
      const appSecret = Deno.env.get("ALIEXPRESS_APP_SECRET")?.trim();
      if (!appKey || !appSecret) throw new Error("AliExpress app credentials not configured");

      const tokenParams: Record<string, string> = {
        app_key: appKey,
        sign_method: "sha256",
        timestamp: String(Date.now()),
        code,
      };

      const sign = generateSign({ ...tokenParams, method: "/auth/token/create" }, appSecret);
      tokenParams.sign = sign;

      const query = Object.entries(tokenParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&");

      const url = `https://api-sg.aliexpress.com/rest/auth/token/create?${query}`;
      console.log("[AliExpress] token exchange: requesting token");

      const resp = await fetch(url, { method: "POST" });
      const respText = await resp.text();
      console.log("[AliExpress] token response received:", resp.status);

      let tokenData;
      try { tokenData = JSON.parse(respText); } catch { throw new Error(`Token API error: ${respText}`); }

      // Extract token from response
      const tokenResult = tokenData?.aliexpress_token_create_response || tokenData;
      const accessToken = tokenResult?.access_token;
      const refreshToken = tokenResult?.refresh_token;

      // Auto-save to DB
      if (accessToken) {
        await saveTokenToDB(supabaseAdmin, accessToken, refreshToken, 
          tokenResult?.expire_time ? Number(tokenResult.expire_time) : null,
          tokenResult?.refresh_token_valid_time ? Number(tokenResult.refresh_token_valid_time) : null);
      }

      return new Response(JSON.stringify({
        success: !!accessToken,
        access_token: accessToken || null,
        refresh_token: refreshToken || null,
        expires_in: tokenResult?.expire_time || null,
        saved_to_db: !!accessToken,
        raw: tokenData,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- OAuth token refresh ---
    if (action === "refresh_token") {
      const { refresh_token } = params;
      if (!refresh_token) throw new Error("refresh_token is required");

      const appKey = Deno.env.get("ALIEXPRESS_APP_KEY")?.trim();
      const appSecret = Deno.env.get("ALIEXPRESS_APP_SECRET")?.trim();
      if (!appKey || !appSecret) throw new Error("AliExpress app credentials not configured");

      const tokenParams: Record<string, string> = {
        app_key: appKey,
        sign_method: "sha256",
        timestamp: String(Date.now()),
        refresh_token,
      };

      const sign = generateSign({ ...tokenParams, method: "/auth/token/refresh" }, appSecret);
      tokenParams.sign = sign;

      const query = Object.entries(tokenParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&");

      const url = `https://api-sg.aliexpress.com/rest/auth/token/refresh?${query}`;
      const resp = await fetch(url, { method: "POST" });
      const respText = await resp.text();

      let tokenData;
      try { tokenData = JSON.parse(respText); } catch { throw new Error(`Refresh API error: ${respText}`); }

      const tokenResult = tokenData?.aliexpress_token_refresh_response || tokenData;
      const accessToken = tokenResult?.access_token;

      // Auto-save to DB
      if (accessToken) {
        await saveTokenToDB(supabaseAdmin, accessToken, tokenResult?.refresh_token || null,
          tokenResult?.expire_time ? Number(tokenResult.expire_time) : null, null);
      }

      return new Response(JSON.stringify({
        success: !!accessToken,
        access_token: accessToken || null,
        refresh_token: tokenResult?.refresh_token || null,
        expires_in: tokenResult?.expire_time || null,
        saved_to_db: !!accessToken,
        raw: tokenData,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Token status ---
    if (action === "token_status") {
      const { data } = await supabaseAdmin
        .from("aliexpress_config")
        .select("access_token, refresh_token, token_expires_at, refresh_expires_at, updated_at")
        .eq("id", 1)
        .single();
      return new Response(JSON.stringify({
        has_token: !!data?.access_token,
        token_preview: data?.access_token ? data.access_token.substring(0, 20) + "..." : null,
        has_refresh: !!data?.refresh_token,
        token_expires_at: data?.token_expires_at,
        refresh_expires_at: data?.refresh_expires_at,
        updated_at: data?.updated_at,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get session token from DB for API calls
    const sessionToken = await getAccessToken(supabaseAdmin);

    if (action === "search") {
      const { keyword, page_no = "1", page_size = "20", category_id, sort, min_price, max_price } = params;
      
      // Ensure keyword is properly trimmed and encoded
      const cleanKeyword = (keyword || "gaming").trim();
      
      const searchParams: Record<string, string> = {
        keyWord: cleanKeyword,
        currency: "EUR",
        local: "en_US",
        countryCode: "US",
        pageIndex: String(page_no),
        pageSize: String(page_size),
        sortBy: sort || "RELEVANCE",
      };
      if (category_id) searchParams.categoryId = String(category_id);
      if (min_price) searchParams.minPrice = String(min_price);
      if (max_price) searchParams.maxPrice = String(max_price);

      console.log("[AliExpress] text search keyWords:", cleanKeyword, "sortBy:", searchParams.sortBy);

      const result = await callAliExpress("aliexpress.ds.text.search", searchParams, sessionToken);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "product_detail") {
      const { product_id, ship_to_country = "US" } = params;
      if (!product_id) throw new Error("product_id required");

      const result = await callAliExpress("aliexpress.ds.product.get", {
        product_id: String(product_id),
        ship_to_country: String(ship_to_country),
        target_currency: "EUR",
        target_language: "EN",
      }, sessionToken);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import") {
      const { products } = params;
      if (!products || !Array.isArray(products) || products.length === 0) {
        throw new Error("products array required");
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: officialSeller } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["super_admin", "admin"])
        .limit(1)
        .maybeSingle();

      if (!officialSeller?.user_id) {
        throw new Error("No admin user found for Gaming Accessories imports");
      }

      const imported: string[] = [];
      const errors: string[] = [];

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

      for (const p of products) {
        try {
          const parsedPrice = Number(String(p.price ?? "").replace(/[^0-9.]/g, ""));
          if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
            throw new Error("Invalid product price");
          }

          // AI-paraphrase the title to look professional and unique
          let cleanTitle = p.title;
          if (LOVABLE_API_KEY) {
            try {
              const titleRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [
                    {
                      role: "system",
                      content: `You rewrite product titles for a premium gaming accessories e-commerce store. Return ONLY the new title, nothing else.

Rules:
- Keep all important product details: brand name, model, key features (wireless, Bluetooth, RGB, etc.), compatibility (PC/PS5/Xbox/Switch)
- Remove AliExpress-style fluff: "Hot Sale", "New Arrival", "Free Shipping", "Dropshipping", "2024/2025/2026", "High Quality", "Best Price"
- Remove excessive adjectives and marketing spam
- Make it concise, clean and professional (max 10-12 words)
- Use Title Case
- Do NOT add quotes around the title
- Keep the product type clear (Controller, Headset, Keyboard, Mouse, etc.)
- Example: "Wireless Bluetooth Gaming Controller for PS5 Xbox PC with RGB" → "Pro Wireless RGB Gaming Controller – PS5, Xbox & PC"`
                    },
                    { role: "user", content: p.title }
                  ],
                  max_tokens: 100,
                  temperature: 0.5,
                }),
              });
              if (titleRes.ok) {
                const titleData = await titleRes.json();
                const newTitle = titleData?.choices?.[0]?.message?.content?.trim();
                if (newTitle && newTitle.length > 5 && newTitle.length < 150) {
                  cleanTitle = newTitle;
                }
              }
            } catch (e) {
              console.log("[AliExpress Import] Title paraphrase failed:", e);
            }
          }

          // AI-format the description into clean bullet points
          let formattedDescription = p.description || null;
          if (formattedDescription && LOVABLE_API_KEY) {
            try {
              const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-lite",
                  messages: [
                    {
                      role: "system",
                      content: `You are a product description formatter for a gaming accessories e-commerce store. Your job is to take a messy, unformatted product description and restructure it into a clean, easy-to-read format.

Rules:
- Write a short 1-2 sentence product summary at the top
- Then list key features as bullet points using "• " prefix
- Group related specs together (e.g. Connectivity, Controls, Battery, Package Contents)
- Use section headers in CAPS followed by a colon for groups
- Remove ALL references to AliExpress, dropshipping, wholesale, "hot sale", "free shipping", store promotions
- Remove FAQ sections entirely
- Keep technical specs accurate - do not change any numbers or values
- Keep it concise but complete - no fluff
- Output plain text only, no markdown formatting
- Do NOT include any HTML tags
- Maximum 400 words`
                    },
                    { role: "user", content: `Format this product description:\n\n${formattedDescription}` }
                  ],
                  max_tokens: 1000,
                  temperature: 0.3,
                }),
              });
              if (aiRes.ok) {
                const aiData = await aiRes.json();
                const formatted = aiData?.choices?.[0]?.message?.content?.trim();
                if (formatted && formatted.length > 50) {
                  formattedDescription = formatted;
                }
              }
            } catch (aiErr) {
              console.log("[AliExpress Import] AI formatting failed, using raw description:", aiErr);
            }
          }

          const catalogPayload = {
            title: cleanTitle,
            platform: "Gaming Accessories",
            store: "Gaming Accessories",
            region: "Global",
            image_url: p.image_url || null,
            description: formattedDescription,
            aliexpress_product_id: p.aliexpress_product_id || null,
            screenshots: p.screenshots || null,
          };

          let allowedProductId: string | null = null;

          if (p.aliexpress_product_id) {
            const { data: existingAllowed } = await supabase
              .from("allowed_products")
              .select("id")
              .eq("aliexpress_product_id", p.aliexpress_product_id)
              .maybeSingle();

            if (existingAllowed?.id) {
              allowedProductId = existingAllowed.id;
              const { error: allowedUpdateError } = await supabase
                .from("allowed_products")
                .update(catalogPayload)
                .eq("id", existingAllowed.id);
              if (allowedUpdateError) throw allowedUpdateError;
            }
          }

          if (!allowedProductId) {
            const { data: insertedAllowed, error: allowedInsertError } = await supabase
              .from("allowed_products")
              .insert(catalogPayload)
              .select("id")
              .single();
            if (allowedInsertError) throw allowedInsertError;
            allowedProductId = insertedAllowed.id;
          }

          const productPayload = {
            seller_id: officialSeller.user_id,
            title: cleanTitle,
            platform: "Gaming Accessories",
            store: "Gaming Accessories",
            category: "gaming-accessories",
            status: "active",
            price: parsedPrice,
            image_url: p.image_url || null,
            game_code: "ALIEXPRESS_PHYSICAL_ITEM",
          };

          const { data: existingProduct } = await supabase
            .from("products")
            .select("id")
            .eq("seller_id", officialSeller.user_id)
            .eq("title", p.title)
            .eq("platform", "Gaming Accessories")
            .eq("store", "Gaming Accessories")
            .maybeSingle();

          if (existingProduct?.id) {
            const { error: productUpdateError } = await supabase
              .from("products")
              .update(productPayload)
              .eq("id", existingProduct.id);
            if (productUpdateError) throw productUpdateError;
          } else {
            const { error: productInsertError } = await supabase
              .from("products")
              .insert(productPayload);
            if (productInsertError) throw productInsertError;
          }

            // Save variations if provided
          if (allowedProductId && p.variations && Array.isArray(p.variations) && p.variations.length > 0) {
            // Clean variation names with deterministic cleanup first, then AI refinement
            let cleanedVariations = sanitizeVariationList(p.variations);
            if (LOVABLE_API_KEY && p.variations.length > 0) {
              try {
                const rawNames = cleanedVariations.map((v: any) => v.variation_name || '').filter(Boolean);
                if (rawNames.length > 0) {
                  const cleanRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      model: "google/gemini-2.5-flash-lite",
                      messages: [
                        {
                          role: "system",
                          content: `You rename product variation options for a gaming accessories e-commerce store. Given a list of raw variation names from a supplier, return ONLY the renamed variations as a JSON array of strings.

Rules:
- Remove ALL numeric codes, SKU IDs, hash symbols (#), and alphanumeric identifiers (e.g. "14:29#", "200007763:201336100")
- Do NOT keep supplier wording unchanged. Every item must become a cleaner store-friendly customer label.
- RENAME the remaining color/style names to common, natural-sounding alternatives that a customer would recognize. Examples:
  - "Mech White" → "Arctic White" or "Pearl White"
  - "Shadow Ember" → "Charcoal Black" or "Dark Gray"
  - "Sakura Pink" → "Rose Pink" or "Blush"
- The goal is to make names look like they belong to YOUR store brand, not copied from a supplier
- Keep names short (1-3 words max)
- Avoid words like "Mech", "Ember", "Edition", "Version", "Model", raw color codes, or supplier nicknames unless converted to a more natural retail label
- If the name is purely numeric codes with no readable name, use a generic label like "Style A", "Style B" etc.
- Do NOT add any explanation, just return the JSON array
- The output array must have the EXACT same number of items as the input`
                        },
                        { role: "user", content: JSON.stringify(rawNames) }
                      ],
                      max_tokens: 500,
                      temperature: 0.1,
                    }),
                  });
                  if (cleanRes.ok) {
                    const cleanData = await cleanRes.json();
                    const cleanedText = cleanData?.choices?.[0]?.message?.content?.trim() || '';
                    try {
                      const cleanedNames = JSON.parse(cleanedText);
                      if (Array.isArray(cleanedNames) && cleanedNames.length === rawNames.length) {
                        let nameIdx = 0;
                        cleanedVariations = sanitizeVariationList(cleanedVariations.map((v: any) => {
                          if (v.variation_name) {
                            const cleaned = sanitizeVariationName(cleanedNames[nameIdx++] || v.variation_name, nameIdx);
                            return { ...v, variation_name: cleaned };
                          }
                          return v;
                        }));
                      }
                    } catch { /* keep original names */ }
                  }
                }
              } catch (e) {
                console.log("[AliExpress Import] Variation name cleaning failed:", e);
              }
            }

            for (const v of cleanedVariations) {
              if (!v.sku_id) continue;
              const varPayload = {
                allowed_product_id: allowedProductId,
                sku_id: String(v.sku_id),
                variation_name: sanitizeVariationName(v.variation_name || v.sku_attr || '', 0),
                image_url: normalizeAliImageUrl(v.image_url),
                price: v.price ? Number(v.price) : null,
                stock: v.stock != null ? Number(v.stock) : 0,
                sku_attr: v.sku_attr || null,
              };
              await supabase
                .from("product_variations")
                .upsert(varPayload, { onConflict: "allowed_product_id,sku_id" });
            }
          }

          imported.push(p.title);
        } catch (e: any) {
          errors.push(`${p.title}: ${e.message}`);
        }
      }

      return new Response(
        JSON.stringify({ imported: imported.length, errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "shipping") {
      const { product_id, country_code = "US", quantity = "1", sku_id } = params;
      if (!product_id) throw new Error("product_id required");

      // Auto-fetch default SKU if not provided
      let resolvedSkuId = sku_id;
      if (!resolvedSkuId) {
        try {
          const detailResult = await callAliExpress("aliexpress.ds.product.get", {
            product_id: String(product_id),
            ship_to_country: String(country_code),
            target_currency: "EUR",
            target_language: "EN",
          }, sessionToken);
          const productInfo = detailResult?.aliexpress_ds_product_get_response?.result;
          const skuList = productInfo?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o || [];
          if (skuList.length > 0) {
            resolvedSkuId = skuList[0].sku_id || skuList[0].id;
          }
        } catch (e) {
          console.log("[AliExpress] Could not auto-fetch SKU for shipping:", e);
        }
      }

      const deliveryReq: Record<string, string | number> = {
        productId: String(product_id),
        countryCode: String(country_code),
        shipToCountry: String(country_code),
        quantity: Number(quantity),
        productNum: Number(quantity),
        sendGoodsCountryCode: "CN",
        locale: "en_US",
        language: "en_US",
        currency: "EUR",
      };
      if (resolvedSkuId) deliveryReq.selectedSkuId = String(resolvedSkuId);

      const queryDeliveryReq = JSON.stringify(deliveryReq);

      console.log("[AliExpress] shipping queryDeliveryReq:", queryDeliveryReq);

      const result = await callAliExpress("aliexpress.ds.freight.query", {
        queryDeliveryReq,
        language: "en_US",
      }, sessionToken);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "place_order") {
      const { product_id, quantity = 1, sku_attr, logistics_service_name, shipping_address } = params;
      if (!product_id) throw new Error("product_id required");
      if (!shipping_address) throw new Error("shipping_address required");

      const logisticsAddress: Record<string, string> = {
        address: shipping_address.address_line1 || "",
        address2: shipping_address.address_line2 || "",
        city: shipping_address.city || "",
        province: shipping_address.state || "",
        country: shipping_address.country || "",
        zip: shipping_address.zip_code || "",
        full_name: shipping_address.full_name || "",
        mobile_no: shipping_address.phone || "",
        phone_country: shipping_address.phone_country || "",
      };

      const productItem: Record<string, any> = {
        product_id: Number(product_id),
        product_count: Number(quantity),
        logistics_service_name: logistics_service_name || "CAINIAO_STANDARD",
        order_memo: "Dropshipping order - please do not include invoices or promotional materials.",
      };
      if (sku_attr) productItem.sku_attr = sku_attr;

      const orderParams: Record<string, string> = {
        param_place_order_request4_open_api_d_t_o: JSON.stringify({
          logistics_address: logisticsAddress,
          product_items: [productItem],
        }),
      };

      console.log("[AliExpress] place_order: submitting order (address redacted)");

      const result = await callAliExpress("aliexpress.ds.order.create", orderParams, sessionToken);

      // Extract order ID from response
      const orderResult = result?.aliexpress_ds_order_create_response?.result;
      const aliOrderId = orderResult?.order_list?.number?.[0] || orderResult?.order_list?.[0] || null;

      return new Response(JSON.stringify({ 
        success: !!aliOrderId,
        aliexpress_order_id: aliOrderId,
        raw: result,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_order_tracking") {
      const { order_id } = params;
      if (!order_id) throw new Error("order_id required");

      const result = await callAliExpress("aliexpress.ds.tracking.info.query", {
        order_id: String(order_id),
      }, sessionToken);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "raw_call") {
      const { method, call_params = {} } = params;
      if (!method) throw new Error("method is required");
      const result = await callAliExpress(method, call_params, sessionToken);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("AliExpress edge function error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
