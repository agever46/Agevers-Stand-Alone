import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { requireAdminOrService } from '../_shared/adminAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRESENCE_WINDOW_SECONDS = 90
const THROTTLE_MINUTES = 5

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authFail = await requireAdminOrService(req, corsHeaders)
  if (authFail) return authFail

  try {
    const { requestId, messagePreview } = await req.json()
    if (!requestId || typeof requestId !== 'string') {
      return new Response(JSON.stringify({ error: 'requestId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Fetch chat request
    const { data: reqRow, error: reqErr } = await supabase
      .from('live_support_requests')
      .select('id, user_id, user_email, buyer_last_seen_at, last_buyer_notify_at, status')
      .eq('id', requestId)
      .maybeSingle()

    if (reqErr || !reqRow) {
      return new Response(JSON.stringify({ error: 'request not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (reqRow.status === 'closed') {
      return new Response(JSON.stringify({ skipped: 'closed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = Date.now()

    // Skip if buyer was active recently
    if (reqRow.buyer_last_seen_at) {
      const lastSeen = new Date(reqRow.buyer_last_seen_at).getTime()
      if (now - lastSeen < PRESENCE_WINDOW_SECONDS * 1000) {
        return new Response(JSON.stringify({ skipped: 'buyer_present' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Throttle
    if (reqRow.last_buyer_notify_at) {
      const lastNotify = new Date(reqRow.last_buyer_notify_at).getTime()
      if (now - lastNotify < THROTTLE_MINUTES * 60 * 1000) {
        return new Response(JSON.stringify({ skipped: 'throttled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (!reqRow.user_email) {
      return new Response(JSON.stringify({ skipped: 'no_email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const preview = typeof messagePreview === 'string'
      ? messagePreview.slice(0, 300)
      : ''

    // Mark first so we don't double-fire on races
    await supabase
      .from('live_support_requests')
      .update({ last_buyer_notify_at: new Date().toISOString() })
      .eq('id', requestId)

    const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        templateName: 'live-chat-new-message',
        recipientEmail: reqRow.user_email,
        idempotencyKey: `live-chat-msg-${requestId}-${Math.floor(now / (THROTTLE_MINUTES * 60 * 1000))}`,
        templateData: { messagePreview: preview },
      }),
    })

    if (!sendRes.ok) {
      const errText = await sendRes.text().catch(() => '')
      console.error('send-transactional-email error', sendRes.status, errText)
      return new Response(JSON.stringify({ error: 'send_failed', fallback: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('notify-buyer-chat-message error', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})