// Generates a tax-exempt receipt (קבלה) via Invoice Maven API for a completed order.
// Caches the receipt in order_invoices to prevent duplicates.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const INVOICE_MAVEN_URL =
  "https://app.invoice-maven.co.il/api/documents/addDocument";

// Currency code mapping per Invoice Maven docs
const CURRENCY_MAP: Record<string, number> = {
  ILS: 1,
  USD: 2,
  EUR: 3,
  GBP: 4,
};

interface ReceiptRequest {
  order_id: string;
  test?: boolean;
  language?: "he" | "en";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const API_KEY = Deno.env.get("INVOICE_MAVEN_API_KEY");
    const CONTACT_EMAIL = Deno.env.get("INVOICE_MAVEN_CONTACT_EMAIL");
    const CONTACT_PHONE = Deno.env.get("INVOICE_MAVEN_CONTACT_PHONE");

    if (!API_KEY) throw new Error("INVOICE_MAVEN_API_KEY is not configured");
    if (!CONTACT_EMAIL)
      throw new Error("INVOICE_MAVEN_CONTACT_EMAIL is not configured");
    if (!CONTACT_PHONE)
      throw new Error("INVOICE_MAVEN_CONTACT_PHONE is not configured");

    // Verify caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: claims, error: claimsErr } =
      await anonClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = (await req.json()) as ReceiptRequest;
    if (!body?.order_id || typeof body.order_id !== "string") {
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const isTest = body.test === true;
    const language = body.language === "he" ? "he" : "en";
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Check global on/off toggle. Admins can still issue receipts in test mode.
    const { data: settings } = await adminClient
      .from("site_settings")
      .select("receipts_enabled")
      .eq("id", 1)
      .maybeSingle();
    const receiptsEnabled = (settings as any)?.receipts_enabled === true;

    // Fetch the order and validate ownership
    const { data: order, error: orderErr } = await adminClient
      .from("orders")
      .select(
        "id, user_id, game_title, platform, price, quantity, status, created_at, paypal_order_id"
      )
      .eq("id", body.order_id)
      .maybeSingle();

    if (orderErr) throw new Error(`Order fetch failed: ${orderErr.message}`);
    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow owner OR admin
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (order.user_id !== userId && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block receipt creation when system is OFF (admins can override with test=true)
    if (!receiptsEnabled && !(isAdmin && isTest)) {
      return new Response(
        JSON.stringify({
          error: "Receipt system is currently disabled by the administrator",
          disabled: true,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Only completed orders deserve receipts
    if (order.status !== "completed") {
      return new Response(
        JSON.stringify({
          error: "Receipt can only be issued for completed orders",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Return cached receipt if already issued (skip cache for test mode)
    if (!isTest) {
      const { data: existing } = await adminClient
        .from("order_invoices")
        .select("doc_no, pdf_original, pdf_copy, pdf_english, created_at")
        .eq("order_id", order.id)
        .eq("is_test", false)
        .maybeSingle();
      if (existing) {
        // For Hebrew (default) return the original PDF immediately if we have it.
        // For English return the cached english PDF; otherwise fall through and
        // generate it now, then attach to the existing row.
        if (language === "he" && existing.pdf_original) {
          return new Response(
            JSON.stringify({
              doc_no: existing.doc_no,
              pdf_original: existing.pdf_original,
              pdf_copy: existing.pdf_copy,
              cached: true,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        if (language === "en" && existing.pdf_english) {
          return new Response(
            JSON.stringify({
              doc_no: existing.doc_no,
              pdf_original: existing.pdf_english,
              cached: true,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // Fetch buyer profile for the receipt name/email
    const { data: profile } = await adminClient
      .from("profiles")
      .select("display_name, username")
      .eq("user_id", order.user_id)
      .maybeSingle();

    const { data: userRes } = await adminClient.auth.admin.getUserById(
      order.user_id
    );
    const buyerEmail = userRes?.user?.email ?? "";
    const buyerName =
      profile?.display_name?.trim() ||
      profile?.username?.trim() ||
      buyerEmail.split("@")[0] ||
      "Customer";

    // Build payload — receipt (doc_type=400), no VAT (עוסק פטור)
    const amount = Number(order.price) * Number(order.quantity ?? 1);
    const currency = CURRENCY_MAP.EUR; // site base currency

    const payload = {
      api_key: API_KEY,
      test: isTest ? 1 : 0,
      contact_email: CONTACT_EMAIL,
      contact_phone: CONTACT_PHONE,
      // dedupe key on Invoice Maven side — keep separate per language so the
      // English copy is a distinct document and does not collide with the Hebrew one.
      doc_id: language === "en" ? `${order.id}-en` : order.id,
      doc_type: 400, // קבלה
      document_date: formatDate(new Date(order.created_at)),
      description: language === "he"
        ? `קבלה עבור הזמנה #${order.id.slice(0, 8)}`
        : `Receipt for order #${order.id.slice(0, 8)}`,
      no_vat: 1, // עוסק פטור — ללא מע"מ
      english_document: language === "he" ? 0 : 1,
      currency,
      send_to_customer: buyerEmail ? 1 : 0,
      customer: {
        name: buyerName,
        email: buyerEmail,
      },
      payments: [
        {
          payment_date: formatDate(new Date(order.created_at)),
          payment_type: 5, // PayPal
          amount: amount.toFixed(2),
          paypal_account_number: buyerEmail || undefined,
          paypal_transaction_number: order.paypal_order_id || undefined,
        },
      ],
      remarks: language === "he"
        ? `מוצר: ${order.game_title} (${order.platform})`
        : `Product: ${order.game_title} (${order.platform})`,
    };

    const imRes = await fetch(INVOICE_MAVEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const imData = await imRes.json().catch(() => ({}));
    // Invoice Maven returns status_code as string "0" on success
    const statusCodeNum = Number(imData?.status_code);
    if (!imRes.ok || statusCodeNum !== 0) {
      console.error("Invoice Maven error:", imRes.status, imData);
      return new Response(
        JSON.stringify({
          error: imData?.status_description || "Invoice Maven request failed",
          status_code: imData?.status_code,
          http_status: imRes.status,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Persist receipt. If a row already exists for this order, update the
    // matching language column instead of inserting a duplicate.
    if (!isTest) {
      const { data: existingRow } = await adminClient
        .from("order_invoices")
        .select("id")
        .eq("order_id", order.id)
        .eq("is_test", false)
        .maybeSingle();

      if (existingRow) {
        const updatePayload: Record<string, unknown> =
          language === "en"
            ? { pdf_english: imData.pdf_original }
            : {
                doc_no: String(imData.doc_no),
                pdf_original: imData.pdf_original,
                pdf_copy: imData.pdf_copy ?? null,
                raw_response: imData,
              };
        const { error: updateErr } = await adminClient
          .from("order_invoices")
          .update(updatePayload)
          .eq("id", existingRow.id);
        if (updateErr) console.error("Failed to update receipt:", updateErr);
      } else {
        const { error: insertErr } = await adminClient
          .from("order_invoices")
          .insert({
            order_id: order.id,
            doc_no: String(imData.doc_no),
            doc_type: 400,
            pdf_original: language === "en" ? "" : imData.pdf_original,
            pdf_english: language === "en" ? imData.pdf_original : null,
            pdf_copy: language === "en" ? null : (imData.pdf_copy ?? null),
            amount,
            currency_code: currency,
            is_test: isTest,
            raw_response: imData,
          });
        if (insertErr) console.error("Failed to persist receipt:", insertErr);
      }
    }

    return new Response(
      JSON.stringify({
        doc_no: imData.doc_no,
        pdf_original: imData.pdf_original,
        pdf_copy: imData.pdf_copy,
        cached: false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("generate-receipt error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}