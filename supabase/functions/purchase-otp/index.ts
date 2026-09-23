import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { action } = body;

    if (action === "send") {
      const channel = body?.channel === "email" ? "email" : "sms";
      // Rate limit: max 3 OTPs per user in last 5 minutes
      const { data: recentOtps } = await adminClient
        .from("purchase_otp_codes")
        .select("id")
        .eq("user_id", user.id)
        .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

      if (recentOtps && recentOtps.length >= 3) {
        return new Response(JSON.stringify({ sent: false, error: "Too many OTP requests. Please wait a few minutes." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user's phone from profile
      const { data: profile } = await adminClient
        .from("profiles")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle();

      // Normalize: strip all whitespace from stored phone (some legacy entries have spaces)
      const phone = profile?.phone?.replace(/\s+/g, "").trim();
      if (!phone && channel === "sms") {
        console.error("No phone linked for user", { user_id: user.id });
        return new Response(JSON.stringify({ sent: false, error: "No phone number is linked to your account. Please contact customer support to add or change your phone number — or use the email option below to receive your code." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate E.164 format
      if (channel === "sms" && !/^\+\d{7,15}$/.test(phone!)) {
        console.error("Invalid phone format for user", { user_id: user.id });
        return new Response(JSON.stringify({ sent: false, error: "The phone number on your account is not in a valid international format. Please contact customer support to update it — or use the email option below to receive your code." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // === Twilio Lookup: Block VoIP numbers ===
      const accountSidLookup = Deno.env.get("TWILIO_ACCOUNT_SID");
      const authTokenLookup = Deno.env.get("TWILIO_AUTH_TOKEN");
      if (channel === "sms" && accountSidLookup && authTokenLookup) {
        try {
          const lookupBasicAuth = btoa(`${accountSidLookup}:${authTokenLookup}`);
          const lookupRes = await fetch(
            `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=line_type_intelligence`,
            {
              headers: { "Authorization": `Basic ${lookupBasicAuth}` },
              signal: AbortSignal.timeout(5000),
            }
          );
          if (lookupRes.ok) {
            const lookupData = await lookupRes.json();
            const lineType = lookupData?.line_type_intelligence?.type || '';
            if (lineType === 'voip' || lineType === 'tollFree' || lineType === 'virtual') {
              console.log("VoIP/virtual number blocked", { user_id: user.id, lineType });
              return new Response(JSON.stringify({ sent: false, error: "VoIP and virtual phone numbers are not allowed. Please use a mobile number." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          } else {
            const errText = await lookupRes.text();
            console.error("Twilio Lookup error:", lookupRes.status, errText);
            // Non-blocking: allow if lookup fails
          }
        } catch (lookupErr) {
          console.error("Twilio Lookup exception:", lookupErr);
          // Non-blocking: allow if lookup fails
        }
      }

      // Generate 6-digit code
      // Cryptographically secure 6-digit code (Math.random is predictable).
      const rnd = new Uint32Array(1);
      crypto.getRandomValues(rnd);
      const code = String(100000 + (rnd[0] % 900000));

      // Store OTP
      await adminClient.from("purchase_otp_codes").insert({
        user_id: user.id,
        phone: phone || "email",
        code,
      });

      // === Email channel (fallback for users who cannot receive SMS) ===
      if (channel === "email") {
        const email = user.email;
        if (!email) {
          return new Response(JSON.stringify({ sent: false, error: "No email on file." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: mailData, error: mailError } = await adminClient.functions.invoke("send-transactional-email", {
          body: {
            templateName: "purchase-otp-email",
            recipientEmail: email,
            idempotencyKey: `purchase-otp-${user.id}-${code}`,
            templateData: { code },
          },
        });
        if (mailError || mailData?.error) {
          console.error("Email OTP send error:", mailError || mailData?.error);
          return new Response(JSON.stringify({ sent: false, error: `Failed to send email code: ${mailError?.message || mailData?.error || "Unknown error"}` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const maskedEmail = email.replace(/^(.).*(@.*)$/, "$1•••$2");
        return new Response(JSON.stringify({ sent: true, channel: "email", maskedPhone: maskedEmail }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send via Twilio SMS
      const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
      const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

      if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
        console.error("Twilio not configured");
        return new Response(JSON.stringify({ error: "SMS service not configured. Please contact support." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const basicAuth = btoa(`${accountSid}:${authToken}`);
      const smsParams = new URLSearchParams({
        To: phone,
        Body: `Agever's: Your purchase verification code is ${code}. It expires in 5 minutes. Do not share this code.`,
      });
      if (messagingServiceSid) smsParams.set("MessagingServiceSid", messagingServiceSid);
      else smsParams.set("From", fromNumber!);

      const smsResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: smsParams,
        }
      );

      if (!smsResponse.ok) {
        const errData = await smsResponse.text();
        console.error("Twilio SMS error:", smsResponse.status, errData);
        return new Response(JSON.stringify({ sent: false, emailFallback: true, error: "Failed to send SMS. You can receive the code by email instead." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mask phone for UI: show last 4 digits
      const maskedPhone = "•••••" + phone!.slice(-4);

      return new Response(JSON.stringify({ sent: true, channel: "sms", maskedPhone }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const { code } = body;
      if (!code || typeof code !== "string" || code.length !== 6) {
        return new Response(JSON.stringify({ error: "Invalid code format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find valid OTP
      const { data: otpRecord } = await adminClient
        .from("purchase_otp_codes")
        .select("*")
        .eq("user_id", user.id)
        .eq("code", code)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otpRecord) {
        return new Response(JSON.stringify({ verified: false, error: "Invalid or expired code" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark as used
      await adminClient
        .from("purchase_otp_codes")
        .update({ used: true })
        .eq("id", otpRecord.id);

      return new Response(JSON.stringify({ verified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("purchase-otp error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
