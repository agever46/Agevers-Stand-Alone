import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, code } = await req.json()
    if (!email || !code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email or code format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Find user by email
    const { data: usersList, error: lookupErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })
    if (lookupErr) throw lookupErr
    const matched = usersList.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase())
    if (!matched) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find unused, non-expired token with matching otp
    const { data: tokenRow } = await admin
      .from('email_verification_tokens')
      .select('id, expires_at, used')
      .eq('user_id', matched.id)
      .eq('otp_code', code)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!tokenRow) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ success: false, error: 'Code expired. Please request a new one.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mark token used + flag profile as verified
    await admin.from('email_verification_tokens').update({ used: true }).eq('id', tokenRow.id)
    await admin.from('profiles').update({ email_verified: true }).eq('user_id', matched.id)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('verify-email-otp error', err)
    return new Response(JSON.stringify({ success: false, error: 'Verification failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})