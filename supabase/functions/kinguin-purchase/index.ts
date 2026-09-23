import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KINGUIN_API = 'https://gateway.kinguin.net/esa/api';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KINGUIN_API_KEY = Deno.env.get('KINGUIN_API_KEY');
    if (!KINGUIN_API_KEY) throw new Error('KINGUIN_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Not authenticated');

    // Admin role check — this endpoint buys keys with company funds.
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { kinguin_product_id, allowed_product_id } = body;

    if (!kinguin_product_id || !allowed_product_id) {
      throw new Error('Missing kinguin_product_id or allowed_product_id');
    }

    // Get kinguin product mapping
    const { data: kinguinProduct } = await supabase
      .from('kinguin_products')
      .select('*')
      .eq('allowed_product_id', allowed_product_id)
      .eq('is_active', true)
      .single();

    if (!kinguinProduct) throw new Error('Kinguin product not found or inactive');

    // Get allowed product info
    const { data: allowedProduct } = await supabase
      .from('allowed_products')
      .select('*')
      .eq('id', allowed_product_id)
      .single();

    if (!allowedProduct) throw new Error('Product not found');

    // Get current price and stock from Kinguin
    const priceRes = await fetch(`${KINGUIN_API}/v2/products/${kinguin_product_id}`, {
      headers: { 'X-Api-Key': KINGUIN_API_KEY },
    });

    if (!priceRes.ok) {
      const errText = await priceRes.text();
      throw new Error(`Failed to get Kinguin product price [${priceRes.status}]: ${errText}`);
    }

    const kinguinProductData = await priceRes.json();
    const kinguinPrice = kinguinProductData.price;
    const kinguinStock = kinguinProductData.qty ?? kinguinProductData.totalQty ?? 0;

    if (!kinguinPrice) throw new Error('Could not determine Kinguin price');

    // Check stock availability before purchasing
    if (kinguinStock <= 0) {
      // Update local stock info and deactivate
      await supabase
        .from('kinguin_products')
        .update({
          kinguin_stock: 0,
          is_active: false,
          last_stock_check: new Date().toISOString(),
          last_change_summary: 'stock 0 (purchase: live check found none available)',
          last_change_at: new Date().toISOString(),
          last_change_source: 'purchase',
        })
        .eq('allowed_product_id', allowed_product_id);

      throw new Error('This product is currently out of stock on Kinguin');
    }

    // Update local stock info
    await supabase
      .from('kinguin_products')
      .update({ kinguin_stock: kinguinStock, kinguin_price: kinguinPrice, last_stock_check: new Date().toISOString() })
      .eq('allowed_product_id', allowed_product_id);

    // Place order on Kinguin
    const orderRes = await fetch(`${KINGUIN_API}/v2/order`, {
      method: 'POST',
      headers: {
        'X-Api-Key': KINGUIN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        products: [{
          productId: kinguin_product_id,
          qty: 1,
          price: kinguinPrice,
          keyType: 'text',
        }],
      }),
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      throw new Error(`Kinguin order failed [${orderRes.status}]: ${errText}`);
    }

    const orderData = await orderRes.json();
    const kinguinOrderId = orderData.orderId;

    // Create local order
    const { data: localOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        game_title: allowedProduct.title,
        platform: allowedProduct.platform,
        price: kinguinProduct.sell_price,
        status: 'processing',
      })
      .select()
      .single();

    if (orderError) throw new Error('Failed to create local order: ' + orderError.message);

    // Log kinguin order
    await supabase.from('kinguin_orders').insert({
      order_id: localOrder.id,
      kinguin_order_id: kinguinOrderId,
      kinguin_product_id: kinguin_product_id,
      kinguin_price: kinguinPrice,
      status: 'processing',
    });

    // Poll for keys (try up to 10 times with 3s delay)
    let gameKey: string | null = null;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const keysRes = await fetch(`${KINGUIN_API}/v2/order/${kinguinOrderId}/keys`, {
        headers: { 'X-Api-Key': KINGUIN_API_KEY },
      });

      if (keysRes.ok) {
        const keys = await keysRes.json();
        if (keys.length > 0 && keys[0].serial) {
          gameKey = keys[0].serial;
          break;
        }
      }
    }

    if (gameKey) {
      // Update order with key
      await supabase
        .from('orders')
        .update({ game_code: gameKey, status: 'completed' })
        .eq('id', localOrder.id);

      await supabase
        .from('kinguin_orders')
        .update({ game_key: gameKey, status: 'completed' })
        .eq('order_id', localOrder.id);
    }

    return new Response(JSON.stringify({
      success: true,
      orderId: localOrder.id,
      gameKey: gameKey,
      status: gameKey ? 'completed' : 'processing',
      message: gameKey 
        ? 'Purchase successful! Your game key is ready.'
        : 'Order placed. Key will be delivered shortly - check your account.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Kinguin purchase error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
