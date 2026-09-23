import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://agevers.com";
const BATCH_SIZE = 1000;
const GMC_API = "https://shoppingcontent.googleapis.com/content/v2.1";

/* ── Google Auth: create a short-lived access token from a service-account JSON ── */
async function getGoogleAccessToken(): Promise<string> {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");

  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);

  // Build JWT header + claim set
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/content",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const unsignedToken = `${enc(header)}.${enc(claimSet)}`;

  // Import the PEM private key
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${sig64}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google token exchange failed [${tokenRes.status}]: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

/* ── Main handler ── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = await requireAdminOrService(req, corsHeaders);
  if (authFail) return authFail;

  try {
    const merchantId = Deno.env.get("GOOGLE_MERCHANT_ID");
    if (!merchantId) throw new Error("GOOGLE_MERCHANT_ID not set");

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode"); // "purge" to delete all first
    const maxProducts = parseInt(url.searchParams.get("limit") || "0") || 999999;
    const startOffset = parseInt(url.searchParams.get("offset") || "0") || 0;

    const accessToken = await getGoogleAccessToken();

    // ── Purge mode: delete ALL products from GMC ──
    if (mode === "purge") {
      console.log("PURGE MODE: deleting all products from GMC...");
      let deletedCount = 0;
      let nextPageToken: string | undefined;

      while (true) {
        const listUrl = `${GMC_API}/${merchantId}/products?maxResults=250${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`;
        const listRes = await fetch(listUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!listRes.ok) {
          const err = await listRes.text();
          throw new Error(`List products failed: ${err}`);
        }
        const listData = await listRes.json();
        const resources = listData.resources || [];
        if (resources.length === 0) break;

        // Batch delete
        const deleteEntries = resources.map((p: any, idx: number) => ({
          batchId: idx,
          merchantId,
          method: "delete",
          productId: p.id,
        }));

        const delRes = await fetch(`${GMC_API}/products/batch`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ entries: deleteEntries }),
        });

        if (!delRes.ok) {
          console.error("Delete batch failed:", await delRes.text());
        }

        deletedCount += resources.length;
        console.log(`Deleted batch: ${resources.length} (total: ${deletedCount})`);

        nextPageToken = listData.nextPageToken;
        if (!nextPageToken) break;
      }

      return new Response(
        JSON.stringify({ success: true, mode: "purge", deleted: deletedCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting sync: limit=${maxProducts}, offset=${startOffset}`);

    // accessToken already obtained above

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all active products with prices
    interface RawProduct {
      sell_price: number;
      kinguin_stock: number | null;
      allowed_products: {
        id: string;
        title: string;
        slug: string;
        platform: string;
        store: string;
        region: string;
        image_url: string | null;
        description: string | null;
      };
    }

    let all: RawProduct[] = [];
    let offset = startOffset;
    while (all.length < maxProducts) {
      const { data, error } = await sb
        .from("kinguin_products")
        .select(
          "sell_price, kinguin_stock, allowed_products!inner(id, title, slug, platform, store, region, image_url, description)"
        )
        .eq("is_active", true)
        .range(offset, offset + BATCH_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...(data as unknown as RawProduct[]));
      if (data.length < BATCH_SIZE) break;
      offset += BATCH_SIZE;
    }
    all = all.slice(0, maxProducts);
    console.log(`Fetched ${all.length} products from DB`);

    // Also fetch manual keys stock
    const { data: manualCounts } = await sb.rpc("get_manual_key_counts");
    const manualMap = new Map<string, number>();
    if (manualCounts) {
      for (const r of manualCounts) {
        manualMap.set(r.allowed_product_id, Number(r.key_count));
      }
    }

    // Build batch entries for Google (max 10000 per custombatch call)
    const GOOGLE_BATCH_LIMIT = 500; // conservative batch size
    let inserted = 0;
    let errors: string[] = [];

    // Target both US and Canada so the Google Ads campaign can serve in both regions.
    const TARGET_COUNTRIES = ["US", "CA"];

    for (let i = 0; i < all.length; i += GOOGLE_BATCH_LIMIT) {
      const chunk = all.slice(i, i + GOOGLE_BATCH_LIMIT);

      const entries = chunk.flatMap((kp, idx) => {
        const ap = kp.allowed_products;
        const kStock = kp.kinguin_stock ?? 0;
        const mStock = manualMap.get(ap.id) ?? 0;
        const totalStock = kStock + mStock;

        return TARGET_COUNTRIES.map((country, cIdx) => ({
          batchId: (i + idx) * TARGET_COUNTRIES.length + cIdx,
          merchantId,
          method: "insert",
          product: {
            offerId: ap.id,
            title: ap.title.substring(0, 150),
            description: (ap.description || ap.title).substring(0, 5000),
            link: `${SITE_URL}/product/${ap.slug}`,
            imageLink: ap.image_url || `${SITE_URL}/placeholder.svg`,
            contentLanguage: "en",
            targetCountry: country,
            channel: "online",
            availability: totalStock > 0 ? "in_stock" : "out_of_stock",
            condition: "new",
            price: {
              value: String(kp.sell_price),
              currency: "USD",
            },
            brand: ap.store || ap.platform || "Agevers",
            googleProductCategory: "Software > Video Game Software",
            identifierExists: false,
          },
        }));
      });

      const batchRes = await fetch(`${GMC_API}/products/batch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entries }),
      });

      if (!batchRes.ok) {
        const errBody = await batchRes.text();
        errors.push(`Batch ${i}-${i + chunk.length}: [${batchRes.status}] ${errBody.substring(0, 300)}`);
        continue;
      }

      const batchResult = await batchRes.json();
      console.log("Google batch response (first 2 entries):", JSON.stringify((batchResult.entries || []).slice(0, 2)));
      
      const batchErrors = (batchResult.entries || []).filter(
        (e: any) => e.errors && e.errors.errors?.length > 0
      );

      inserted += chunk.length - batchErrors.length;
      if (batchErrors.length > 0) {
        errors.push(
          `Batch ${i}: ${batchErrors.length} product errors (first: ${JSON.stringify(batchErrors[0]?.errors?.errors?.[0]?.message || "unknown").substring(0, 200)})`
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_products: all.length,
        inserted,
        error_count: errors.length,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("google-merchant-sync error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
