import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify admin via auth header, OR accept service-role calls
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      // Check if it's the service role key (internal call)
      if (token !== SUPABASE_SERVICE_ROLE_KEY) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) throw new Error("Not authenticated");
        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["admin", "super_admin"]);
        if (!roleRows || roleRows.length === 0) throw new Error("Admin access required");
      }
    } else {
      throw new Error("Not authenticated");
    }

    const { products } = await req.json();
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error("No products provided");
    }

    let updated = 0;
    let failed = 0;

    for (const p of products) {
      if (!p.id || !p.description) {
        failed++;
        continue;
      }
      
      const { error } = await supabase
        .from("allowed_products")
        .update({ description: p.description, description_paraphrased: true })
        .eq("id", p.id);
      
      if (error) {
        console.error(`Failed ${p.id}:`, error.message);
        failed++;
      } else {
        updated++;
      }
    }

    return new Response(JSON.stringify({ updated, failed, total: products.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
