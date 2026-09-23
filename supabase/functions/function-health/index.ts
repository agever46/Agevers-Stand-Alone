import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireAdminOrService } from '../_shared/adminAuth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const guard = await requireAdminOrService(req, corsHeaders);
  if (guard) return guard;

  let names: string[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body?.functions)) names = body.functions.filter((n: unknown) => typeof n === 'string').slice(0, 60);
  } catch (_) { /* ignore */ }

  if (names.length === 0) {
    return new Response(JSON.stringify({ error: 'functions[] required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const base = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;

  const probe = async (name: string) => {
    const started = Date.now();
    try {
      const res = await fetch(`${base}/${name}`, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, content-type',
          origin: 'https://agevers.com',
        },
      });
      const ms = Date.now() - started;
      if (res.status === 429) return { name, up: null, code: 429, ms, error: 'Rate limited' };
      const up = res.status !== 404 && res.status !== 503;
      return { name, up, code: res.status, ms, error: up ? null : (res.status === 404 ? 'Not deployed' : 'Unavailable') };
    } catch (e) {
      const msg = (e as Error)?.message || 'Network error';
      // Gateway trace rate limits are not a deployment problem.
      if (/rate limit/i.test(msg)) return { name, up: null, code: 429, ms: Date.now() - started, error: 'Rate limited' };
      return { name, up: false, code: 0, ms: Date.now() - started, error: msg };
    }
  };

  const results: unknown[] = [];
  // Sequential small batches: the functions gateway rate-limits bursts.
  for (let i = 0; i < names.length; i += 4) {
    const batch = await Promise.all(names.slice(i, i + 4).map(probe));
    // Retry rate-limited entries once after a pause.
    for (let j = 0; j < batch.length; j++) {
      if ((batch[j] as any).up === null) {
        await new Promise((r) => setTimeout(r, 1500));
        batch[j] = await probe((batch[j] as any).name);
      }
    }
    results.push(...batch);
    if (i + 4 < names.length) await new Promise((r) => setTimeout(r, 400));
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
