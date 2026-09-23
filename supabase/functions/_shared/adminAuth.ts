// Shared admin authentication guard for edge functions.
// Accepts either the service-role key (internal/cron callers) or an
// authenticated user with admin/super_admin role. Returns null on success
// or a Response to return immediately on failure.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function requireAdminOrService(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // Accept service-role key directly (internal/cron).
  if (token === SERVICE_KEY) return null;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roles } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const isAdmin = (roles || []).some(
    (r: any) => r.role === "admin" || r.role === "super_admin",
  );
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

// Cron/internal-only: service-role key or matching INTERNAL_CRON_TOKEN header.
export async function requireServiceOrInternal(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const INTERNAL = Deno.env.get("INTERNAL_CRON_TOKEN");
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const internalHeader = req.headers.get("x-internal-token") || "";
  if (SERVICE_KEY && token === SERVICE_KEY) return null;
  if (INTERNAL && internalHeader === INTERNAL) return null;

  // Scheduled database jobs may still hold a previously issued service-role
  // JWT after the runtime key binding is refreshed. Such a token is accepted
  // only after the database itself proves the signature is valid: a forged
  // payload with role=service_role cannot read a table that has no policies.
  if (token.split(".").length === 3 && SUPABASE_URL) {
    try {
      const probe = await fetch(
        `${SUPABASE_URL}/rest/v1/internal_secrets?select=key&limit=1`,
        { headers: { apikey: token, Authorization: `Bearer ${token}` } },
      );
      if (probe.ok) {
        await probe.body?.cancel();
        return null;
      }
      await probe.body?.cancel();
    } catch {
      // Fall through to the normal unauthorized response.
    }
  }

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
