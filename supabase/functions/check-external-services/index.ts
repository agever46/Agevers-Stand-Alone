import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ServiceResult = {
  id: string;
  name: string;
  category: string;
  ok: boolean;
  detail: string;
};

async function timed<T>(fn: () => Promise<T>, ms = 8000): Promise<T> {
  return await Promise.race([
    fn(),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

async function checkSecret(name: string): Promise<boolean> {
  return !!Deno.env.get(name);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: admin only
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: roleData } = await sb.from("user_roles").select("role").eq("user_id", claims.claims.sub).in("role", ["admin", "super_admin"]).limit(1);
    if (!roleData?.length) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Auth error" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const checks: Promise<ServiceResult>[] = [];

  const add = (id: string, name: string, category: string, fn: () => Promise<{ ok: boolean; detail: string }>) => {
    checks.push(
      timed(fn, 8000)
        .then((r) => ({ id, name, category, ...r }))
        .catch((e) => ({ id, name, category, ok: false, detail: (e as Error)?.message || "error" }))
    );
  };

  // ── Payments ──
  add("paypal", "PayPal", "Payments", async () => {
    const id = Deno.env.get("PAYPAL_CLIENT_ID");
    const secret = Deno.env.get("PAYPAL_SECRET");
    if (!id || !secret) return { ok: false, detail: "Missing credentials" };
    const auth = btoa(`${id}:${secret}`);
    // Try Live first (project uses Live), fall back to Sandbox if Live fails.
    const tryEnv = async (base: string) => {
      const r = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      });
      return r;
    };
    const liveRes = await tryEnv("https://api-m.paypal.com");
    if (liveRes.ok) return { ok: true, detail: "Live OK" };
    const sandRes = await tryEnv("https://api-m.sandbox.paypal.com");
    if (sandRes.ok) return { ok: true, detail: "Sandbox OK" };
    return { ok: false, detail: `Live HTTP ${liveRes.status} / Sandbox HTTP ${sandRes.status}` };
  });

  add("invoice_maven", "Invoice Maven", "Payments", async () => {
    const ok = await checkSecret("INVOICE_MAVEN_API_KEY");
    return { ok, detail: ok ? "API key present" : "API key missing" };
  });

  // ── Suppliers ──
  add("kinguin", "Kinguin ESA", "Suppliers", async () => {
    const key = Deno.env.get("KINGUIN_API_KEY");
    if (!key) return { ok: false, detail: "API key missing" };
    const r = await fetch("https://gateway.kinguin.net/esa/api/v1/balance", {
      headers: { "X-Api-Key": key },
    });
    return { ok: r.ok, detail: r.ok ? "OK" : `HTTP ${r.status}` };
  });

  add("aliexpress", "AliExpress", "Suppliers", async () => {
    const ok = (await checkSecret("ALIEXPRESS_APP_KEY")) && (await checkSecret("ALIEXPRESS_APP_SECRET")) && (await checkSecret("ALIEXPRESS_ACCESS_TOKEN"));
    return { ok, detail: ok ? "Credentials present" : "Credentials missing" };
  });

  // ── AI ──
  add("gemini_ai", "Google Gemini", "AI", async () => {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return { ok: false, detail: "Key missing" };
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gemini-3.5-flash-lite", messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
    });
    return { ok: r.ok, detail: r.ok ? "OK" : `HTTP ${r.status}` };
  });

  // ── Security ──
  add("turnstile", "Cloudflare Turnstile", "Security", async () => {
    const ok = (await checkSecret("TURNSTILE_SECRET_KEY")) && (await checkSecret("TURNSTILE_SITE_KEY"));
    return { ok, detail: ok ? "Keys present" : "Keys missing" };
  });

  add("twilio", "Twilio SMS", "Security", async () => {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const tok = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!sid || !tok) return { ok: false, detail: "Credentials missing" };
    const auth = btoa(`${sid}:${tok}`);
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return { ok: r.ok, detail: r.ok ? "Account active" : `HTTP ${r.status}` };
  });

  add("abuseipdb", "AbuseIPDB", "Security", async () => {
    const key = Deno.env.get("ABUSE_IP_DB_KEY");
    if (!key) return { ok: false, detail: "Key missing" };
    const r = await fetch("https://api.abuseipdb.com/api/v2/check?ipAddress=8.8.8.8&maxAgeInDays=90", {
      headers: { Key: key, Accept: "application/json" },
    });
    return { ok: r.ok, detail: r.ok ? "OK" : `HTTP ${r.status}` };
  });

  add("ipqs", "IPQualityScore", "Security", async () => {
    const ok = await checkSecret("IPQS_API_KEY");
    return { ok, detail: ok ? "Key present" : "Key missing" };
  });

  // ── Email & Comms ──
  add("telegram", "Telegram Bot", "Comms", async () => {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) return { ok: false, detail: "Bot token missing" };
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && j?.ok, detail: j?.ok ? `@${j.result?.username}` : `HTTP ${r.status}` };
  });

  // ── SEO / Discovery ──
  add("google_merchant", "Google Merchant Center", "SEO", async () => {
    const ok = (await checkSecret("GOOGLE_MERCHANT_ID")) && (await checkSecret("GOOGLE_SERVICE_ACCOUNT_JSON"));
    return { ok, detail: ok ? "Credentials present" : "Credentials missing" };
  });

  add("ggdeals", "GG.deals", "SEO", async () => {
    const ok = await checkSecret("GGDEALS_API_KEY");
    return { ok, detail: ok ? "API key present" : "API key missing" };
  });

  add("firecrawl", "Firecrawl (AllKeyShop)", "SEO", async () => {
    const ok = await checkSecret("FIRECRAWL_API_KEY");
    return { ok, detail: ok ? "API key present" : "API key missing" };
  });

  add("frankfurter", "Frankfurter (FX)", "SEO", async () => {
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR");
    return { ok: r.ok, detail: r.ok ? "OK" : `HTTP ${r.status}` };
  });

  // ── Trust & Infra ──
  add("trustpilot", "Trustpilot", "Trust", async () => {
    const r = await fetch("https://www.trustpilot.com/review/agevers.com", {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AgeversHealthCheck/1.0)" },
    });
    // Trustpilot may bot-block; treat 200/403/405 as "reachable" since the page exists.
    const reachable = r.ok || r.status === 403 || r.status === 405;
    return { ok: reachable, detail: r.ok ? "OK" : `HTTP ${r.status} (reachable)` };
  });

  add("cloudflare", "Cloudflare DNS", "Infra", async () => {
    const r = await fetch("https://cloudflare-dns.com/dns-query?name=agevers.com&type=A", { headers: { Accept: "application/dns-json" } });
    const j = await r.json().catch(() => ({}));
    const has = Array.isArray(j?.Answer) && j.Answer.length > 0;
    return { ok: r.ok && has, detail: has ? `Resolved (${j.Answer[0]?.data})` : `HTTP ${r.status}` };
  });

  add("supabase", "Supabase", "Infra", async () => {
    const url = Deno.env.get("SUPABASE_URL");
    if (!url) return { ok: false, detail: "URL missing" };
    const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" } });
    return { ok: r.ok, detail: r.ok ? "OK" : `HTTP ${r.status}` };
  });

  const results = await Promise.all(checks);
  return new Response(JSON.stringify({ services: results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});