import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function buildHtml(opts: {
  title: string
  currentEntries: number
  leaderEntries: number
  improvementPct: number
  endsAt: string
}) {
  const { title, currentEntries, leaderEntries, improvementPct, endsAt } = opts
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;color:#0f172a;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:24px;border-radius:12px;color:#fff;text-align:center;">
      <h1 style="margin:0;font-size:24px;">🎁 ${title}</h1>
      <p style="margin:8px 0 0;opacity:.9;">Giveaway closes ${endsAt}</p>
    </div>
    <div style="padding:24px 8px;">
      <p style="font-size:16px;line-height:1.6;">Hey gamer 👋</p>
      <p style="font-size:16px;line-height:1.6;">
        You currently have <strong>${currentEntries}</strong> ${currentEntries === 1 ? 'entry' : 'entries'} in the giveaway.
        The current leader has <strong>${leaderEntries}</strong> entries.
      </p>
      <div style="background:#f1f5f9;border-left:4px solid #7c3aed;padding:16px;border-radius:8px;margin:16px 0;">
        <p style="margin:0;font-size:16px;line-height:1.6;">
          🚀 Add just <strong>5 more entries</strong> and boost your winning odds by approximately
          <strong style="color:#7c3aed;font-size:20px;">+${improvementPct}%</strong>!
        </p>
      </div>
      <h2 style="font-size:18px;margin-top:24px;">How to earn more entries</h2>
      <ul style="font-size:15px;line-height:1.8;padding-left:20px;">
        <li>🛒 <strong>Every purchase</strong> on Agever's earns you an entry — even the cheapest game in the store counts as 1 entry!</li>
        <li>📱 Engage with the site: browse, wishlist, share — every action helps.</li>
        <li>🎯 The lowest-priced game in our catalog is the fastest way to grab a guaranteed extra entry.</li>
      </ul>
      <div style="text-align:center;margin:32px 0;">
        <a href="https://agevers.com/giveaways" style="background:#7c3aed;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:bold;display:inline-block;">View Giveaway</a>
      </div>
      <p style="font-size:13px;color:#64748b;text-align:center;margin-top:24px;">
        Good luck! — Agever's Team
      </p>
    </div>
  </div>
</body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Restrict to service-role callers. Prevents public triggering of bulk
    // marketing emails that would exhaust the Resend quota.
    const authToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (authToken !== SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Fetch active giveaway
    const { data: giveaways } = await supabase
      .from('giveaways')
      .select('id, title, ends_at')
      .eq('status', 'active')
      .order('ends_at', { ascending: true })
      .limit(1)

    const giveaway = giveaways?.[0]
    if (!giveaway) {
      return new Response(JSON.stringify({ error: 'No active giveaway' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch all entries
    const { data: entries } = await supabase
      .from('giveaway_entries')
      .select('user_email, entry_count')
      .eq('giveaway_id', giveaway.id)
      .order('entry_count', { ascending: false })

    if (!entries?.length) {
      return new Response(JSON.stringify({ error: 'No entries' }), { status: 404, headers: corsHeaders })
    }

    const leaderEntries = entries[0].entry_count
    const totalEntries = entries.reduce((s, e) => s + e.entry_count, 0)
    const endsAt = new Date(giveaway.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    const results: any[] = []

    for (const entry of entries) {
      // Improvement %: how much winning probability rises after +5 entries
      const before = entry.entry_count / totalEntries
      const after = (entry.entry_count + 5) / (totalEntries + 5)
      const improvementPct = before > 0
        ? Math.round(((after - before) / before) * 100)
        : Math.round((after) * 100 * 10) // for very low-entry users
      const capped = Math.min(Math.max(improvementPct, 30), 200)

      const html = buildHtml({
        title: giveaway.title,
        currentEntries: entry.entry_count,
        leaderEntries,
        improvementPct: capped,
        endsAt,
      })

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: "Agever's Giveaways <giveaways@updates.agevers.com>",
          to: [entry.user_email],
          subject: `🎁 Boost your winning odds by +5 entries — ${giveaway.title}`,
          html,
        }),
      })

      const json = await res.json().catch(() => ({}))
      results.push({ email: entry.user_email, status: res.status, id: json?.id, error: json?.message })
      // Throttle: Resend free tier = 5 req/sec
      await new Promise(r => setTimeout(r, 250))
    }

    return new Response(JSON.stringify({ sent: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})