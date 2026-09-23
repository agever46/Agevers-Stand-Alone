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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' })
  const { data: isSuper } = await admin.rpc('has_role', { _user_id: user.id, _role: 'super_admin' })
  if (!isAdmin && !isSuper) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { user_ids } = await req.json() as { user_ids: string[] }
  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return new Response(JSON.stringify({ error: 'user_ids required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const { template } = await import('../_shared/transactional-email-templates/email-verification.tsx')
  const results: any[] = []

  for (const uid of user_ids) {
    try {
      // Reset verified flag so user must verify
      await admin.from('profiles').update({ email_verified: false, updated_at: new Date().toISOString() }).eq('user_id', uid)

      const { data: targetUser } = await admin.auth.admin.getUserById(uid)
      const email = targetUser?.user?.email
      if (!email) { results.push({ uid, ok: false, error: 'no email' }); continue }

      // Generate token
      const bytes = new Uint8Array(32)
      crypto.getRandomValues(bytes)
      const token = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')

      await admin.from('email_verification_tokens').insert({
        user_id: uid,
        token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })

      const verificationUrl = `${SITE_URL}/verify-email?token=${token}`
      const templateData = { siteName: SITE_NAME, siteUrl: SITE_URL, recipient: email, verificationUrl }
      const html = await renderAsync(React.createElement(template.component, templateData))
      const plainText = await renderAsync(React.createElement(template.component, templateData), { plainText: true })
      const subject = typeof template.subject === 'function' ? template.subject(templateData) : template.subject
      const messageId = crypto.randomUUID()

      const normalizedEmail = email.toLowerCase().trim()
      let unsubscribeToken: string
      const { data: existingUnsub } = await admin.from('email_unsubscribe_tokens').select('token').eq('email', normalizedEmail).maybeSingle()
      if (existingUnsub?.token) {
        unsubscribeToken = existingUnsub.token
      } else {
        const b2 = new Uint8Array(32); crypto.getRandomValues(b2)
        unsubscribeToken = Array.from(b2).map(b => b.toString(16).padStart(2, '0')).join('')
        await admin.from('email_unsubscribe_tokens').upsert({ token: unsubscribeToken, email: normalizedEmail }, { onConflict: 'email' })
      }

      await admin.from('email_send_log').insert({ message_id: messageId, template_name: 'email-verification', recipient_email: email, status: 'pending' })

      // Send directly via Resend API
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) {
        results.push({ uid, email, ok: false, error: 'RESEND_API_KEY not configured' })
        await admin.from('email_send_log').insert({ message_id: messageId, template_name: 'email-verification', recipient_email: email, status: 'failed', error_message: 'RESEND_API_KEY not configured' })
        continue
      }

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email],
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
        await admin.from('email_send_log').insert({ message_id: messageId, template_name: 'email-verification', recipient_email: email, status: 'failed', error_message: errMsg })
        results.push({ uid, email, ok: false, error: errMsg })
        continue
      }

      await admin.from('email_send_log').insert({ message_id: messageId, template_name: 'email-verification', recipient_email: email, status: 'sent' })
      results.push({ uid, email, ok: true, resend_id: resendBody?.id })
    } catch (e) {
      results.push({ uid, ok: false, error: (e as Error).message })
    }
  }

  return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
