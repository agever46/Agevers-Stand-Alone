// Public: accepts an ID-proof file upload from the buyer using the one-time
// token. Files go into the private `id-verification` bucket under
// `<order_id>/<timestamp>-<random>.<ext>`. Only admins can read them.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PER_ORDER = 10;
const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "Invalid form data" }, 400);
  const token = String(form.get("token") || "");
  const file = form.get("file") as File | null;
  if (!token || !file) return json({ error: "token and file required" }, 400);
  if (file.size > MAX_BYTES) return json({ error: "File too large (max 15MB)" }, 400);
  if (!ALLOWED.test(file.type)) return json({ error: "Only images (JPG/PNG/WEBP/HEIC) or PDF are allowed" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: order, error: oErr } = await admin
    .from("orders")
    .select("id, id_proof_token_expires_at")
    .eq("id_proof_token", token)
    .maybeSingle();
  if (oErr || !order) return json({ error: "Invalid or expired link" }, 404);
  if (order.id_proof_token_expires_at && new Date(order.id_proof_token_expires_at) < new Date()) {
    return json({ error: "This upload link has expired" }, 410);
  }

  const { count } = await admin
    .from("order_id_verifications")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id);
  if ((count || 0) >= MAX_PER_ORDER) return json({ error: "Upload limit reached" }, 400);

  const safeName = (file.name || "upload").replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin";
  const path = `${order.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from("id-verification")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (upErr) return json({ error: upErr.message }, 500);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const ua = req.headers.get("user-agent") || null;

  const { error: insErr } = await admin.from("order_id_verifications").insert({
    order_id: order.id,
    file_path: path,
    file_name: safeName,
    file_type: file.type,
    file_size: file.size,
    uploader_ip: ip,
    uploader_user_agent: ua,
  });
  if (insErr) {
    await admin.storage.from("id-verification").remove([path]);
    return json({ error: insErr.message }, 500);
  }

  return json({ success: true, file_name: safeName });
});
