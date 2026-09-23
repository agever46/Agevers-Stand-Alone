import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')

  if (!token) return json({ error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return json({ error: 'Unauthorized' }, 401)

  // Users may only delete their own account. All user data cascades via
  // FK ON DELETE CASCADE from auth.users (profiles, orders, wishlist, etc.).
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('[delete-account] deleteUser failed:', deleteError.message)
    return json({ error: 'Failed to delete account' }, 500)
  }

  console.log(`[delete-account] account deleted: ${user.id}`)
  return json({ success: true })
})
