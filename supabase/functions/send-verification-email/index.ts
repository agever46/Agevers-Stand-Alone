import { createClient } from 'npm:@supabase/supabase-js@2'
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'

const SITE_NAME = 'Agevers'
const SITE_URL = 'https://agevers.com'
const SENDER_DOMAIN = 'updates.agevers.com'
const FROM_EMAIL = `${SITE_NAME} <noreply@${SENDER_DOMAIN}>`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const requestBody = await req.json().catch(() => ({})) as { email?: string; userId?: string }

  // Authenticate the caller when a session is available. Fresh signups and blocked
  // unverified logins can request an OTP by email because they do not have a session yet.
  const authHeader = req.headers.get('Authorization')
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: settings, error: settingsError } = await admin
    .from('site_settings')
    .select('maintenance_mode')
    .eq('id', 1)
    .maybeSingle()

  if (settingsError || settings?.maintenance_mode !== false) {
    return new Response(JSON.stringify({ error: 'Email requests are disabled while the site is closed' }), {
      status: 423,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let user: { id: string; email?: string | null } | null = null

  // 1) Prefer the authenticated caller — a signed-in user may only request a
  //    verification email for their own account.
  if (authHeader) {
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: authUser } } = await supabaseUser.auth.getUser()
    if (authUser) user = authUser
  }

  // 2) No session (fresh signup / unverified login blocked): allow lookup by email,
  //    but ONLY for accounts created in the last hour. Otherwise anyone could push
  //    verification mail — and an auth email_confirm — onto any existing account.
  if (!user && requestBody.email) {
    const normalizedEmail = requestBody.email.toLowerCase().trim()
    const { data: usersList, error: lookupError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (lookupError) {
      console.error('Failed to look up user for verification email:', lookupError)
      return new Response(JSON.stringify({ error: 'Failed to look up account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const matched = usersList.users.find((u) => u.email?.toLowerCase() === normalizedEmail && (!requestBody.userId || u.id === requestBody.userId))
    const isFreshSignup = matched?.created_at
      ? (Date.now() - new Date(matched.created_at).getTime()) < 60 * 60 * 1000
      : false
    if (matched && isFreshSignup) {
      user = matched
    } else if (matched) {
      // Do not reveal whether the account exists.
      return new Response(JSON.stringify({ error: 'Please sign in to request a new verification email' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Only the account owner (signed in) or a brand-new signup may have its
  // auth email marked confirmed. Anyone could otherwise post a stranger's
  // address here and get that account confirmed without proving control.
  let callerUserId: string | null = null
  if (authHeader) {
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: callerUser } } = await callerClient.auth.getUser()
    callerUserId = callerUser?.id ?? null
  }

  if (!user?.id || !user.email) {
    return new Response(JSON.stringify({ error: 'Account not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userCreatedAt = (user as { created_at?: string }).created_at
  const isFreshSignup = !!userCreatedAt && Date.now() - new Date(userCreatedAt).getTime() < 60 * 60 * 1000
  const mayConfirmEmail = callerUserId === user.id || isFreshSignup

  // Check if already verified
  const { data: profile } = await admin
    .from('profiles')
    .select('email_verified')
    .eq('user_id', user.id)
    .single()

  if (profile?.email_verified) {
    return new Response(JSON.stringify({ message: 'Already verified' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Rate limit: max 1 token per 2 minutes per user
  const { data: recentToken } = await admin
    .from('email_verification_tokens')
    .select('id')
    .eq('user_id', user.id)
    .eq('used', false)
    .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle()

  if (recentToken) {
    if (mayConfirmEmail) {
      await admin.auth.admin.updateUserById(user.id, { email_confirm: true }).catch((confirmErr) => {
        console.error('Failed to mark auth email confirmed:', confirmErr)
      })
    }
    return new Response(JSON.stringify({ error: 'Please wait 2 minutes before requesting another verification email' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Generate token (for link) and 6-digit OTP code
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const otpBytes = new Uint8Array(4)
  crypto.getRandomValues(otpBytes)
  const otpNum = ((otpBytes[0] << 24) | (otpBytes[1] << 16) | (otpBytes[2] << 8) | otpBytes[3]) >>> 0
  const otpCode = (otpNum % 1000000).toString().padStart(6, '0')

  // Store token + OTP
  const { error: insertError } = await admin
    .from('email_verification_tokens')
    .insert({
      user_id: user.id,
      token,
      otp_code: otpCode,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })

  if (insertError) {
    console.error('Failed to insert token:', insertError)
    return new Response(JSON.stringify({ error: 'Failed to create verification token' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (mayConfirmEmail) {
    await admin.auth.admin.updateUserById(user.id, { email_confirm: true }).catch((confirmErr) => {
      console.error('Failed to mark auth email confirmed:', confirmErr)
    })
  }

  const verificationUrl = `${SITE_URL}/verify-email?token=${token}`

  // Render email template
  const { template } = await import('../_shared/transactional-email-templates/email-verification.tsx')
  const templateData = {
    siteName: SITE_NAME,
    siteUrl: SITE_URL,
    recipient: user.email,
    verificationUrl,
    otpCode,
  }

  let html: string
  let plainText: string
  try {
    html = await renderAsync(React.createElement(template.component, templateData))
    plainText = await renderAsync(React.createElement(template.component, templateData), { plainText: true })
  } catch (renderErr) {
    console.error('Failed to render verification email:', renderErr)
    return new Response(JSON.stringify({ error: 'Failed to render verification email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const subject = typeof template.subject === 'function' ? template.subject(templateData) : template.subject
  const messageId = crypto.randomUUID()

  // Get or create unsubscribe token for this email
  const normalizedEmail = user.email!.toLowerCase().trim()
  let unsubscribeToken: string

  const { data: existingUnsub } = await admin
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingUnsub?.token) {
    unsubscribeToken = existingUnsub.token
  } else {
    const bytes2 = new Uint8Array(32)
    crypto.getRandomValues(bytes2)
    unsubscribeToken = Array.from(bytes2).map(b => b.toString(16).padStart(2, '0')).join('')
    await admin.from('email_unsubscribe_tokens').upsert(
      { token: unsubscribeToken, email: normalizedEmail },
      { onConflict: 'email' }
    )
  }

  await admin.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'email-verification',
    recipient_email: user.email,
    status: 'pending',
  })

  // Send directly via Resend API (Lovable Emails is disabled — Resend only)
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    await admin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'email-verification',
      recipient_email: user.email,
      status: 'failed',
      error_message: 'RESEND_API_KEY not configured',
    })
    return new Response(JSON.stringify({ error: 'Email service not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [user.email],
        subject,
        html,
        text: plainText,
        headers: {
          'List-Unsubscribe': `<${SITE_URL}/unsubscribe?token=${unsubscribeToken}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    })

    const resendBody = await resendRes.json().catch(() => ({}))

    if (!resendRes.ok) {
      const errMsg = resendBody?.message || resendBody?.error || `Resend HTTP ${resendRes.status}`
      console.error('Resend send failed:', errMsg, resendBody)
      await admin.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'email-verification',
        recipient_email: user.email,
        status: 'failed',
        error_message: errMsg,
      })
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await admin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'email-verification',
      recipient_email: user.email,
      status: 'sent',
    })

    return new Response(JSON.stringify({ message: 'Verification email sent', resend_id: resendBody?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (sendErr) {
    console.error('Failed to send via Resend:', sendErr)
    await admin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'email-verification',
      recipient_email: user.email,
      status: 'failed',
      error_message: (sendErr as Error).message,
    })
    return new Response(JSON.stringify({ error: 'Failed to send verification email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
