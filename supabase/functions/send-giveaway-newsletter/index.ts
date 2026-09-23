import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireAdminOrService } from '../_shared/adminAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authFail = await requireAdminOrService(req, corsHeaders)
    if (authFail) return authFail

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { campaignId } = await req.json() as { campaignId: string }
    if (!campaignId) {
      return new Response(JSON.stringify({ error: 'campaignId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: campaign, error: cErr } = await supabase
      .from('marketing_campaigns').select('*').eq('id', campaignId).single()
    if (cErr || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (campaign.status === 'sent' || campaign.status === 'sending') {
      return new Response(JSON.stringify({ error: `Already ${campaign.status}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: subs } = await supabase
      .from('newsletter_subscribers').select('email').limit(10000)
    let recipients = Array.from(new Set((subs ?? [])
      .map((s: any) => (s.email || '').toLowerCase().trim())
      .filter(Boolean)))

    const { data: unsubs } = await supabase.from('marketing_unsubscribes').select('email')
    const unsubSet = new Set((unsubs ?? []).map((u: any) => (u.email || '').toLowerCase()))
    recipients = recipients.filter((e) => !unsubSet.has(e))

    await supabase.from('marketing_campaigns').update({
      status: 'sending', total_recipients: recipients.length,
    }).eq('id', campaignId)

    const fromHeader = `${campaign.from_name} <${campaign.from_email}>`
    let sent = 0, failed = 0

    for (const email of recipients) {
      const unsubUrl = `https://agevers.com/unsubscribe-marketing?email=${encodeURIComponent(email)}`
      const footer = `<div style="margin-top:32px;padding:18px;background:#f5f5f5;text-align:center;font-size:12px;color:#666;font-family:Arial,sans-serif;border-radius:8px">You are receiving this because you subscribed to Agever's updates.<br/><a href="${unsubUrl}" style="color:#666;text-decoration:underline">Unsubscribe</a></div>`
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:20px;background:#ffffff;font-family:Arial,sans-serif;color:#222"><div style="max-width:600px;margin:0 auto">${campaign.html_content || ''}${footer}</div></body></html>`
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
            subject: campaign.subject,
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
      await new Promise((r) => setTimeout(r, 150))
    }

    await supabase.from('marketing_campaigns').update({
      status: failed === recipients.length && recipients.length > 0 ? 'failed' : 'sent',
      total_sent: sent, total_failed: failed, sent_at: new Date().toISOString(),
    }).eq('id', campaignId)

    return new Response(JSON.stringify({ success: true, sent, failed, total: recipients.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('send-giveaway-newsletter error', err)
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})