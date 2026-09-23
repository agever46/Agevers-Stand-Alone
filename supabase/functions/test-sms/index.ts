import { requireAdminOrService } from "../_shared/adminAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authFail = await requireAdminOrService(req, corsHeaders);
  if (authFail) return authFail;

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
  const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

  if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
    return new Response(JSON.stringify({ 
      error: "SMS service not configured", 
      hasAccountSid: !!accountSid, 
      hasAuthToken: !!authToken,
      hasFromNumber: !!fromNumber,
      hasMessagingServiceSid: !!messagingServiceSid
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { to, body, action } = await req.json();

    const basicAuthHdr = btoa(`${accountSid}:${authToken}`);

    if (action === "status") {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?To=${encodeURIComponent(to)}&PageSize=20`;
      const res = await fetch(url, { headers: { Authorization: `Basic ${basicAuthHdr}` } });
      const json = await res.json();
      const msgs = (json.messages || []).map((m: any) => ({
        sid: m.sid,
        to: m.to,
        status: m.status,
        error_code: m.error_code,
        error_message: m.error_message,
        date_sent: m.date_sent,
      }));
      return new Response(JSON.stringify({ status: res.status, messages: msgs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Sending SMS to:", to);

    const basicAuth = btoa(`${accountSid}:${authToken}`);
    const params = new URLSearchParams({
      To: to,
      Body: body || "Test from Agever's: Your verification code is 123456. This is a test message.",
    });
    if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
    else params.set("From", fromNumber!);

    const smsResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      }
    );

    const data = await smsResponse.text();
    console.log("Twilio response status:", smsResponse.status);
    console.log("Twilio response:", data);

    return new Response(JSON.stringify({ status: smsResponse.status, response: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
