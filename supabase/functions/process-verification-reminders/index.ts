// Cron-driven function: sends 24h/48h verification reminders and suspends
// accounts that have not verified their email within 72 hours.
// Triggered every hour by pg_cron.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { createHash } from 'node:crypto'
import { requireServiceOrInternal } from '../_shared/adminAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://agevers.com'
const SITE_NAME = 'Agevers'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authFail = await requireServiceOrInternal(req, corsHeaders)
  if (authFail) return authFail

  // Auth-only canary probe used by cron-health-monitor: confirms the
  // service-role/internal-token header still works without sending real reminders.
  if (new URL(req.url).searchParams.get('healthCheckOnly') === '1') {
    return new Response(JSON.stringify({ ok: true, healthCheck: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const summary = { reminders24h: 0, reminders48h: 0, suspended: 0, errors: [] as string[] }

  // Helper: send a reminder email and create a verification token
  const sendReminder = async (userId: string, email: string, window: '24h' | '48h') => {
    try {
      // create a fresh verification token (24h expiry)
      const token = crypto.randomUUID() + '-' + crypto.randomUUID()
      const tokenHash = createHash('sha256').update(token).digest('hex')

      const { error: tokenError } = await supabase.from('email_verification_tokens').insert({
        user_id: userId,
        token: tokenHash,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      if (tokenError) throw new Error(`token insert: ${tokenError.message}`)

      const verificationUrl = `${SITE_URL}/verify-email?token=${token}`
      const hoursLeft = window === '24h' ? 48 : 24

      const { error: sendError } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'email-verification-reminder',
          recipientEmail: email,
          idempotencyKey: `verify-reminder-${window}-${userId}`,
          templateData: {
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
            recipient: email,
            verificationUrl,
            hoursLeft,
          },
        },
      })
      if (sendError) throw new Error(`send: ${sendError.message}`)

      await supabase.rpc('mark_verification_reminder_sent', { _user_id: userId, _window: window })
      return true
    } catch (err) {
      summary.errors.push(`${window} ${userId}: ${(err as Error).message}`)
      return false
    }
  }

  // 1) 24h reminders
  const { data: users24, error: e24 } = await supabase.rpc('get_users_for_verification_reminder', { _window: '24h' })
  if (e24) summary.errors.push(`get_users 24h: ${e24.message}`)
  for (const u of users24 ?? []) {
    if (await sendReminder(u.user_id, u.email, '24h')) summary.reminders24h++
  }

  // 2) 48h reminders
  const { data: users48, error: e48 } = await supabase.rpc('get_users_for_verification_reminder', { _window: '48h' })
  if (e48) summary.errors.push(`get_users 48h: ${e48.message}`)
  for (const u of users48 ?? []) {
    if (await sendReminder(u.user_id, u.email, '48h')) summary.reminders48h++
  }

  // 3) Suspend accounts > 72h unverified
  const { data: suspendCount, error: eSuspend } = await supabase.rpc('suspend_unverified_accounts')
  if (eSuspend) summary.errors.push(`suspend: ${eSuspend.message}`)
  else summary.suspended = suspendCount ?? 0

  console.log('Verification reminders summary:', summary)
  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
