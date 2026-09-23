import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- In-memory rate limiter ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CHECK = 15; // 15 check requests per minute
const RATE_LIMIT_MAX_VERIFY = 5; // 5 verify attempts per minute (anti brute-force)

function isRateLimited(key: string, max: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { action, deviceFingerprint, code } = body;

    // The "check" action exposes whether a given user is an admin and which
    // devices are trusted — gate it behind a verified JWT and derive userId
    // from the token, never from the body.
    let userId: string;
    let email: string;
    if (action === "check") {
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!jwt) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: authData, error: authError } = await admin.auth.getUser(jwt);
      if (authError || !authData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = authData.user.id;
      email = authData.user.email ?? "";
    } else {
      // "verify" runs after sign-out, so there is no session. Authentication is
      // proven by the 6-digit OTP code sent to the user's email and matched
      // against (user_id, code, expires_at, used=false) below.
      userId = body.userId;
      email = body.email ?? "";
      if (!userId || !code) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Rate limit by IP
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || userId || 'unknown';
    const rlMax = action === 'verify' ? RATE_LIMIT_MAX_VERIFY : RATE_LIMIT_MAX_CHECK;
    if (isRateLimited(`device:${action}:${clientIp}`, rlMax)) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (action === "check") {
      // Auto-trust admins — skip device verification entirely
      const { data: roleRows } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "super_admin"]);

      if (roleRows && roleRows.length > 0) {
        // Auto-trust this device for admin
        await admin.from("trusted_devices").upsert({
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          device_name: "Admin Device (auto-trusted)",
        }, { onConflict: "user_id,device_fingerprint" });

        return new Response(JSON.stringify({ trusted: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if device is trusted
      const { data } = await admin
        .from("trusted_devices")
        .select("id")
        .eq("user_id", userId)
        .eq("device_fingerprint", deviceFingerprint)
        .maybeSingle();

      if (data) {
        // Update last_used_at
        await admin
          .from("trusted_devices")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", data.id);

        return new Response(JSON.stringify({ trusted: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if user has ANY trusted devices (first login = auto-trust)
      const { count } = await admin
        .from("trusted_devices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (!count || count === 0) {
        // First ever device — auto-trust it
        await admin.from("trusted_devices").insert({
          user_id: userId,
          device_fingerprint: deviceFingerprint,
          device_name: "Primary Device",
        });
        return new Response(JSON.stringify({ trusted: true, firstDevice: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Device not trusted — generate and send code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Invalidate old codes
      await admin
        .from("device_verification_codes")
        .delete()
        .eq("user_id", userId)
        .eq("used", false);

      // Insert new code
      await admin.from("device_verification_codes").insert({
        user_id: userId,
        code: verificationCode,
        device_fingerprint: deviceFingerprint,
      });

      // Send email via transactional email if available, otherwise use auth email
      try {
        // Try to send via the Lovable email system
        const { error: emailError } = await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "device-verification",
            recipientEmail: email,
            idempotencyKey: `device-verify-${userId}-${Date.now()}`,
            templateData: { code: verificationCode },
          },
        });

        if (emailError) {
          console.log("Transactional email failed, code stored in DB for user:", userId);
        }
      } catch {
        console.log("Email service unavailable, code stored in DB for user:", userId);
      }

      return new Response(JSON.stringify({ trusted: false, codeSent: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      // Verify the code
      const { data: codeRecord } = await admin
        .from("device_verification_codes")
        .select("*")
        .eq("user_id", userId)
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!codeRecord) {
        return new Response(JSON.stringify({ verified: false, error: "Invalid or expired code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark code as used
      await admin
        .from("device_verification_codes")
        .update({ used: true })
        .eq("id", codeRecord.id);

      // Trust this device
      await admin.from("trusted_devices").upsert({
        user_id: userId,
        device_fingerprint: deviceFingerprint,
        device_name: "Verified Device",
      }, { onConflict: "user_id,device_fingerprint" });

      return new Response(JSON.stringify({ verified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Device verify error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
