// Standby Resend email sender.
// Not wired into the auth/registration flow yet — Lovable Emails remains the active provider.
// To activate: invoke from client/server code with { to, subject, html, text?, from? }.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_FROM = "Agever's <noreply@updates.agevers.com>";

interface SendBody {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  reply_to?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Service-role only — this is an internal email relay, NOT a public endpoint.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!serviceKey || authToken !== serviceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('RESEND_API_KEY is not configured');
    return new Response(JSON.stringify({ error: 'Resend is not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate
  if (!body || typeof body !== 'object') {
    return new Response(JSON.stringify({ error: 'Body required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!body.to || (Array.isArray(body.to) && body.to.length === 0)) {
    return new Response(JSON.stringify({ error: '"to" is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const recipients = Array.isArray(body.to) ? body.to : [body.to];
  for (const r of recipients) {
    if (typeof r !== 'string' || !isValidEmail(r)) {
      return new Response(JSON.stringify({ error: `Invalid recipient: ${r}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
  if (!body.subject || typeof body.subject !== 'string') {
    return new Response(JSON.stringify({ error: '"subject" is required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!body.html && !body.text) {
    return new Response(JSON.stringify({ error: 'Provide "html" or "text"' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const payload: Record<string, unknown> = {
    from: body.from || DEFAULT_FROM,
    to: recipients,
    subject: body.subject,
  };
  if (body.html) payload.html = body.html;
  if (body.text) payload.text = body.text;
  if (body.reply_to) payload.reply_to = body.reply_to;
  if (body.cc) payload.cc = body.cc;
  if (body.bcc) payload.bcc = body.bcc;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('Resend API error', res.status, data);
      return new Response(JSON.stringify({ error: 'Resend send failed', status: res.status, details: data }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: (data as any)?.id ?? null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-email-resend error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});