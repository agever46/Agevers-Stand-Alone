import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Restrict to service role / cron invocations only
    const authHeader = req.headers.get('Authorization') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (authHeader !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all admin user IDs to exclude
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'super_admin']);
    const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));

    // Date range = last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dateLabel = new Date().toISOString().split('T')[0];

    // Pull all searches from last 24h (paginated)
    let allLogs: any[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('search_logs')
        .select('query, results_count, user_id, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allLogs = allLogs.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // Filter out admin searches
    const userLogs = allLogs.filter((l: any) => !l.user_id || !adminIds.has(l.user_id));

    // Aggregate
    const queryCounts = new Map<string, { count: number; zeroResults: number }>();
    let totalSearches = 0;
    let zeroResultSearches = 0;
    for (const l of userLogs) {
      totalSearches++;
      const q = (l.query || '').trim().toLowerCase();
      if (!q) continue;
      const isZero = (l.results_count || 0) === 0;
      if (isZero) zeroResultSearches++;
      const cur = queryCounts.get(q) || { count: 0, zeroResults: 0 };
      cur.count++;
      if (isZero) cur.zeroResults++;
      queryCounts.set(q, cur);
    }

    const uniqueQueries = queryCounts.size;
    const sorted = Array.from(queryCounts.entries())
      .map(([query, v]) => ({ query, count: v.count, zeroResults: v.zeroResults }));
    const topQueries = [...sorted].sort((a, b) => b.count - a.count).slice(0, 15);
    const topZeroResultQueries = sorted
      .filter(q => q.zeroResults > 0 && q.zeroResults === q.count)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Skip email if zero searches in last 24h
    if (totalSearches === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no searches in last 24h' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: emailErr } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'admin-search-summary',
        recipientEmail: 'admin@agevers.com',
        idempotencyKey: `admin-search-summary-${dateLabel}`,
        templateData: {
          date: dateLabel,
          totalSearches,
          uniqueQueries,
          zeroResultSearches,
          topQueries,
          topZeroResultQueries,
        },
      },
    });

    if (emailErr) console.error('Email send error', emailErr);

    return new Response(JSON.stringify({ ok: true, totalSearches, uniqueQueries }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('admin-search-summary error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
