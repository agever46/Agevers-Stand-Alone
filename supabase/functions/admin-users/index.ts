import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Realistic gaming-themed seller display names
const SELLER_NAMES = [
  "KeyMaster_Pro", "GameVault_EU", "DigitalDealz", "CodeNinja99", "SteamKeys_HQ",
  "PlayDrop_Store", "GameForge_Shop", "KeyWizard", "PixelTrade_EU", "CyberKeys",
  "TurboGamer_Shop", "NexusKeys", "VortexDigital", "GamePulse_HQ", "ByteStore",
  "EpicKey_Deals", "NovaGaming_EU", "KeyStrike", "GameFlux", "ShadowKeys_Pro",
  "AlphaDigital", "RocketKeys_EU", "PrimeCodez", "GameSphere_HQ", "ThunderKeys",
  "ApexStore_EU", "KeyVortex_Pro", "GameRush_HQ", "ZenithKeys", "BlazeDigital",
  "OmegaKeys_EU", "GameNexus_Pro", "SwiftCodes", "TitanKeys_HQ", "FusionStore",
  "PhoenixKeys", "GameWave_EU", "InfinityCodez", "StellarKeys_Pro", "PulseDigital",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("apikey");

    // SECURITY: Require an Authorization header on every call. Without this guard,
    // unauthenticated callers would fall through to the default callerRole = "admin".
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!authHeader.includes(serviceRoleKey)) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || apiKey || serviceRoleKey;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      let callerId: string | null = null;
      
      // Try getClaims first, fall back to getUser if TLS/network error
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        // Fallback: use getUser via adminClient
        const { data: userData, error: userError } = await adminClient.auth.getUser(token);
        if (userError || !userData?.user) {
          console.error("Auth failed - getClaims error:", claimsError?.message, "getUser error:", userError?.message);
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        callerId = userData.user.id;
      } else {
        callerId = claimsData.claims.sub as string;
      }

      const { data: roleRows } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
        .in("role", ["admin", "super_admin"]);

      if (!roleRows || roleRows.length === 0) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Pick highest role: super_admin > admin
      const callerBestRole = roleRows.some((r) => r.role === "super_admin") ? "super_admin" : "admin";
      // Store caller info for permission checks
      (req as any).__callerRole = callerBestRole;
      (req as any).__callerId = callerId;
    }

    const { action, ...params } = await req.json();
    // Default to service_role only when the caller authenticated with the service role key.
    const callerRole = (req as any).__callerRole || "service_role";
    const callerId = (req as any).__callerId || null;

    let result;

    switch (action) {
      case "list_users": {
        const requestedPage = Number(params.page || 0);
        const fetchAll = !requestedPage;
        const perPage = Math.min(Number(params.perPage || 50), 50);
        const users: any[] = [];
        let page = requestedPage || 1;
        let total = 0;

        do {
          const { data, error } = await adminClient.auth.admin.listUsers({
            page,
            perPage,
          });
          if (error) throw error;

          users.push(...data.users);
          total = Number((data as any).total || total || 0);

          if (!fetchAll) break;
          if (total > 0 && users.length >= total) break;
          if (data.users.length < perPage) break;
          page += 1;
        } while (page <= 200);

        const userIds = users.map((u) => u.id);
        const { data: roles } = await adminClient
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);

        const { data: profiles } = await adminClient
          .from("profiles")
          .select("user_id, email_verified")
          .in("user_id", userIds);

        const { data: fraudScores } = await adminClient
          .from("fraud_scores")
          .select("user_id, is_blocked, new_account_limit_exempt, new_account_limit_cap")
          .in("user_id", userIds);

        const profileByUser = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
        const fraudByUser = new Map((fraudScores || []).map((score) => [score.user_id, score]));

        // last_sign_in_at from Supabase auth only updates on full re-auth (not on
        // token refresh), so a long-lived session looks "stuck". Fold in the most
        // recent page_view per user so the dashboard shows real last activity.
        const { data: lastViews } = await adminClient
          .from("page_views")
          .select("user_id, created_at")
          .in("user_id", userIds)
          .order("created_at", { ascending: false })
          .limit(5000);
        const lastActiveMap = new Map<string, string>();
        for (const row of lastViews || []) {
          if (!row.user_id) continue;
          if (!lastActiveMap.has(row.user_id)) {
            lastActiveMap.set(row.user_id, row.created_at as string);
          }
        }

        const usersWithRoles = users.map((u) => {
          const profile = profileByUser.get(u.id);
          const fraudScore = fraudByUser.get(u.id);
          const isEmailVerified = Boolean(u.email_confirmed_at || profile?.email_verified);

          return ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          email_confirmed_at: u.email_confirmed_at,
          email_verified: isEmailVerified,
          is_blocked: Boolean(fraudScore?.is_blocked),
          new_account_limit_exempt: Boolean(fraudScore?.new_account_limit_exempt),
          new_account_limit_cap: fraudScore?.new_account_limit_cap ?? 20,
          last_sign_in_at: (() => {
            const signIn = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
            const view = lastActiveMap.get(u.id) ? new Date(lastActiveMap.get(u.id)!).getTime() : 0;
            const max = Math.max(signIn, view);
            return max > 0 ? new Date(max).toISOString() : null;
          })(),
          roles: (roles || [])
            .filter((r) => r.user_id === u.id)
            .map((r) => r.role),
          });
        });

        result = { users: usersWithRoles, total: total ?? usersWithRoles.length };
        break;
      }

      case "create_user": {
        const { data, error } = await adminClient.auth.admin.createUser({
          email: params.email,
          password: params.password,
          email_confirm: true,
          user_metadata: {
            username: params.username || undefined,
          },
        });
        if (error) throw error;

        // Update profile with username and avatar if provided
        const userId = data.user.id;
        const profileUpdate: Record<string, string> = {};
        if (params.username) {
          profileUpdate.username = params.username;
          profileUpdate.display_name = params.username;
        }
        if (params.avatarUrl) {
          profileUpdate.avatar_url = params.avatarUrl;
        }
        if (Object.keys(profileUpdate).length > 0) {
          await adminClient.from("profiles").update(profileUpdate).eq("user_id", userId);
        }

        result = { user: data.user };
        break;
      }

      case "delete_user": {
        // Check if target is super_admin — only super_admin can delete super_admin
        const { data: targetRoles } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", params.userId);
        const targetIsSuperAdmin = (targetRoles || []).some((r: any) => r.role === "super_admin");
        if (targetIsSuperAdmin && callerRole !== "super_admin") {
          throw new Error("Only super admins can delete super admin users");
        }
        const { error } = await adminClient.auth.admin.deleteUser(
          params.userId
        );
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "verify_email": {
        const { error } = await adminClient.auth.admin.updateUserById(
          params.userId,
          { email_confirm: true }
        );
        if (error) throw error;
        await adminClient
          .from("profiles")
          .update({ email_verified: true, updated_at: new Date().toISOString() })
          .eq("user_id", params.userId);
        result = { success: true };
        break;
      }

      case "update_email": {
        const newEmail = (params.email || "").trim().toLowerCase();
        if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
          throw new Error("Invalid email address");
        }
        // Protect super_admin
        const { data: targetRolesEmail } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", params.userId);
        const targetIsSuperAdminEmail = (targetRolesEmail || []).some((r: any) => r.role === "super_admin");
        if (targetIsSuperAdminEmail && callerRole !== "super_admin") {
          throw new Error("Only super admins can change super admin emails");
        }
        // Skip if unchanged
        const { data: currentUser } = await adminClient.auth.admin.getUserById(params.userId);
        if (currentUser?.user?.email?.toLowerCase() === newEmail) {
          result = { success: true, email: newEmail, unchanged: true };
          break;
        }
        const { error } = await adminClient.auth.admin.updateUserById(
          params.userId,
          { email: newEmail, email_confirm: true }
        );
        if (error) {
          console.error("update_email error:", error);
          throw new Error(`Failed to update email: ${error.message || error.code || "unknown error"}`);
        }
        // Keep profile email_verified in sync
        await adminClient
          .from("profiles")
          .update({ email_verified: true, updated_at: new Date().toISOString() })
          .eq("user_id", params.userId);
        result = { success: true, email: newEmail };
        break;
      }

      case "reset_password": {
        // Check if target is super_admin — only super_admin can reset super_admin password
        const { data: targetRolesReset } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", params.userId);
        const targetIsSuperAdminReset = (targetRolesReset || []).some((r: any) => r.role === "super_admin");
        if (targetIsSuperAdminReset && callerRole !== "super_admin") {
          throw new Error("Only super admins can reset super admin passwords");
        }
        const { error } = await adminClient.auth.admin.updateUserById(
          params.userId,
          { password: params.newPassword }
        );
        if (error) {
          if (error.message?.toLowerCase().includes("weak") || error.message?.toLowerCase().includes("pwned")) {
            throw new Error("This password was found in a known data breach. Please choose a stronger, unique password (mix of letters, numbers, symbols, 12+ chars).");
          }
          throw error;
        }
        result = { success: true };
        break;
      }

      case "set_role": {
        // Only super_admin can assign/remove super_admin role
        if (params.role === "super_admin" && callerRole !== "super_admin") {
          throw new Error("Only super admins can manage the super_admin role");
        }
        // Admin can't modify roles of super_admin users
        const { data: targetRolesSet } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", params.userId);
        const targetIsSuperAdminSet = (targetRolesSet || []).some((r: any) => r.role === "super_admin");
        if (targetIsSuperAdminSet && callerRole !== "super_admin") {
          throw new Error("Only super admins can modify super admin users");
        }
        if (params.remove) {
          const { error } = await adminClient
            .from("user_roles")
            .delete()
            .eq("user_id", params.userId)
            .eq("role", params.role);
          if (error) throw error;
        } else {
          const { error } = await adminClient
            .from("user_roles")
            .upsert(
              { user_id: params.userId, role: params.role },
              { onConflict: "user_id,role" }
            );
          if (error) throw error;
        }
        result = { success: true };
        break;
      }

      case "get_user_details": {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("*")
          .eq("user_id", params.userId)
          .maybeSingle();

        const { data: orders } = await adminClient
          .from("orders")
          .select("*")
          .eq("user_id", params.userId)
          .order("created_at", { ascending: false });

        const { data: wishlistItems } = await adminClient
          .from("wishlist")
          .select("*")
          .eq("user_id", params.userId)
          .order("created_at", { ascending: false });

        const { data: roles } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", params.userId);

        result = {
          profile,
          orders: orders || [],
          wishlist: wishlistItems || [],
          roles: (roles || []).map((r) => r.role),
        };
        break;
      }

      case "bulk_create_sellers": {
        const count = Math.min(params.count || 20, 40);
        const domain = params.domain || "sellers.gamevault.store";
        const generateStrongPassword = () => {
          const bytes = new Uint8Array(24);
          crypto.getRandomValues(bytes);
          const base = btoa(String.fromCharCode(...bytes))
            .replace(/[^A-Za-z0-9]/g, "");
          // Mix symbols + digits + mixed case to satisfy any policy and avoid HIBP matches
          return `Zx9!${base}@Q7#${Date.now().toString(36)}`;
        };
        const priceMarkup = params.priceMarkup || 0.10;
        const priceVariation = params.priceVariation || 0.05;
        const minStock = params.minStock || 20;

        // 1. Get active kinguin products with stock >= minStock
        const { data: kinguinProducts, error: kpError } = await adminClient
          .from("kinguin_products")
          .select("*, allowed_products(*)")
          .eq("is_active", true)
          .gte("kinguin_stock", minStock);
        
        if (kpError) throw kpError;
        if (!kinguinProducts || kinguinProducts.length === 0) {
          throw new Error(`No active Kinguin products with stock >= ${minStock} found.`);
        }

        // Shuffle seller names
        const shuffled = [...SELLER_NAMES].sort(() => Math.random() - 0.5);
        const names = shuffled.slice(0, count);

        const createdSellers: { email: string; display_name: string; products: number }[] = [];
        const errors: string[] = [];

        // Pre-calculate stock distribution per product
        // For each product, distribute stock randomly among all sellers
        const stockDistributions: Record<string, number[]> = {};
        for (const kp of kinguinProducts) {
          const totalStock = kp.kinguin_stock || 0;
          // Reserve some stock for Official Store, distribute rest among sellers
          const distributableStock = Math.floor(totalStock * 0.6); // 60% goes to fake sellers
          const portions = distributeStock(distributableStock, names.length);
          stockDistributions[kp.id] = portions;
        }

        // Pre-generate random sales counts for each seller (50-2000)
        const salesCounts: number[] = names.map(() => Math.floor(Math.random() * 1950) + 50);

        for (let i = 0; i < names.length; i++) {
          const displayName = names[i];
          const email = `${displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}@${domain}`;

          try {
            // Create auth user
            const { data: userData, error: createErr } = await adminClient.auth.admin.createUser({
              email,
              password: generateStrongPassword(),
              email_confirm: true,
            });
            if (createErr) {
              if (createErr.message?.includes("already been registered")) {
                errors.push(`${email} already exists, skipping`);
                continue;
              }
              throw createErr;
            }

            const userId = userData.user.id;

            // Set seller role
            await adminClient.from("user_roles").upsert(
              { user_id: userId, role: "seller" },
              { onConflict: "user_id,role" }
            );

            // Update profile with display name + fake sales counter
            // IMPORTANT: We store the simulated sales number on the profile
            // instead of inserting rows into `orders`. This avoids the DB
            // order trigger (Telegram/dashboard alerts) and keeps real order
            // history clean. Display code adds this boost to the shown count.
            await adminClient.from("profiles").update({
              display_name: displayName,
              username: displayName.toLowerCase().replace(/[^a-z0-9_]/g, ''),
              fake_sales_boost: salesCounts[i],
            }).eq("user_id", userId);

            // Create products with stock (game_code lines)
            const productRows = kinguinProducts.map((kp: any, kpIdx: number) => {
              const ap = kp.allowed_products;
              const basePrice = Number(kp.sell_price);
              const markup = basePrice * priceMarkup;
              const variation = (Math.random() * 2 - 1) * basePrice * priceVariation;
              const finalPrice = Math.round((basePrice + markup + variation) * 100) / 100;

              // Get this seller's stock portion
              const stockCount = stockDistributions[kp.id]?.[i] || 0;
              // Generate placeholder game codes for stock display
              const gameCodes = stockCount > 0
                ? Array.from({ length: stockCount }, (_, j) => `RSVD-${kp.id.slice(0, 4)}-${userId.slice(0, 4)}-${j + 1}`).join("\n")
                : null;

              return {
                seller_id: userId,
                title: ap.title,
                platform: ap.platform,
                store: ap.store,
                price: Math.max(finalPrice, basePrice + 0.01),
                image_url: ap.image_url,
                category: getCategory(ap.platform, ap.store),
                status: "active",
                game_code: gameCodes,
              };
            }).filter((p: any) => {
              // Only create product if seller got stock
              const kpIdx = kinguinProducts.findIndex((kp: any) => kp.allowed_products.title === p.title);
              return (stockDistributions[kinguinProducts[kpIdx]?.id]?.[i] || 0) > 0;
            });

            if (productRows.length > 0) {
              const { error: insertErr } = await adminClient.from("products").insert(productRows);
              if (insertErr) errors.push(`Products for ${displayName}: ${insertErr.message}`);
            }

            createdSellers.push({
              email,
              display_name: displayName,
              products: productRows.length,
            });
          } catch (err: any) {
            errors.push(`${displayName}: ${err.message}`);
          }
        }

        result = {
          created: createdSellers.length,
          total_requested: count,
          sellers: createdSellers,
          errors: errors.length > 0 ? errors : undefined,
        };
        break;
      }

      case "cleanup_fake_sellers": {
        const domain = params.domain || "sellers.gamevault.store";
        
        const { data: allUsers, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        if (listErr) throw listErr;
        
        const fakeUsers = allUsers.users.filter(u => u.email?.endsWith(`@${domain}`));
        
        if (fakeUsers.length === 0) {
          result = { deleted: 0, message: "No fake sellers found" };
          break;
        }

        let deleted = 0;
        const cleanupErrors: string[] = [];

        for (const user of fakeUsers) {
          try {
            await adminClient.from("products").delete().eq("seller_id", user.id);
            await adminClient.from("orders").delete().eq("user_id", user.id);
            await adminClient.from("user_roles").delete().eq("user_id", user.id);
            await adminClient.from("profiles").delete().eq("user_id", user.id);
            await adminClient.auth.admin.deleteUser(user.id);
            deleted++;
          } catch (err: any) {
            cleanupErrors.push(`${user.email}: ${err.message}`);
          }
        }

        result = { deleted, total_found: fakeUsers.length, errors: cleanupErrors.length > 0 ? cleanupErrors : undefined };
        break;
      }

      case "list_orders": {
        const limit = Math.min(Number(params.limit) || 100, 500);
        const status = params.status || null;

        let ordersQuery = adminClient
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (status) {
          ordersQuery = ordersQuery.eq("status", status);
        }

        const { data: orders, error: ordersError } = await ordersQuery;
        if (ordersError) throw ordersError;

        const userIds = [...new Set((orders || []).map((order: any) => order.user_id))];
        const orderIds = (orders || []).map((order: any) => order.id);
        const gameTitles = [...new Set((orders || []).map((order: any) => order.game_title))];
        const paypalOrderIds = [...new Set((orders || []).map((order: any) => order.paypal_order_id).filter(Boolean))];

        const [{ data: profiles }, { data: kinguinOrders }, { data: refunds }, { data: manualKeys }, { data: aeProducts }, { data: pendingPayments }] = await Promise.all([
          userIds.length > 0
            ? adminClient.from("profiles").select("user_id, display_name, username").in("user_id", userIds)
            : Promise.resolve({ data: [] as any[] }),
          orderIds.length > 0
            ? adminClient.from("kinguin_orders").select("*").in("order_id", orderIds)
            : Promise.resolve({ data: [] as any[] }),
          orderIds.length > 0
            ? adminClient.from("order_refunds").select("*").in("order_id", orderIds).order("created_at", { ascending: false })
            : Promise.resolve({ data: [] as any[] }),
          orderIds.length > 0
            ? adminClient.from("product_keys").select("order_id").in("order_id", orderIds)
            : Promise.resolve({ data: [] as any[] }),
          gameTitles.length > 0
            ? adminClient.from("allowed_products").select("title, aliexpress_product_id").not("aliexpress_product_id", "is", null).in("title", gameTitles)
            : Promise.resolve({ data: [] as any[] }),
          paypalOrderIds.length > 0
            ? adminClient.from("pending_paypal_orders").select("paypal_order_id, redeem_coins, total_charge, charge_currency, payment_source_type, payment_source_detail").in("paypal_order_id", paypalOrderIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        const aeProductMap = new Map((aeProducts || []).map((p: any) => [p.title, p.aliexpress_product_id]));
        // NOWPayments (crypto) checkouts reuse the paypal_order_id column with
        // an "np_" prefix (see nowpayments-create-invoice) — everything else
        // is a real PayPal order id.
        const paymentMap = new Map((pendingPayments || []).map((p: any) => [p.paypal_order_id, p]));

        const profileMap = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));

        // Real login emails live in auth.users — profiles.username is a display
        // handle, not an address, so using it produced invalid recipients.
        const emailMap = new Map<string, string>();
        await Promise.all(
          userIds.map(async (uid: string) => {
            try {
              const { data: u } = await adminClient.auth.admin.getUserById(uid);
              if (u?.user?.email) emailMap.set(uid, u.user.email);
            } catch (_) { /* ignore individual lookup failures */ }
          })
        );
        const kinguinMap = new Map<string, any[]>();
        (kinguinOrders || []).forEach((entry: any) => {
          const existing = kinguinMap.get(entry.order_id) || [];
          existing.push(entry);
          kinguinMap.set(entry.order_id, existing);
        });
        const refundsMap = new Map<string, any[]>();
        (refunds || []).forEach((entry: any) => {
          const existing = refundsMap.get(entry.order_id) || [];
          existing.push(entry);
          refundsMap.set(entry.order_id, existing);
        });
        const manualKeyOrderIds = new Set((manualKeys || []).map((k: any) => k.order_id));

        result = {
          orders: (orders || []).map((order: any) => {
            const profile = profileMap.get(order.user_id);
            const orderKinguin = kinguinMap.get(order.id) || [];
            const orderRefunds = refundsMap.get(order.id) || [];
            const refundedTotal = orderRefunds.reduce((sum: number, refund: any) => sum + Number(refund.amount || 0), 0);

            // Net profit: only computable when we know the purchase cost.
            // kinguin_orders.kinguin_price is the raw Kinguin total; Kinguin
            // charges a 7.35% marketplace fee on top (see kinguinMarkup.ts).
            const hasCost = orderKinguin.length > 0 && orderKinguin.some((k: any) => k.kinguin_price != null);
            const rawCost = orderKinguin.reduce((sum: number, k: any) => sum + Number(k.kinguin_price || 0), 0);
            const buyCost = hasCost ? rawCost * 1.0735 : null;
            const netRevenue = Math.max(Number(order.price) - refundedTotal, 0);
            const netProfit = buyCost != null ? netRevenue - buyCost : null;

            // Source detection
            const hasKinguinRecord = orderKinguin.length > 0;
            const hasManualKey = manualKeyOrderIds.has(order.id);
            const isAliExpress = !!order.aliexpress_order_id || order.status === 'processing' && !order.game_code && order.shipping_address_line1;
            let source: string;
            if (hasKinguinRecord) source = "kinguin";
            else if (hasManualKey) source = "manual";
            else if (isAliExpress) source = "aliexpress";
            else if (order.game_code) source = "kinguin";
            else source = "unknown";

            const payment = order.paypal_order_id ? paymentMap.get(order.paypal_order_id) : null;
            const coinsUsed = Number(payment?.redeem_coins || 0);

            return {
              ...order,
              buyer_name: profile?.display_name || profile?.username || null,
              buyer_email: emailMap.get(order.user_id) || order.guest_email || null,
              source,
              kinguin_order_id: orderKinguin[0]?.kinguin_order_id || null,
              refunds: orderRefunds,
              refunded_total: refundedTotal,
              remaining_refundable: Math.max(Number(order.price) - refundedTotal, 0),
              aliexpress_product_id: aeProductMap.get(order.game_title) || null,
              buy_cost: buyCost,
              net_profit: netProfit,
              payment_method: order.paypal_order_id?.startsWith("np_") ? "crypto" : (order.paypal_order_id ? "paypal" : "unknown"),
              coins_used: coinsUsed,
              coin_discount_eur: Math.floor(coinsUsed / 100) * 2,
              total_paid: payment?.total_charge ?? null,
              paid_currency: payment?.charge_currency ?? null,
              payment_source_type: payment?.payment_source_type ?? null,
              payment_source_detail: payment?.payment_source_detail ?? null,
            };
          }),
        };
        break;
      }

      case "refund_order": {
        const orderId = params.orderId;
        if (!orderId) throw new Error("Missing orderId");

        const { data: order, error: orderError } = await adminClient
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .maybeSingle();
        if (orderError || !order) throw new Error("Order not found");
        if (!order.paypal_order_id) throw new Error("Order has no PayPal payment id");

        const { data: existingRefunds } = await adminClient
          .from("order_refunds")
          .select("amount")
          .eq("order_id", orderId);
        const refundedTotal = (existingRefunds || []).reduce((sum: number, refund: any) => sum + Number(refund.amount || 0), 0);
        const remainingRefundable = Math.max(Number(order.price) - refundedTotal, 0);
        if (remainingRefundable <= 0) throw new Error("Order already fully refunded");

        const refundType = params.refundType === "partial" ? "partial" : "full";
        const refundAmount = refundType === "partial"
          ? Number(params.amount)
          : remainingRefundable;

        if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
          throw new Error("Invalid refund amount");
        }
        if (refundAmount > remainingRefundable) {
          throw new Error("Refund amount exceeds remaining refundable amount");
        }

        const paypalAuth = await getPaypalAccessToken();
        const orderDetailsRes = await fetch(`${paypalAuth.baseUrl}/v2/checkout/orders/${order.paypal_order_id}`, {
          headers: {
            Authorization: `Bearer ${paypalAuth.accessToken}`,
            "Content-Type": "application/json",
          },
        });
        const orderDetails = await orderDetailsRes.json();
        const captureId = orderDetails?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
        if (!captureId) throw new Error("Could not find PayPal capture for this order");

        const refundPayload = refundType === "partial"
          ? { amount: { value: refundAmount.toFixed(2), currency_code: "EUR" } }
          : {};

        const refundRes = await fetch(`${paypalAuth.baseUrl}/v2/payments/captures/${captureId}/refund`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paypalAuth.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(refundPayload),
        });
        const refundData = await refundRes.json();
        if (!refundRes.ok) {
          throw new Error(refundData?.message || refundData?.details?.[0]?.description || "PayPal refund failed");
        }

        const newStatus = refundAmount >= remainingRefundable ? "refunded" : "partially_refunded";
        await adminClient.from("orders").update({ status: newStatus }).eq("id", orderId);
        await adminClient.from("order_refunds").insert({
          order_id: orderId,
          paypal_order_id: order.paypal_order_id,
          paypal_capture_id: captureId,
          paypal_refund_id: refundData?.id || null,
          refund_type: refundType,
          amount: refundAmount,
          currency: "EUR",
          status: refundData?.status || "completed",
          reason: params.reason || null,
          admin_note: params.adminNote || null,
          refunded_by: callerId,
        });

        result = {
          success: true,
          refund_id: refundData?.id || null,
          status: newStatus,
          amount: refundAmount,
        };
        break;
      }

      case "delete_order": {
        const orderId = params.orderId;
        if (!orderId) throw new Error("Missing orderId");

        // Remove dependent rows first (no FK cascades defined on these tables)
        const childTables = [
          "order_refunds",
          "order_invoices",
          "delivery_proof_logs",
          "kinguin_orders",
          "seller_sales",
          "giveaway_bonus_awarded_orders",
          "reviews",
        ];
        for (const table of childTables) {
          await adminClient.from(table).delete().eq("order_id", orderId);
        }
        // Detach references we must not delete
        await adminClient.from("product_keys").update({ order_id: null }).eq("order_id", orderId);
        await adminClient.from("support_tickets").update({ order_id: null }).eq("order_id", orderId);
        // referral_completions has a NO ACTION FK on trigger_order_id — detach it
        // so deleting the order doesn't fail with a foreign-key violation.
        await adminClient
          .from("referral_completions")
          .update({ trigger_order_id: null })
          .eq("trigger_order_id", orderId);

        const { error: delError } = await adminClient.from("orders").delete().eq("id", orderId);
        if (delError) throw delError;

        result = { success: true };
        break;
      }

      case "approve_held_order": {
        const orderId = params.orderId;
        if (!orderId) throw new Error("Missing orderId");

        const callerId = (req as any).__callerId;

        const { data: order, error: orderError } = await adminClient
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();
        if (orderError || !order) throw new Error("Order not found");
        if (!order.is_held) throw new Error("Order is not on hold");

        // Release the order. If a deferred Kinguin purchase is queued (or no
        // code has been delivered yet), move it to 'awaiting_reveal' so the
        // buyer's reveal action triggers the actual key purchase & delivery
        // via `reveal-and-fulfill`. Otherwise mark it completed directly.
        const needsRevealPurchase = !!order.pending_kinguin || (!order.game_code && !order.code_delivered);
        const newStatus = needsRevealPurchase ? "awaiting_reveal" : "completed";
        const { error: updateError } = await adminClient
          .from("orders")
          .update({
            status: newStatus,
            is_held: false,
            approved_by: callerId,
            approved_at: new Date().toISOString(),
          })
          .eq("id", orderId);
        if (updateError) throw new Error("Failed to approve order: " + updateError.message);

        // Notify the buyer that their code is ready to view
        try {
          let buyerEmail: string | null = order.guest_email || null;
          if (!buyerEmail && order.user_id) {
            const { data: authUser } = await adminClient.auth.admin.getUserById(order.user_id);
            buyerEmail = authUser?.user?.email || null;
          }
          if (buyerEmail) {
            const tokenParam = order.access_token ? `?token=${order.access_token}` : "";
            await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                templateName: "order-approved-code-ready",
                recipientEmail: buyerEmail,
                idempotencyKey: `order-approved-${order.id}`,
                templateData: {
                  gameTitle: order.game_title,
                  platform: order.platform,
                  orderId: order.paypal_order_id || order.id,
                  orderLink: `https://agevers.com/order/${order.paypal_order_id || order.id}${tokenParam}`,
                },
              }),
            });
          }
        } catch (e) {
          console.error("approve_held_order: failed to send approval email", e);
        }

        result = { success: true, message: needsRevealPurchase
          ? "Order approved — key will be purchased when buyer reveals it"
          : "Order approved and released to buyer" };
        break;
      }

      case "reject_held_order": {
        const orderId = params.orderId;
        if (!orderId) throw new Error("Missing orderId");

        const callerId2 = (req as any).__callerId;

        const { data: order, error: orderError } = await adminClient
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();
        if (orderError || !order) throw new Error("Order not found");
        if (!order.is_held) throw new Error("Order is not on hold");

        // Reject - clear game code, mark as rejected
        const { error: updateError } = await adminClient
          .from("orders")
          .update({
            status: "rejected",
            game_code: null,
            is_held: false,
            approved_by: callerId2,
            approved_at: new Date().toISOString(),
          })
          .eq("id", orderId);
        if (updateError) throw new Error("Failed to reject order: " + updateError.message);

        // Automatic refund: a rejected order must never keep the customer's money.
        let refundInfo: any = { refunded: false };
        try {
          if (order.paypal_order_id) {
            const { data: existingRefunds } = await adminClient
              .from("order_refunds")
              .select("amount")
              .eq("order_id", orderId);
            const refundedTotal = (existingRefunds || []).reduce(
              (sum: number, r: any) => sum + Number(r.amount || 0), 0);
            const remaining = Math.max(Number(order.price) - refundedTotal, 0);

            if (remaining > 0) {
              const paypalAuth = await getPaypalAccessToken();
              const detailsRes = await fetch(
                `${paypalAuth.baseUrl}/v2/checkout/orders/${order.paypal_order_id}`,
                { headers: { Authorization: `Bearer ${paypalAuth.accessToken}`, "Content-Type": "application/json" } },
              );
              const details = await detailsRes.json();
              const captureId = details?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
              if (!captureId) throw new Error("No PayPal capture found for this order");

              const refundRes = await fetch(
                `${paypalAuth.baseUrl}/v2/payments/captures/${captureId}/refund`,
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${paypalAuth.accessToken}`, "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                },
              );
              const refundData = await refundRes.json();
              if (!refundRes.ok) {
                throw new Error(refundData?.message || refundData?.details?.[0]?.description || "PayPal refund failed");
              }

              await adminClient.from("order_refunds").insert({
                order_id: orderId,
                paypal_order_id: order.paypal_order_id,
                paypal_capture_id: captureId,
                paypal_refund_id: refundData?.id || null,
                refund_type: "full",
                amount: remaining,
                currency: "EUR",
                status: refundData?.status || "completed",
                reason: "Order rejected by admin",
                admin_note: "Automatic refund on rejection",
                refunded_by: callerId2,
              });

              refundInfo = { refunded: true, amount: remaining, refund_id: refundData?.id || null };
            } else {
              refundInfo = { refunded: false, reason: "already_refunded" };
            }
          } else {
            refundInfo = { refunded: false, reason: "no_paypal_payment" };
          }
        } catch (e) {
          console.error("reject_held_order: automatic refund failed", e);
          refundInfo = { refunded: false, error: e instanceof Error ? e.message : "refund failed" };
        }

        result = {
          success: true,
          refund: refundInfo,
          message: refundInfo.refunded
            ? `Order rejected and refunded €${Number(refundInfo.amount).toFixed(2)}`
            : refundInfo.error
              ? `Order rejected, but automatic refund failed: ${refundInfo.error}`
              : "Order rejected",
        };
        break;
      }


      case "mark_shipped": {
        const orderId = params.orderId;
        const trackingNumber = params.tracking_number || null;
        const trackingUrl = params.tracking_url || null;
        const carrierName = params.carrier_name || null;
        if (!orderId) throw new Error("Missing orderId");

        const { error: updateError } = await adminClient
          .from("orders")
          .update({
            status: "shipped",
            tracking_number: trackingNumber,
            tracking_url: trackingUrl,
            carrier_name: carrierName,
            shipped_at: new Date().toISOString(),
          })
          .eq("id", orderId);
        if (updateError) throw new Error("Failed to mark as shipped: " + updateError.message);

        // Get order + buyer info for email notification
        const { data: shippedOrder } = await adminClient
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (shippedOrder) {
          const { data: userData } = await adminClient.auth.admin.getUserById(shippedOrder.user_id);
          const buyerEmail = userData?.user?.email;
          if (buyerEmail) {
            // Send shipping notification email
            try {
              const subject = `Your order has been shipped! 🚚`;
              const html = `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#161622;color:#e0e0e0;padding:32px;border-radius:12px;">
                      <h1 style="color:#7c3aed;font-size:24px;">Your Order Has Been Shipped!</h1>
                      <p>Great news! Your order for <strong>${shippedOrder.game_title}</strong> has been shipped.</p>
                      ${trackingNumber ? `<p><strong>Tracking Number:</strong> ${trackingNumber}</p>` : ""}
                      ${carrierName ? `<p><strong>Carrier:</strong> ${carrierName}</p>` : ""}
                      ${trackingUrl ? `<p><a href="${trackingUrl}" style="color:#7c3aed;">Track Your Package →</a></p>` : ""}
                      <p style="margin-top:24px;color:#888;">Thank you for shopping with Agevers!</p>
                    </div>
                  `;
              const messageId = `ship-${orderId}-${Date.now()}`;

              // Check active provider (respects the admin toggle)
              let provider: "lovable" | "resend" = "resend";
              try {
                const { data: settings } = await adminClient
                  .from("site_settings")
                  .select("email_provider")
                  .eq("id", 1)
                  .single();
                if ((settings as any)?.email_provider === "lovable") provider = "lovable";
              } catch (_e) { /* default resend */ }

              if (provider === "lovable") {
                const { error: enqErr } = await adminClient.rpc("enqueue_email" as any, {
                  queue_name: "transactional_emails",
                  payload: {
                    to: buyerEmail,
                    from: "Agevers <noreply@updates.agevers.com>",
                    sender_domain: "updates.agevers.com",
                    subject,
                    html,
                    message_id: messageId,
                    purpose: "transactional",
                    label: "order_shipped",
                    idempotency_key: messageId,
                    queued_at: new Date().toISOString(),
                  },
                });
                await adminClient.from("email_send_log").insert({
                  recipient_email: buyerEmail,
                  template_name: "order_shipped",
                  status: enqErr ? "failed" : "pending",
                  message_id: messageId,
                  error_message: enqErr ? "Failed to enqueue: " + enqErr.message : null,
                });
              } else {
                const resendApiKey = Deno.env.get("RESEND_API_KEY");
                if (resendApiKey) {
                const resendRes = await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    from: "Agevers <noreply@updates.agevers.com>",
                    to: [buyerEmail],
                    subject,
                    html,
                  }),
                });
                const resendBody = await resendRes.json().catch(() => ({}));
                await adminClient.from("email_send_log").insert({
                  recipient_email: buyerEmail,
                  template_name: "order_shipped",
                  status: resendRes.ok ? "sent" : "failed",
                  message_id: messageId,
                  error_message: resendRes.ok ? null : (resendBody?.message || `Resend HTTP ${resendRes.status}`),
                });
                }
              }
            } catch (emailErr) {
              console.error("Failed to send shipping email:", emailErr);
            }
          }
        }

        result = { success: true, message: "Order marked as shipped" };
        break;
      }

      case "buy_aliexpress": {
        const orderId = params.orderId;
        if (!orderId) throw new Error("Missing orderId");

        // Get order details with shipping address
        const { data: order, error: orderErr } = await adminClient
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();
        if (orderErr || !order) throw new Error("Order not found");

        // Find the aliexpress_product_id from allowed_products by title
        const { data: apMatch } = await adminClient
          .from("allowed_products")
          .select("aliexpress_product_id")
          .eq("title", order.game_title)
          .not("aliexpress_product_id", "is", null)
          .limit(1)
          .maybeSingle();

        if (!apMatch?.aliexpress_product_id) throw new Error("No AliExpress product ID found for this order");

        // Build shipping address from order
        const shippingAddress = {
          full_name: order.shipping_full_name || "",
          address_line1: order.shipping_address_line1 || "",
          address_line2: order.shipping_address_line2 || "",
          city: order.shipping_city || "",
          state: order.shipping_state || "",
          country: order.shipping_country || "",
          zip_code: order.shipping_zip_code || "",
          phone: order.shipping_phone || "",
          phone_country: "",
        };

        // Call aliexpress-api place_order
        const placeRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/aliexpress-api`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": req.headers.get("authorization") || "",
            },
            body: JSON.stringify({
              action: "place_order",
              product_id: apMatch.aliexpress_product_id,
              quantity: order.quantity || 1,
              shipping_address: shippingAddress,
              logistics_service_name: params.logistics_service_name || "CAINIAO_STANDARD",
              sku_attr: params.sku_attr || undefined,
            }),
          }
        );
        const placeData = await placeRes.json();

        if (!placeData.success || !placeData.aliexpress_order_id) {
          throw new Error("AliExpress order failed: " + JSON.stringify(placeData.raw || placeData).substring(0, 500));
        }

        // Save the AliExpress order ID to our order
        await adminClient
          .from("orders")
          .update({ aliexpress_order_id: String(placeData.aliexpress_order_id) })
          .eq("id", orderId);

        result = {
          success: true,
          aliexpress_order_id: placeData.aliexpress_order_id,
          message: "AliExpress order placed successfully",
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getCategory(platform: string, store: string): string {
  const consolePlatforms = ["PlayStation", "Xbox", "Nintendo"];
  if (consolePlatforms.includes(platform)) {
    const sub = store.toLowerCase();
    if (sub === "games") return "games";
    if (sub === "subscriptions") return "subscriptions";
    if (sub === "top ups") return "topups";
  }
  return "games";
}

async function getPaypalAccessToken() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_SECRET");
  if (!clientId || !secret) {
    throw new Error("PayPal credentials are not configured");
  }

  const isLive = Deno.env.get("PAYPAL_LIVE")?.toLowerCase() === "true";
  const baseUrl = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

  const authRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const authData = await authRes.json();
  if (!authRes.ok || !authData?.access_token) {
    throw new Error(authData?.error_description || "Failed to authenticate with PayPal");
  }

  return { accessToken: authData.access_token as string, baseUrl };
}

function distributeStock(totalStock: number, numSellers: number): number[] {
  if (totalStock <= 0 || numSellers <= 0) return Array(numSellers).fill(0);
  
  const portions: number[] = Array(numSellers).fill(0);
  const weights = Array.from({ length: numSellers }, () => Math.random() * 10 + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  let distributed = 0;
  for (let i = 0; i < numSellers; i++) {
    if (i === numSellers - 1) {
      portions[i] = totalStock - distributed;
    } else {
      portions[i] = Math.floor((weights[i] / totalWeight) * totalStock);
      distributed += portions[i];
    }
    if (portions[i] === 0 && Math.random() > 0.3) {
    }
  }
  
  return portions;
}
