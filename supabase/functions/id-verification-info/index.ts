// Public: resolves an upload token to minimal order info (game title, amount)
// so the /verify-order/:token page can show the buyer what they're verifying.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return json({ error: "token required" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await admin
    .from("orders")
    .select("id, game_title, price, guest_email, user_id, id_proof_token_expires_at, status, is_held")
    .eq("id_proof_token", token)
    .maybeSingle();
  if (error || !data) return json({ error: "Invalid or expired link" }, 404);
  if (data.id_proof_token_expires_at && new Date(data.id_proof_token_expires_at) < new Date()) {
    return json({ error: "This upload link has expired. Please contact support." }, 410);
  }

  // orders has no buyer_email/buyer_name columns — resolve via the order's
  // owner (auth.users + profiles) for a registered user, falling back to
  // guest_email for a guest checkout.
  let buyerEmail: string | null = data.guest_email || null;
  let buyerName: string | null = null;
  if (data.user_id) {
    const [{ data: authUser }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(data.user_id),
      admin.from("profiles").select("display_name, username").eq("user_id", data.user_id).maybeSingle(),
    ]);
    buyerEmail = authUser?.user?.email || buyerEmail;
    buyerName = profile?.display_name || profile?.username || null;
  }

  const { count } = await admin
    .from("order_id_verifications")
    .select("id", { count: "exact", head: true })
    .eq("order_id", data.id);

  return json({
    game_title: data.game_title,
    price: data.price,
    buyer_email: buyerEmail,
    buyer_name: buyerName,
    already_uploaded: count || 0,
  });
});
