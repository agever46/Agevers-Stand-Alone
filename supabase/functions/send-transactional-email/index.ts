import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

// GDPR: never log full email addresses — log only the domain part.
function maskEmail(value?: string | null): string {
  if (!value) return 'unknown'
  const at = value.lastIndexOf('@')
  return at === -1 ? 'invalid' : `***@${value.slice(at + 1)}`
}


// Configuration baked in at scaffold time — do NOT change these manually.
// To update, re-run the email domain setup flow.
const SITE_NAME = "agevers-gamecodes"
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers — never the root domain.
// The email API looks up this exact domain; a mismatch causes "No email domain record found".
const SENDER_DOMAIN = "updates.agevers.com"
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// When display_from_root is enabled, this can be the root domain for cleaner branding,
// even though actual sending uses the subdomain above.
const FROM_DOMAIN = "updates.agevers.com"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-internal-key, x-internal-token, x-admin-retry-token',
}

// Shared internal token used by DB triggers (pg_net) that cannot hold the
// service-role key. Read from a server-side secret — never hardcode it.
// Checks V2 first to mirror telegram-notify's fallback, in case the token
// is ever rotated to INTERNAL_NOTIFY_TOKEN_V2 without updating this function.
const INTERNAL_NOTIFY_TOKEN = Deno.env.get('INTERNAL_NOTIFY_TOKEN_V3') || ''

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Auth note: this function uses verify_jwt = true in config.toml, so Supabase's
// gateway validates the caller's JWT (anon or service_role) before the request
// reaches this code. No in-function auth check is needed.

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Parse request body
  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  let messageId: string
  let templateData: Record<string, any> = {}
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    messageId = crypto.randomUUID()
    idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (!templateName) {
    return new Response(
      JSON.stringify({ error: 'templateName is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 1. Look up template from registry (early — needed to resolve recipient)
  const template = TEMPLATES[templateName]

  if (!template) {
    console.error('Template not found in registry', { templateName })
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Resolve effective recipient: template-level `to` takes precedence over
  // the caller-provided recipientEmail. This allows notification templates
  // to always send to a fixed address (e.g., site owner from env var).
  let effectiveRecipient = template.to || recipientEmail

  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Normalize: strip whitespace and unwrap "Name <email@x.com>" display-name
  // form, which Resend rejects with a 422 "Invalid `to` field".
  effectiveRecipient = String(effectiveRecipient).trim()
  const angleMatch = effectiveRecipient.match(/<([^<>]+)>\s*$/)
  if (angleMatch) {
    effectiveRecipient = angleMatch[1].trim()
  }

  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(effectiveRecipient)) {
    console.error('Invalid recipient email format', {
      templateName,
      recipientDomain: maskEmail(effectiveRecipient),
    })
    return new Response(
      JSON.stringify({ error: 'Invalid recipient email format' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }


  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // ===== Authorization =====
  // Service-role bypass; otherwise validate JWT and apply per-template policy
  // to prevent arbitrary users from triggering arbitrary emails to arbitrary
  // recipients (phishing / email-bombing).
  //
  // USER_TEMPLATE_POLICY whitelist: which templates a non-admin caller may
  // trigger, and who they may target:
  //   'self'  -> recipientEmail is forced to the caller's own email.
  //   'admin' -> recipientEmail is forced to admin@agevers.com.
  const USER_TEMPLATE_POLICY: Record<string, 'self' | 'admin'> = {
    'purchase-confirmation': 'self',
    'live-support-request': 'admin',
    'sms-otp': 'self',
  }
  const ADMIN_NOTIFY_EMAIL = 'admin@agevers.com'

  const authToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  // Server-to-server callers (other edge functions) may present the service-role
  // key in a dedicated header, because the API gateway requires the Authorization
  // header itself to be a JWT-formatted key.
  const internalKey = req.headers.get('x-internal-key') || ''
  const opsToken = Deno.env.get('ADMIN_RETRY_TOKEN') || ''
  const isInternalCaller = internalKey === supabaseServiceKey ||
    (!!INTERNAL_NOTIFY_TOKEN && req.headers.get('x-internal-token') === INTERNAL_NOTIFY_TOKEN) ||
    (!!opsToken && req.headers.get('x-admin-retry-token') === opsToken)
  // Also accept any JWT whose payload declares role=service_role. The literal
  // key comparison above breaks whenever the platform rotates/rebinds keys, so
  // DB triggers (pg_net) calling with the current service-role key would 401.
  const isServiceRoleJwt = (() => {
    try {
      const parts = authToken.split('.')
      if (parts.length !== 3) return false
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      return payload?.role === 'service_role'
    } catch {
      return false
    }
  })()
  // Will reassign effectiveRecipient if non-admin caller policy demands it.
  if (!isInternalCaller && !isServiceRoleJwt && authToken !== supabaseServiceKey) {
    if (!authToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(authToken)
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const caller = userData.user
    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', caller.id)
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin')
    if (!isAdmin) {
      const policy = USER_TEMPLATE_POLICY[templateName]
      if (!policy) {
        return new Response(JSON.stringify({ error: 'Forbidden: template not allowed for this caller' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (policy === 'self') {
        const callerEmail = (caller.email || '').toLowerCase()
        if (!callerEmail) {
          return new Response(JSON.stringify({ error: 'Caller has no email' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        // Force recipient to caller's own email — prevents addressing arbitrary victims.
        effectiveRecipient = callerEmail
      } else if (policy === 'admin') {
        // Always send to admin inbox, ignore client-supplied recipient.
        effectiveRecipient = ADMIN_NOTIFY_EMAIL
      }
    }
  }

  // 1.5. Check active email provider — allows runtime switching to Resend
  let activeProvider: 'lovable' | 'resend' = 'lovable'
  try {
    const { data: settings } = await supabase
      .from('site_settings')
      .select('email_provider')
      .eq('id', 1)
      .single()
    if (settings?.email_provider === 'resend') {
      activeProvider = 'resend'
    }
  } catch (e) {
    console.warn('Could not read email_provider, falling back to lovable', e)
  }

  // 2. Check suppression list (fail-closed: if we can't verify, don't send)
  // The admin notification inbox is exempt — these are operational alerts
  // (new orders, signups, support), not marketing, and must always arrive.
  const { data: suppressed, error: suppressionError } =
    effectiveRecipient.toLowerCase() === ADMIN_NOTIFY_EMAIL
      ? { data: null, error: null }
      : await supabase
          .from('suppressed_emails')
          .select('id')
          .eq('email', effectiveRecipient.toLowerCase())
          .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed — refusing to send', {
      error: suppressionError,
      recipientDomain: maskEmail(effectiveRecipient),
    })
    return new Response(
      JSON.stringify({ error: 'Failed to verify suppression status' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (suppressed) {
    // Log the suppressed attempt
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
    })

    console.log('Email suppressed', { recipientDomain: maskEmail(effectiveRecipient), templateName })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 3. Get or create unsubscribe token (one token per email address)
  const normalizedEmail = effectiveRecipient.toLowerCase()
  let unsubscribeToken: string

  // Check for existing token for this email
  const { data: existingToken, error: tokenLookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (tokenLookupError) {
    console.error('Token lookup failed', {
      error: tokenLookupError,
      recipientDomain: maskEmail(normalizedEmail),
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to look up unsubscribe token',
    })
    return new Response(
      JSON.stringify({ error: 'Failed to prepare email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  const isAdminNotifyInbox = normalizedEmail === ADMIN_NOTIFY_EMAIL
  if (existingToken && (!existingToken.used_at || isAdminNotifyInbox)) {
    // Reuse existing unused token
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    // Create new token — upsert handles concurrent inserts gracefully
    unsubscribeToken = generateToken()
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true }
      )

    if (tokenError) {
      console.error('Failed to create unsubscribe token', {
        error: tokenError,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to create unsubscribe token',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If another request raced us, our upsert was silently ignored.
    // Re-read to get the actual stored token.
    const { data: storedToken, error: reReadError } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (reReadError || !storedToken) {
      console.error('Failed to read back unsubscribe token after upsert', {
        error: reReadError,
        email: normalizedEmail,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to confirm unsubscribe token storage',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    unsubscribeToken = storedToken.token
  } else {
    // Token exists but is already used — email should have been caught by suppression check above.
    // This is a safety fallback; log and skip sending.
    console.warn('Unsubscribe token already used but email not suppressed', {
      recipientDomain: maskEmail(normalizedEmail),
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      error_message:
        'Unsubscribe token used but email missing from suppressed list',
    })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 4. Render React Email template to HTML and plain text
  const html = await renderAsync(
    React.createElement(template.component, templateData)
  )
  let plainText = ''
  try {
    plainText = await renderAsync(
      React.createElement(template.component, templateData),
      { plainText: true }
    )
  } catch (err) {
    console.warn('Failed to render plain text version, falling back to HTML stripping', err)
    // Simple fallback: strip HTML tags from the HTML version if plainText rendering fails
    plainText = html.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim()
  }

  // Resolve subject — supports static string or dynamic function
  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // Ensure text is never empty as the Lovable API requires it
  if (!plainText || plainText.trim().length === 0) {
    plainText = resolvedSubject || 'New message from Agever\'s'
  }

  // 5a. RESEND PROVIDER PATH — direct send via Resend API (bypasses Lovable queue)
  if (activeProvider === 'resend') {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('Resend selected but RESEND_API_KEY missing')
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'RESEND_API_KEY not configured',
      })
      return new Response(JSON.stringify({ error: 'Resend not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'pending',
    })

    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: `Agever's <noreply@updates.agevers.com>`,
          to: [effectiveRecipient],
          subject: resolvedSubject,
          html,
          text: plainText,
        }),
      })
      const resendData = await resendRes.json()
      if (!resendRes.ok) {
        console.error('Resend send failed', resendData)
        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: templateName,
          recipient_email: effectiveRecipient,
          status: 'failed',
          error_message: `Resend: ${resendData?.message || resendRes.statusText}`,
        })
        return new Response(
          JSON.stringify({ error: 'Resend send failed', details: resendData }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'sent',
      })

      console.log('Transactional email sent via Resend', { templateName, recipientDomain: maskEmail(effectiveRecipient), resendId: resendData?.id })
      return new Response(
        JSON.stringify({ success: true, provider: 'resend', id: resendData?.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (err: any) {
      console.error('Resend error', err)
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: `Resend exception: ${err?.message || err}`,
      })
      return new Response(JSON.stringify({ error: 'Resend exception', message: String(err?.message || err) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
  // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', {
      error: enqueueError,
      templateName,
      recipientDomain: maskEmail(effectiveRecipient),
    })

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })

    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Transactional email enqueued', { templateName, recipientDomain: maskEmail(effectiveRecipient) })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
