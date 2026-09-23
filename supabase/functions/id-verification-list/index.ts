// Admin-only: list uploaded ID-proof files for an order with signed URLs
// (1h) so admins can review them without making the bucket public.
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

  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id");
  if (!orderId) return json({ error: "order_id required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: rows, error } = await admin
    .from("order_id_verifications")
    .select("id, file_path, file_name, file_type, file_size, uploader_ip, uploader_user_agent, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);

  const files = await Promise.all(
    (rows || []).map(async (r) => {
      const { data: signed } = await admin.storage
        .from("id-verification")
        .createSignedUrl(r.file_path, 3600);
      return { ...r, signed_url: signed?.signedUrl || null };
    }),
  );
  return json({ files });
});
