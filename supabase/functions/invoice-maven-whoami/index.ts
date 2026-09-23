// Identifies WHICH Invoice Maven account the configured API key belongs to.
// Returns a masked fingerprint of the key (compare with the key shown in each
// Invoice Maven account settings) plus a sandbox (test=1) document so the
// business name / exempt-dealer number can be verified on the PDF header.
import { requireAdminOrService } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INVOICE_MAVEN_URL = "https://app.invoice-maven.co.il/api/documents/addDocument";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireAdminOrService(req, corsHeaders);
  if (guard) return guard;

  try {
    const API_KEY = Deno.env.get("INVOICE_MAVEN_API_KEY");
    const CONTACT_EMAIL = Deno.env.get("INVOICE_MAVEN_CONTACT_EMAIL");
    const CONTACT_PHONE = Deno.env.get("INVOICE_MAVEN_CONTACT_PHONE");
    if (!API_KEY || !CONTACT_EMAIL || !CONTACT_PHONE) {
      throw new Error("Invoice Maven secrets are not fully configured");
    }

    const fingerprint = {
      key_length: API_KEY.length,
      key_first4: API_KEY.slice(0, 4),
      key_last4: API_KEY.slice(-4),
      contact_email: CONTACT_EMAIL,
      contact_phone: CONTACT_PHONE,
    };

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const documentDate = `${dd}/${mm}/${now.getFullYear()}`;

    // Sandbox probe — receipt only (doc_type 400), no VAT, never stored.
    const payload = {
      api_key: API_KEY,
      test: 1,
      contact_email: CONTACT_EMAIL,
      contact_phone: CONTACT_PHONE,
      doc_id: `whoami-${crypto.randomUUID()}`,
      doc_type: 400,
      document_date: documentDate,
      description: "Account identification probe (sandbox)",
      no_vat: 1,
      english_document: 0,
      currency: 3,
      send_to_customer: 0,
      customer: { name: "Account Check", email: CONTACT_EMAIL },
      payments: [{ payment_date: documentDate, payment_type: 5, amount: "1.00" }],
      remarks: "Sandbox probe — no tax document is stored",
    };

    const res = await fetch(INVOICE_MAVEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && Number(data?.status_code) === 0;

    return new Response(
      JSON.stringify({
        ok,
        fingerprint,
        status_code: data?.status_code ?? null,
        status_description: data?.status_description ?? null,
        doc_no: data?.doc_no ?? null,
        pdf_original: data?.pdf_original ?? null,
        note: "Open the PDF and check the business name / exempt-dealer number in the header — that is the active Invoice Maven account.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
