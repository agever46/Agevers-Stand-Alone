// Reddit Conversions API — server-side mirror of the client-side Reddit Pixel
// Purchase event fired from OrderConfirmation.tsx. Sends the same conversion
// from the server too, so it isn't lost to ad blockers or browser privacy
// features. Uses the same conversionId as the client pixel event so Reddit
// can deduplicate the two into a single conversion.
//
// Best-effort only: this must never affect the order-confirmation page. Any
// failure here is logged and swallowed — the response is always 200.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PIXEL_ID = "a2_jiuswg63rg7s";

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("REDDIT_CAPI_ACCESS_TOKEN");
    if (!token) {
      console.warn("[reddit-capi-purchase] REDDIT_CAPI_ACCESS_TOKEN not set — skipping");
      return new Response(JSON.stringify({ skipped: true, reason: "no_token" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      conversionId, value, currency, itemCount, products,
      email, ipAddress, userAgent,
    } = body || {};

    if (!conversionId || typeof value !== "number") {
      throw new Error("conversionId and numeric value are required");
    }

    const user: Record<string, string> = {};
    if (email) user.email = await sha256Hex(String(email));
    if (ipAddress) user.ip_address = String(ipAddress);
    if (userAgent) user.user_agent = String(userAgent);

    // Reddit CAPI v2.0 requires event_metadata.value to be an integer —
    // sending a float (e.g. 99.9) gets rejected with a 400. Round to the
    // nearest whole currency unit; item_count/products stay as-is.
    const integerValue = Math.round(value);

    const payload = {
      test_mode: false,
      events: [
        {
          event_at: new Date().toISOString(),
          event_type: { tracking_type: "Purchase" },
          event_metadata: {
            currency: currency || "ILS",
            value: integerValue,
            item_count: typeof itemCount === "number" ? itemCount : undefined,
            conversion_id: String(conversionId),
            products: Array.isArray(products) ? products : undefined,
          },
          user: Object.keys(user).length > 0 ? user : undefined,
        },
      ],
    };

    const res = await fetch(`https://ads-api.reddit.com/api/v2.0/conversions/events/${PIXEL_ID}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resText = await res.text();
    if (!res.ok) {
      console.error(`[reddit-capi-purchase] Reddit API returned ${res.status}: ${resText}`);
      return new Response(JSON.stringify({ success: false, status: res.status, body: resText }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[reddit-capi-purchase] sent conversion ${conversionId}: ${resText}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[reddit-capi-purchase] error: ${err instanceof Error ? err.message : String(err)}`);
    return new Response(JSON.stringify({ success: false, error: "internal" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
