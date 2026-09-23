import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate caller is admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { appeal_id, action, admin_comment } = await req.json();
    if (!appeal_id || !['approve', 'deny'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: appeal, error: appealErr } = await admin
      .from('account_appeals').select('*').eq('id', appeal_id).maybeSingle();
    if (appealErr || !appeal) {
      return new Response(JSON.stringify({ error: 'Appeal not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (appeal.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Appeal already reviewed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'approve') {
      // Unblock user in fraud_scores
      await admin.from('fraud_scores').update({
        is_blocked: false,
        notes: `Unblocked via appeal ${appeal_id} by admin ${user.id}`,
      }).eq('user_id', appeal.user_id);

      // Whitelist email so future fraud checks pass — use the appellant's ACTUAL
      // auth email, never the user-supplied field on the appeal row (which can be spoofed).
      let verifiedEmail: string | null = null;
      try {
        const { data: appellant } = await admin.auth.admin.getUserById(appeal.user_id);
        verifiedEmail = appellant?.user?.email?.toLowerCase() ?? null;
      } catch (_e) {
        verifiedEmail = null;
      }
      if (verifiedEmail) {
        await admin.from('fraud_lists').upsert({
          list_type: 'whitelist',
          entry_type: 'email',
          value: verifiedEmail,
          reason: `Approved appeal ${appeal_id}`,
          created_by: user.id,
        }, { onConflict: 'list_type,entry_type,value' } as any);
      }
    }

    await admin.from('account_appeals').update({
      status: action === 'approve' ? 'approved' : 'denied',
      admin_comment: admin_comment || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', appeal_id);

    // Notify user via telegram (optional log)
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('manage-appeal error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});