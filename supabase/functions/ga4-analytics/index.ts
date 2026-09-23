import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(): Promise<string> {
  const raw = Deno.env.get("GA4_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Missing GA4_SERVICE_ACCOUNT_JSON");
  const sa = JSON.parse(raw);

  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(3600),
      iat: getNumericDate(0),
    },
    key,
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Token error: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function runReport(token: string, propertyId: string, body: unknown) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    const reason = json?.error?.details?.find((detail: Record<string, unknown>) => detail?.reason)?.reason;
    const activationUrl = json?.error?.details?.find((detail: { metadata?: { activationUrl?: string } }) => detail?.metadata?.activationUrl)?.metadata?.activationUrl;
    const setupError = new Error(json?.error?.message || "Google Analytics returned an error") as Error & {
      code?: string;
      reason?: string;
      activationUrl?: string;
      statusCode?: number;
    };
    setupError.code = json?.error?.status;
    setupError.reason = typeof reason === "string" ? reason : undefined;
    setupError.activationUrl = activationUrl;
    setupError.statusCode = res.status;
    throw setupError;
  }
  return json;
}

function isGa4SetupError(e: unknown) {
  const err = e as { code?: string; reason?: string; statusCode?: number };
  return err?.reason === "SERVICE_DISABLED" || err?.code === "PERMISSION_DENIED" || err?.statusCode === 403;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Admin auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", claims.claims.sub)
      .in("role", ["admin", "super_admin"])
      .limit(1);
    if (!roleData?.length) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const propertyId = Deno.env.get("GA4_PROPERTY_ID");
    if (!propertyId) throw new Error("Missing GA4_PROPERTY_ID");

    const { range = "7daysAgo" } = await req.json().catch(() => ({}));
    const dateRange = { startDate: range, endDate: "today" };

    const token = await getAccessToken();

    const runRealtime = async () => {
      const res = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            metrics: [{ name: "activeUsers" }],
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        console.error("Realtime error:", JSON.stringify(json));
        return { error: json?.error?.message || "realtime failed", rows: [] };
      }
      const total = Number(json.rows?.[0]?.metricValues?.[0]?.value || 0);
      return { ...json, totals: [{ metricValues: [{ value: String(total) }] }] };
    };

    const [summary, byDay, topPages, sources, countries, devices, realtime] = await Promise.all([
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        metrics: [
          { name: "activeUsers" },
          { name: "newUsers" },
          { name: "screenPageViews" },
          { name: "sessions" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
        ],
      }),
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 10,
      }),
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: "sessionSource" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 10,
      }),
      runReport(token, propertyId, {
        dateRanges: [dateRange],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "activeUsers" }],
      }),
      runRealtime(),
    ]);

    return new Response(
      JSON.stringify({ summary, byDay, topPages, sources, countries, devices, realtime }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    if (isGa4SetupError(e)) {
      const err = e as Error & { code?: string; reason?: string; activationUrl?: string };
      return new Response(
        JSON.stringify({
          setupRequired: true,
          error: err.message,
          code: err.code,
          reason: err.reason,
          activationUrl: err.activationUrl,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});