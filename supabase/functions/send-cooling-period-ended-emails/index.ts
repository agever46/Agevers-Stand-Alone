import { requireServiceOrInternal } from '../_shared/adminAuth.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authFail = await requireServiceOrInternal(req, corsHeaders)
  if (authFail) return authFail

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // Find profiles created >24h ago that haven't been notified yet.
  // Limit batch to avoid runaway sends.
  const { data: pending, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, username, created_at, cooling_period_email_attempts')
    .eq('cooling_period_email_sent', false)
    .lt('cooling_period_email_attempts', 3)
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(100)

  if (error) {
    console.error('Failed to load pending profiles', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  let failed = 0

  for (const p of pending) {
    try {
      // Resolve email from auth.users
      const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(p.user_id)
      if (userErr || !userRes?.user?.email) {
        // Mark as sent to avoid retrying forever for orphaned profiles
        await supabase.from('profiles').update({ cooling_period_email_sent: true }).eq('user_id', p.user_id)
        continue
      }
      const email = userRes.user.email
      const name = p.display_name || p.username || null

      // Call the send function directly: the API gateway requires the
      // Authorization header to be a JWT-formatted key, so the service-role key
      // is passed via the dedicated x-internal-key header instead.
      const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'x-internal-key': serviceKey,
        },
        body: JSON.stringify({
          templateName: 'cooling-period-ended',
          recipientEmail: email,
          idempotencyKey: `cooling-ended-${p.user_id}`,
          templateData: { customerName: name },
        }),
      })

      if (!sendRes.ok) {
        console.error('Send failed for', p.user_id, sendRes.status, await sendRes.text())
        failed++
        const nextAttempts = (p.cooling_period_email_attempts ?? 0) + 1
        // After 3 failed attempts, mark as sent so we stop retrying the same recipient forever.
        const patch: Record<string, unknown> = { cooling_period_email_attempts: nextAttempts }
        if (nextAttempts >= 3) patch.cooling_period_email_sent = true
        await supabase.from('profiles').update(patch).eq('user_id', p.user_id)
        continue
      }

      await supabase.from('profiles').update({ cooling_period_email_sent: true }).eq('user_id', p.user_id)
      sent++
    } catch (e) {
      console.error('Unexpected error for', p.user_id, e)
      failed++
      const nextAttempts = (p.cooling_period_email_attempts ?? 0) + 1
      const patch: Record<string, unknown> = { cooling_period_email_attempts: nextAttempts }
      if (nextAttempts >= 3) patch.cooling_period_email_sent = true
      await supabase.from('profiles').update(patch).eq('user_id', p.user_id).then(() => {}, () => {})
    }
  }

  return new Response(JSON.stringify({ processed: pending.length, sent, failed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})