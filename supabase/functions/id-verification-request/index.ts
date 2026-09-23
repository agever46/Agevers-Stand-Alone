// Admin-only: generate a one-time upload token for an order so the buyer
// (authenticated or guest) can upload identity-proof files. Returns the
// public URL of the upload page (agevers.com/verify-order/:token).
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdminOrService } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const guard = await requireAdminOrService(req, corsHeaders);
  if (guard) return guard;

  const { order_id } = await req.json().catch(() => ({}));
  if (!order_id) return json({ error: "order_id required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Bind the token to server state: only an order that is actually awaiting a
  // manual/identity review may receive an upload token. This prevents a
  // request-supplied order_id from touching arbitrary (e.g. completed) orders.
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", order_id)
    .maybeSingle();
  if (orderErr) return json({ error: orderErr.message }, 500);
  if (!order) return json({ error: "Order not found" }, 404);

  const reviewable = ["held", "pending", "pending_review", "manual_review", "on_hold", "processing"];
  if (!reviewable.includes(String(order.status || "").toLowerCase())) {
    return json({ error: "Identity verification can only be requested for an order under review" }, 409);
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(); // 30 days

  const { error } = await admin
    .from("orders")
    .update({ id_proof_token: token, id_proof_token_expires_at: expiresAt })
    .eq("id", order.id);
  if (error) return json({ error: error.message }, 500);

  const uploadUrl = `https://agevers.com/verify-order/${token}`;
  return json({ token, uploadUrl, expiresAt });
});
