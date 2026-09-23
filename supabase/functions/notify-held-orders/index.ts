import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceOrInternal } from "../_shared/adminAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-token',
};

const VERIFICATION_MESSAGE =
  "Hi! Your order is currently under a routine security review because the email address used on our site doesn't match your PayPal payment email. To protect your account and complete the delivery, could you please confirm that you authorized this payment? A screenshot of your PayPal transaction confirmation would help us release the code immediately. Thank you for your patience!";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Cron/internal-only: require service-role key or internal token.
  const authError = await requireServiceOrInternal(req, corsHeaders);
  if (authError) return authError;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Only orders that are actually held get a notification. No caller-supplied
    // recipient is ever accepted — the address always comes from the order's owner.
    const { data: heldOrders, error } = await supabase
      .from('orders')
      .select('id, user_id, game_title, price, held_reason, created_at')
      .eq('status', 'held')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const sent: string[] = [];
    for (const order of heldOrders || []) {
      if (!order.user_id) continue;
      const { data: u } = await supabase.auth.admin.getUserById(order.user_id);
      const email = u?.user?.email;
      if (!email) continue;

      // Idempotent: skip if this order already got the verification email.
      const { data: already } = await supabase
        .from('email_send_log')
        .select('id')
        .eq('recipient_email', email)
        .eq('template_name', 'order-verification-required')
        .eq('status', 'sent')
        .limit(1)
        .maybeSingle();
      if (already) continue;

      const meta = (u?.user?.user_metadata || {}) as Record<string, unknown>;
      const sendRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'x-internal-key': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        },
        body: JSON.stringify({
          templateName: 'order-verification-required',
          recipientEmail: email,
          idempotencyKey: `verify-required-${order.id}`,
          templateData: {
            customerName: (meta.first_name as string) || (meta.full_name as string) || null,
            productTitle: order.game_title,
            orderId: order.id,
            amount: `€${Number(order.price).toFixed(2)}`,
            verificationMessage: VERIFICATION_MESSAGE,
          },
        }),
      });
      if (!sendRes.ok) {
        console.error(`Send failed for order ${order.id} [${sendRes.status}]:`, await sendRes.text());
        continue;
      }
      sent.push(order.id);
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('notify-held-orders error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
