// Daily check for the "stuck Pre-order duplicate" pattern: a product whose
// title still says "... Pre-order" sitting next to another product whose
// title is already the clean version — the auto-strip trigger's collision
// guard refuses to clean the first one because the second one already has
// that exact title. Usually happens when Kinguin lists a pre-order SKU and
// the post-release SKU as two separate kinguin_product_ids for the same
// game (see cleanup done 2026-09-01).
//
// Titles containing "bonus" are excluded — those are legitimate distinct
// base+bonus bundle products, not duplicates (confirmed against real
// catalog data during that cleanup).
//
// Only alerts on pairs not already recorded in duplicate_product_alerts,
// so this stays silent on days with nothing new instead of re-notifying
// about the same unresolved pair every day.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Restrict to service-role callers (pg_cron / admin tooling).
    const authToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (authToken !== SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: pairs, error } = await supabase.rpc('find_stuck_preorder_duplicates' as any);
    if (error) throw error;

    const rows = (pairs as any[]) || [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, found: 0, new: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter to pairs we haven't already alerted on.
    const { data: known } = await supabase
      .from('duplicate_product_alerts' as any)
      .select('stuck_id, clean_id');
    const knownSet = new Set((known || []).map((k: any) => `${k.stuck_id}:${k.clean_id}`));
    const freshRows = rows.filter((r: any) => !knownSet.has(`${r.stuck_id}:${r.clean_id}`));

    if (freshRows.length === 0) {
      return new Response(JSON.stringify({ ok: true, found: rows.length, new: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('duplicate_product_alerts' as any).insert(
      freshRows.map((r: any) => ({ stuck_id: r.stuck_id, clean_id: r.clean_id }))
    );

    const lines = freshRows
      .slice(0, 15)
      .map((r: any) => `• "${r.stuck_title}" vs "${r.clean_title}"`)
      .join('\n');
    const message = `${freshRows.length} new stuck Pre-order duplicate${freshRows.length > 1 ? 's' : ''} found:\n\n${lines}${freshRows.length > 15 ? `\n…and ${freshRows.length - 15} more` : ''}`;

    await fetch(`${SUPABASE_URL}/functions/v1/telegram-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        type: 'catalog',
        title: '🧩 Duplicate product listings found',
        message,
      }),
    }).catch((e) => console.error('telegram-notify failed', e));

    return new Response(JSON.stringify({ ok: true, found: rows.length, new: freshRows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('detect-duplicate-preorder-products error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
