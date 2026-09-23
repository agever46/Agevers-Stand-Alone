import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Not authenticated');

    // 1. Get user profile and check phone uniqueness for claims
    let { data: profile } = await supabase
      .from('profiles')
      .select('phone')
      .eq('user_id', user.id)
      .maybeSingle();

    // If profile doesn't exist, create one
    if (!profile) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({ 
          user_id: user.id, 
          username: `gamer_${crypto.randomUUID().slice(0, 8)}`
        })
        .select('phone')
        .single();
      
      if (createError) throw new Error('Failed to access profile');
      profile = newProfile;
    }

    // 2. Check if this user (by ID) or phone has already claimed ANY gift
    // Use user.email from auth since it's not in the profile table.
    // Phone is user-editable free text — only trust it if it is a valid
    // E.164 number, and never embed it in a raw filter string. Fail closed
    // on any query error so the duplicate-claim guard cannot be bypassed.
    const phone = typeof profile.phone === 'string' ? profile.phone.trim() : '';
    const isE164 = /^\+[1-9]\d{6,14}$/.test(phone);

    const claimQueries: any[] = [
      supabase.from('free_gift_claims').select('user_id').eq('user_id', user.id),
    ];
    if (isE164) {
      claimQueries.push(
        supabase.from('free_gift_claims').select('user_id, profiles!inner(phone)')
          .eq('profiles.phone', phone),
      );
    }
    const claimResults = await Promise.all(claimQueries);
    for (const r of claimResults) {
      if (r.error) {
        console.error('Duplicate-claim check failed:', r.error.message);
        throw new Error('Unable to verify gift eligibility right now. Please try again.');
      }
    }
    const existingClaims = claimResults.flatMap((r) => r.data || []);

    if (existingClaims.length > 0) {
      throw new Error('You have already claimed a free gift.');
    }

    const body = await req.json();
    const { product_id } = body;
    if (!product_id) throw new Error('Product ID is required');

    // 3. Verify product eligibility
    const { data: giftRow } = await supabase
      .from('free_gift_products')
      .select('id, allowed_product_id')
      .eq('allowed_product_id', product_id)
      .maybeSingle();

    if (!giftRow) throw new Error('This product is not eligible for the free gift program.');

    // 3b. Check stock limit (5 per product)
    const { count: claimCount, error: countError } = await supabase
      .from('free_gift_claims')
      .select('*', { count: 'exact', head: true })
      .eq('allowed_product_id', product_id);

    if (countError) throw countError;
    if (claimCount !== null && claimCount >= 5) {
      throw new Error('This gift is out of stock.');
    }

    if (!giftRow) throw new Error('This product is not eligible for the free gift program.');

    // 4. Record the claim
    const fakePaypalId = `FREE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // Get product details for fulfillment
    const { data: product } = await supabase
      .from('allowed_products')
      .select('title, platform, region')
      .eq('id', product_id)
      .single();

    if (!product) throw new Error('Product not found');

    const fulfillRes = await fetch(`${SUPABASE_URL}/functions/v1/fulfill-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        paypal_order_id: fakePaypalId,
        items: [{
          offerId: product_id,
          title: product.title,
          platform: product.platform,
          price: 0,
          quantity: 1,
          is_free_gift: true
        }]
      })
    });

    const fulfillData = await fulfillRes.json();
    if (!fulfillRes.ok) throw new Error(fulfillData.error || 'Fulfillment failed');

    const { error: claimError } = await supabase
      .from('free_gift_claims')
      .insert({
        user_id: user.id,
        allowed_product_id: product_id,
        paypal_order_id: fakePaypalId,
        order_id: fulfillData.results[0].order_id
      });

    if (claimError) throw claimError;

    // 5. Notify via Telegram
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/telegram-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          type: 'gift',
          title: 'Free Gift Claimed!',
          message: `A user has just claimed a free game code.`,
          meta: {
            'User': user.email,
            'Product': product.title,
            'Platform': product.platform,
            'Region': product.region,
            'Order ID': fakePaypalId
          }
        })
      });
    } catch (teleError) {
      console.error('Telegram notification failed:', teleError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Gift claimed successfully!',
      order_id: fulfillData.results[0].order_id,
      paypal_order_id: fakePaypalId,
      is_held: !!fulfillData.results[0].is_held,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});