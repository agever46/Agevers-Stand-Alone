import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Disposable / temp email providers commonly abused by bots
const DISPOSABLE_DOMAINS = new Set([
  "mail.tm","mailtm.com","10minutemail.com","10minutemail.net","tempmail.com","tempmail.net",
  "temp-mail.org","temp-mail.io","guerrillamail.com","guerrillamail.net","guerrillamail.org",
  "sharklasers.com","yopmail.com","yopmail.net","dispostable.com","mailinator.com","mailinator.net",
  "getnada.com","nada.email","maildrop.cc","fakeinbox.com","trashmail.com","trashmail.net",
  "throwawaymail.com","mytemp.email","emailondeck.com","tempail.com","spambog.com","mohmal.com",
  "emailfake.com","inboxbear.com","tempinbox.com","33mail.com","mintemail.com","luxusmail.org",
  "temporary-email.com","tmpmail.org","tmpmail.net","harakirimail.com","incognitomail.com",
  "byom.de","spam4.me","dropmail.me","mailnesia.com","tempmailo.com","mail-temp.com",
]);

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secretKey = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secretKey) return false;
  const form = new FormData();
  form.append("secret", secretKey);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const outcome = await r.json();
  return !!outcome.success;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Maintenance-mode check
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: settings } = await admin
      .from("site_settings")
      .select("maintenance_mode")
      .limit(1)
      .maybeSingle();
    if (settings && settings.maintenance_mode === true) {
      return new Response(JSON.stringify({ error: "maintenance", message: "Site is under maintenance" }), {
        status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, turnstileToken, metadata } = body as {
      email?: string; password?: string; turnstileToken?: string; metadata?: Record<string, unknown>;
    };

    // Basic validation
    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "invalid_email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || typeof password !== "string" || password.length < 8 || password.length > 128) {
      return new Response(JSON.stringify({ error: "invalid_password" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!turnstileToken || typeof turnstileToken !== "string") {
      return new Response(JSON.stringify({ error: "captcha_required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block disposable email providers
    const domain = email.split("@")[1]?.toLowerCase() || "";
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return new Response(JSON.stringify({ error: "disposable_email", message: "Please use a permanent email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side Turnstile verification (with the caller's real IP)
    const ip = req.headers.get("cf-connecting-ip")
      || req.headers.get("x-real-ip")
      || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || null;
    // Allow bypass token from Lovable preview origins (never production).
    const origin = req.headers.get("origin") || "";
    const isPreview = /lovableproject\.com$|id-preview--.*\.lovable\.app$/i.test(
      (() => { try { return new URL(origin).host; } catch { return ""; } })(),
    );
    const captchaOk = (isPreview && turnstileToken === "bypass")
      ? true
      : await verifyTurnstile(turnstileToken, ip);
    if (!captchaOk) {
      return new Response(JSON.stringify({ error: "captcha_failed" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the user via admin API (email not auto-confirmed — custom OTP flow handles it)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: metadata && typeof metadata === "object" ? metadata : {},
    });

    if (createErr || !created?.user) {
      const msg = (createErr?.message || "").toLowerCase();
      const alreadyRegistered = msg.includes("registered") || msg.includes("exists") || msg.includes("duplicate");
      return new Response(JSON.stringify({
        error: alreadyRegistered ? "email_taken" : "signup_failed",
        message: createErr?.message || "Unable to create account",
      }), {
        status: alreadyRegistered ? 409 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ userId: created.user.id, email: created.user.email }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("secure-signup error:", err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});