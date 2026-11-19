import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface TicketNotificationPayload {
  ticket_id: string
  action: 'seller_response' | 'admin_resolved' | 'admin_refund' | 'admin_closed' | 'ticket_created' | 'ticket_escalated'
  buyer_email: string
  game_title: string
  seller_response?: string
  admin_note?: string
}

function renderTicketEmail(payload: TicketNotificationPayload): { subject: string; html: string } {
  const { action, game_title, seller_response, admin_note } = payload

  let subject = ''
  let heading = ''
  let body = ''
  let statusColor = '#7c3aed'
  let statusLabel = ''

  switch (action) {
    case 'ticket_created':
      subject = `Ticket Received – ${game_title}`
      heading = 'Your Ticket Has Been Received'
      body = `We've received your support ticket for <strong>${game_title}</strong>. Our seller will review it and respond as soon as possible.`
      statusLabel = 'Open'
      statusColor = '#ef4444'
      break
    case 'seller_response':
      subject = `Seller Responded – ${game_title}`
      heading = 'Seller Has Responded'
      body = `The seller has responded to your ticket for <strong>${game_title}</strong>.`
      if (seller_response) {
        body += `<div style="background:#2a2a3e;border-radius:8px;padding:16px;margin:16px 0;color:#e2e8f0;font-size:14px;">"${seller_response}"</div>`
      }
      statusLabel = 'In Progress'
      statusColor = '#f59e0b'
      break
    case 'ticket_escalated':
      subject = `Ticket Escalated – ${game_title}`
      heading = 'Ticket Escalated to Admin'
      body = `Your ticket for <strong>${game_title}</strong> has been escalated to our admin team for review. We'll get back to you shortly.`
      statusLabel = 'Under Review'
      statusColor = '#f97316'
      break
    case 'admin_resolved':
      subject = `Ticket Resolved – ${game_title}`
      heading = 'Your Ticket Has Been Resolved'
      body = `Your support ticket for <strong>${game_title}</strong> has been resolved by our team.`
      if (admin_note) {
        body += `<div style="background:#2a2a3e;border-radius:8px;padding:16px;margin:16px 0;color:#e2e8f0;font-size:14px;"><strong>Admin Note:</strong><br/>${admin_note}</div>`
      }
      statusLabel = 'Resolved'
      statusColor = '#22c55e'
      break
    case 'admin_refund':
      subject = `Refund Approved – ${game_title}`
      heading = 'Refund Has Been Approved'
      body = `A refund has been approved for your ticket regarding <strong>${game_title}</strong>.`
      if (admin_note) {
        body += `<div style="background:#2a2a3e;border-radius:8px;padding:16px;margin:16px 0;color:#e2e8f0;font-size:14px;"><strong>Admin Note:</strong><br/>${admin_note}</div>`
      }
      statusLabel = 'Refund'
      statusColor = '#22c55e'
      break
    case 'admin_closed':
      subject = `Ticket Closed – ${game_title}`
      heading = 'Your Ticket Has Been Closed'
      body = `Your support ticket for <strong>${game_title}</strong> has been closed.`
      if (admin_note) {
        body += `<div style="background:#2a2a3e;border-radius:8px;padding:16px;margin:16px 0;color:#e2e8f0;font-size:14px;"><strong>Admin Note:</strong><br/>${admin_note}</div>`
      }
      statusLabel = 'Closed'
      statusColor = '#6b7280'
      break
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#161622;font-family:'Rajdhani',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#161622;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e1e2e;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="padding:32px 40px 16px;text-align:center;">
          <img src="https://lqkxxlvhcynxjuydkjha.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="Agevers" height="40" style="background:#1e1e2e;border-radius:8px;padding:12px;"/>
        </td></tr>
        <!-- Status Badge -->
        <tr><td style="padding:0 40px 8px;text-align:center;">
          <span style="display:inline-block;background:${statusColor};color:#fff;font-size:12px;font-weight:700;padding:4px 14px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;font-family:'Orbitron',monospace,sans-serif;">${statusLabel}</span>
        </td></tr>
        <!-- Heading -->
        <tr><td style="padding:8px 40px 8px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;font-family:'Orbitron',monospace,sans-serif;letter-spacing:1px;">${heading}</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:16px 40px 32px;color:#cbd5e1;font-size:15px;line-height:1.6;">
          ${body}
          <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;">You can view your ticket status anytime in your account dashboard.</p>
        </td></tr>
        <!-- CTA -->
        <tr><td style="padding:0 40px 32px;text-align:center;">
          <a href="https://agevers.com/account" style="display:inline-block;background:#7c3aed;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;font-family:'Orbitron',monospace,sans-serif;letter-spacing:1px;">VIEW MY TICKETS</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #2a2a3e;text-align:center;">
          <p style="margin:0;color:#64748b;font-size:12px;">© ${new Date().getFullYear()} Agevers. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Require authenticated caller
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawPayload: TicketNotificationPayload = await req.json()
    if (!rawPayload.ticket_id || !rawPayload.action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Accept service-role callers OR authenticated buyer/seller/admin of the ticket
    const isService = token === supabaseServiceKey
    let callerId: string | null = null
    if (!isService) {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
      if (userErr || !userData.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      callerId = userData.user.id
    }

    // Load ticket to get authoritative buyer_email and validate ownership
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from('support_tickets')
      .select('id, buyer_id, seller_id, buyer_email')
      .eq('id', rawPayload.ticket_id)
      .single()
    if (ticketErr || !ticket) {
      return new Response(JSON.stringify({ error: 'Ticket not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!isService) {
      const isBuyer = callerId === ticket.buyer_id
      const isSeller = callerId === ticket.seller_id
      let isAdmin = false
      if (!isBuyer && !isSeller) {
        const { data: roles } = await supabaseAdmin
          .from('user_roles').select('role').eq('user_id', callerId!)
        isAdmin = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin')
      }
      if (!isBuyer && !isSeller && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Use authoritative email from DB; escape all user-supplied HTML fields
    const payload: TicketNotificationPayload = {
      ticket_id: ticket.id,
      action: rawPayload.action,
      buyer_email: ticket.buyer_email,
      game_title: escapeHtml(rawPayload.game_title || ''),
      seller_response: rawPayload.seller_response ? escapeHtml(rawPayload.seller_response) : undefined,
      admin_note: rawPayload.admin_note ? escapeHtml(rawPayload.admin_note) : undefined,
    }

    const { subject, html } = renderTicketEmail(payload)
    const messageId = `ticket-${payload.ticket_id}-${payload.action}-${Date.now()}`

    const supabase = supabaseAdmin

    // Log pending
    await supabase.from('email_send_log').insert({
      recipient_email: payload.buyer_email,
      template_name: 'ticket_notification',
      status: 'pending',
      message_id: messageId,
      metadata: { action: payload.action, game_title: payload.game_title, ticket_id: payload.ticket_id },
    })

    // Check active provider (respects the admin toggle)
    let provider: 'lovable' | 'resend' = 'resend'
    try {
      const { data: settings } = await supabase
        .from('site_settings')
        .select('email_provider')
        .eq('id', 1)
        .single()
      if (settings?.email_provider === 'lovable') provider = 'lovable'
    } catch (e) {
      console.warn('Could not read email_provider, defaulting to resend', e)
    }

    // LOVABLE PATH — enqueue for process-email-queue
    if (provider === 'lovable') {
      const { error: enqueueError } = await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to: payload.buyer_email,
          from: 'Agevers Support <support@updates.agevers.com>',
          sender_domain: 'updates.agevers.com',
          subject,
          html,
          message_id: messageId,
          purpose: 'transactional',
          label: 'ticket_notification',
          idempotency_key: messageId,
          queued_at: new Date().toISOString(),
        },
      })
      if (enqueueError) {
        await supabase.from('email_send_log').insert({
          recipient_email: payload.buyer_email,
          template_name: 'ticket_notification',
          status: 'failed',
          message_id: messageId,
          error_message: 'Failed to enqueue: ' + enqueueError.message,
        })
        return new Response(JSON.stringify({ error: 'Failed to enqueue notification' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ success: true, message_id: messageId, provider: 'lovable', queued: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // RESEND PATH
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      await supabase.from('email_send_log').insert({
        recipient_email: payload.buyer_email,
        template_name: 'ticket_notification',
        status: 'failed',
        message_id: messageId,
        error_message: 'RESEND_API_KEY not configured',
      })
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Agevers Support <support@updates.agevers.com>',
          to: [payload.buyer_email],
          subject,
          html,
        }),
      })
      const resendBody = await resendRes.json().catch(() => ({}))
      if (!resendRes.ok) {
        const errMsg = resendBody?.message || resendBody?.error || `Resend HTTP ${resendRes.status}`
        await supabase.from('email_send_log').insert({
          recipient_email: payload.buyer_email,
          template_name: 'ticket_notification',
          status: 'failed',
          message_id: messageId,
          error_message: errMsg,
        })
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      await supabase.from('email_send_log').insert({
        recipient_email: payload.buyer_email,
        template_name: 'ticket_notification',
        status: 'sent',
        message_id: messageId,
      })
    } catch (sendErr) {
      await supabase.from('email_send_log').insert({
        recipient_email: payload.buyer_email,
        template_name: 'ticket_notification',
        status: 'failed',
        message_id: messageId,
        error_message: (sendErr as Error).message,
      })
      return new Response(JSON.stringify({ error: 'Send failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ success: true, message_id: messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Ticket notification error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
