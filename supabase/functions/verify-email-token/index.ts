import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    // Also try body
    try {
      const body = await req.json()
      if (body.token) {
        return await verifyToken(body.token)
      }
    } catch {}
    return new Response(JSON.stringify({ error: 'Missing token' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return await verifyToken(token)
})

async function verifyToken(token: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: result } = await admin.rpc('verify_email_token', { _token: token })

  if (result) {
    return new Response(JSON.stringify({ success: true, message: 'Email verified successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } else {
    return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
