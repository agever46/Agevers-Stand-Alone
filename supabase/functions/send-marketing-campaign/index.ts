import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReqBody {
  campaignId: string
}

const UNSUB_BASE = 'https://agevers.com/unsubscribe-marketing'

function buildHtml(content: string, unsubUrl: string): string {
  const footer = `
    <div style="margin-top:40px;padding:20px;background:#f5f5f5;text-align:center;font-size:12px;color:#666;font-family:Arial,sans-serif;border-radius:8px">
      You are receiving this email because you subscribed to Agever's marketing updates.<br/>
      <a href="${unsubUrl}" style="color:#666;text-decoration:underline">Unsubscribe from marketing emails</a>
    </div>`
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:20px;background:#ffffff;font-family:Arial,sans-serif;color:#222"><div style="max-width:600px;margin:0 auto">${content}${footer}</div></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: roleRow } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'super_admin']).maybeSingle()
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { campaignId } = (await req.json()) as ReqBody
    if (!campaignId) {
      return new Response(JSON.stringify({ error: 'campaignId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: campaign, error: cErr } = await supabase
      .from('marketing_campaigns').select('*').eq('id', campaignId).single()
    if (cErr || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (campaign.status === 'sent' || campaign.status === 'sending') {
      return new Response(JSON.stringify({ error: `Campaign already ${campaign.status}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve recipients
    const filter = (campaign.recipient_filter ?? {}) as Record<string, any>
    const mode: string = filter.mode || 'all_subscribers'
    let recipients: string[] = []

    if (mode === 'manual' && Array.isArray(filter.emails)) {
      recipients = filter.emails.filter((e: any) => typeof e === 'string')
    } else if (mode === 'all_subscribers') {
      const { data: subs } = await supabase
        .from('newsletter_subscribers').select('email').limit(10000)
      recipients = (subs ?? []).map((s: any) => s.email).filter(Boolean)
    } else if (mode === 'all_users') {
      const { data: profs } = await supabase
        .from('profiles').select('email').not('email', 'is', null).limit(10000)
      recipients = (profs ?? []).map((p: any) => p.email).filter(Boolean)
    }

    // Dedupe + lowercase
    recipients = Array.from(new Set(recipients.map(e => e.toLowerCase().trim()))).filter(Boolean)

    // Filter out unsubscribed
    const { data: unsubs } = await supabase
      .from('marketing_unsubscribes').select('email')
    const unsubSet = new Set((unsubs ?? []).map((u: any) => u.email.toLowerCase()))
    recipients = recipients.filter(e => !unsubSet.has(e))

    await supabase.from('marketing_campaigns').update({
      status: 'sending', total_recipients: recipients.length,
    }).eq('id', campaignId)

    let sent = 0, failed = 0
    const fromHeader = `${campaign.from_name} <${campaign.from_email}>`

    // Pre-fetch referral codes for personalization ({{referral_link}})
    const refMap = new Map<string, string>()
    if ((campaign.html_content || '').includes('{{referral_link}}') || (campaign.subject || '').includes('{{referral_link}}')) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('email', recipients)
      const userIds = (profs ?? []).map((p: any) => p.user_id)
      if (userIds.length) {
        const { data: codes } = await supabase
          .from('referral_codes')
          .select('user_id, code')
          .in('user_id', userIds)
        const codeByUser = new Map((codes ?? []).map((c: any) => [c.user_id, c.code]))
        for (const p of (profs ?? []) as any[]) {
          const code = codeByUser.get(p.user_id)
          if (code && p.email) refMap.set(p.email.toLowerCase(), `https://agevers.com/?ref=${code}`)
        }
      }
    }

    for (const email of recipients) {
      const unsubUrl = `${UNSUB_BASE}?email=${encodeURIComponent(email)}`
      const refLink = refMap.get(email) || 'https://agevers.com/account'
      const personalized = (campaign.html_content || '').replaceAll('{{referral_link}}', refLink)
      const personalizedSubject = (campaign.subject || '').replaceAll('{{referral_link}}', refLink)
      const html = buildHtml(personalized, unsubUrl)
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: fromHeader,
            to: [email],
            subject: personalizedSubject,
            html,
            headers: {
              'List-Unsubscribe': `<${unsubUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          failed++
          await supabase.from('marketing_send_log').insert({
            campaign_id: campaignId, recipient_email: email,
            status: 'failed', error_message: data?.message || res.statusText,
          })
        } else {
          sent++
          await supabase.from('marketing_send_log').insert({
            campaign_id: campaignId, recipient_email: email,
            status: 'sent', resend_id: data?.id,
          })
        }
      } catch (e: any) {
        failed++
        await supabase.from('marketing_send_log').insert({
          campaign_id: campaignId, recipient_email: email,
          status: 'failed', error_message: String(e?.message || e),
        })
      }
      // Small delay to respect Resend rate limits (10/sec)
      await new Promise(r => setTimeout(r, 120))
    }

    await supabase.from('marketing_campaigns').update({
      status: failed === recipients.length && recipients.length > 0 ? 'failed' : 'sent',
      total_sent: sent, total_failed: failed, sent_at: new Date().toISOString(),
    }).eq('id', campaignId)

    return new Response(JSON.stringify({ success: true, sent, failed, total: recipients.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('send-marketing-campaign error', err)
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})