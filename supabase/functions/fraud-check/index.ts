import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// --- In-memory rate limiter ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 requests per minute per user

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60_000);

// New-account spend caps (cumulative, per rolling 24h window). Raised tier
// applies when IP + email signals look clean; full removal of the cap
// entirely is a separate, admin-only action (new_account_limit_exempt) —
// never granted automatically, regardless of how clean the signals are.
const BASE_NEW_ACCOUNT_CAP = 20;
const RAISED_NEW_ACCOUNT_CAP = 60;

const DISPOSABLE_EMAIL_DOMAINS = ['tempmail.com', 'guerrillamail.com', 'throwaway.email', 'mailinator.com', 'yopmail.com', 'temp-mail.org', 'fakeinbox.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'dispostable.com', '10minutemail.com', 'trashmail.com'];

interface FraudCheckResult {
  allowed: boolean;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  blocked_reason?: string;
}

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

    // Helper: validate IPv4/IPv6 to prevent header spoofing & filter injection
    const isValidIp = (ip: string | null | undefined): ip is string => {
      if (!ip) return false;
      const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
      const ipv6 = /^[0-9a-fA-F:]+$/;
      return (ipv4.test(ip) || (ipv6.test(ip) && ip.includes(':'))) && ip.length <= 45;
    };
    const resolveClientIp = (): string | null => {
      // Prefer Cloudflare's header (set by our edge), then every other
      // proxy header we may sit behind, and only then generic XFF chains.
      const forwarded = req.headers.get('forwarded');
      const forwardedFor = forwarded?.match(/for=\"?\[?([^\];,\"\s]+)/i)?.[1] ?? null;
      const candidates = [
        req.headers.get('cf-connecting-ip'),
        req.headers.get('true-client-ip'),
        req.headers.get('x-real-ip'),
        req.headers.get('fly-client-ip'),
        req.headers.get('x-envoy-external-address'),
        req.headers.get('x-client-ip'),
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        forwardedFor,
      ];
      for (const c of candidates) {
        if (isValidIp(c)) return c;
      }
      return null;
    };


    // Rate limit check — bucket by validated IP, otherwise by user id
    const clientIpForRL = resolveClientIp() || user.id;
    if (isRateLimited(`fraud:${clientIpForRL}`)) {
      // Log rate limit event to dashboard
      await supabase.from('rate_limit_events').insert({
        ip_address: clientIpForRL,
        endpoint: '/functions/v1/fraud-check',
        method: req.method,
        user_agent: req.headers.get('user-agent') || null,
        user_id: user.id,
        was_blocked: true,
        event_count: rateLimitMap.get(`fraud:${clientIpForRL}`)?.count || 1,
      }).then(() => {});
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { items, total_amount, action } = body;

    // Admin actions: block/unblock/resolve
    if (action === 'block_user' || action === 'unblock_user') {
      // Verify caller is admin
      const { data: callerRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const isAdmin = (callerRoles || []).some((r: any) => ['admin', 'super_admin'].includes(r.role));
      if (!isAdmin) throw new Error('Not authorized');

      const targetUserId = body.target_user_id;
      if (!targetUserId) throw new Error('Missing target_user_id');

      const isBlock = action === 'block_user';
      await upsertFraudScore(supabase, targetUserId, {
        is_blocked: isBlock,
        risk_level: isBlock ? 'critical' : 'medium',
        notes: body.reason || (isBlock ? 'Manually blocked by admin' : 'Unblocked by admin'),
      });

      if (isBlock) {
        await supabase.from('fraud_flags').insert({
          user_id: targetUserId,
          flag_type: 'manual_block',
          severity: 'critical',
          description: body.reason || 'Manually blocked by admin',
          metadata: { blocked_by: user.id },
        });
      }

      return json({ success: true, action });
    }

    if (action === 'resolve_flag') {
      const { data: callerRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const isAdmin = (callerRoles || []).some((r: any) => ['admin', 'super_admin'].includes(r.role));
      if (!isAdmin) throw new Error('Not authorized');

      await supabase.from('fraud_flags').update({
        resolved: true,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_note: body.resolution_note || 'Resolved',
      }).eq('id', body.flag_id);

      return json({ success: true });
    }

    if (action === 'delete_flag') {
      const { data: callerRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const isAdmin = (callerRoles || []).some((r: any) => ['admin', 'super_admin'].includes(r.role));
      if (!isAdmin) throw new Error('Not authorized');
      if (!body.flag_id) throw new Error('Missing flag_id');

      const { error: delErr } = await supabase.from('fraud_flags').delete().eq('id', body.flag_id);
      if (delErr) throw new Error(delErr.message);

      return json({ success: true });
    }

    if (action === 'set_new_account_exempt') {
      const { data: callerRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const isAdmin = (callerRoles || []).some((r: any) => ['admin', 'super_admin'].includes(r.role));
      if (!isAdmin) throw new Error('Not authorized');

      const targetUserId = body.target_user_id;
      if (!targetUserId) throw new Error('Missing target_user_id');
      const exempt = !!body.exempt;

      await upsertFraudScore(supabase, targetUserId, {
        new_account_limit_exempt: exempt,
        // clearing the manual limit window when exempting
        ...(exempt ? { new_account_limit_until: null } : {}),
        notes: exempt
          ? 'New-account €20/24h limit removed by admin'
          : 'New-account €20/24h limit re-enabled by admin',
      } as any);

      await supabase.from('admin_audit_log').insert({
        performed_by: user.id,
        performer_email: user.email,
        action_type: exempt ? 'remove_new_account_limit' : 'restore_new_account_limit',
        entity_type: 'user',
        entity_id: targetUserId,
        changes: { exempt },
      }).then(() => {}, () => {});

      return json({ success: true, exempt });
    }

    if (action === 'auto_precheck_new_account') {
      // Self-service only — always operates on the CALLING user's own
      // account, never a target_user_id. Runs once right after signup
      // (post email-verification) to raise a brand-new account from the
      // base €20/24h spend cap to €60/24h when IP + email signals look
      // clean, without waiting for a real purchase attempt. No automatic
      // path removes the cap entirely — only an admin, after real (human)
      // verification, can do that via new_account_limit_exempt. Fails
      // closed on anything uncertain: no signal, ambiguous signal, or any
      // error just leaves the account on the base €20 cap.
      const accountAgeHours = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60);
      const { data: existingForPrecheck } = await supabase
        .from('fraud_scores')
        .select('new_account_limit_exempt, new_account_limit_cap, is_blocked')
        .eq('user_id', user.id)
        .maybeSingle();

      if (
        accountAgeHours >= 24 ||
        existingForPrecheck?.new_account_limit_exempt ||
        existingForPrecheck?.is_blocked ||
        existingForPrecheck?.new_account_limit_cap != null
      ) {
        return json({ skipped: true });
      }

      const precheckIp = resolveClientIp();
      const { clean, ipSignalChecked, flags: precheckFlags } = await checkCleanSignals(supabase, user.email, precheckIp);
      const raisedCap = clean && ipSignalChecked;
      const cap = raisedCap ? RAISED_NEW_ACCOUNT_CAP : BASE_NEW_ACCOUNT_CAP;

      await upsertFraudScore(supabase, user.id, {
        new_account_limit_cap: cap,
        notes: raisedCap
          ? `New-account cap raised to €${RAISED_NEW_ACCOUNT_CAP}/24h at signup: clean IP + email signals`
          : `New-account cap left at base €${BASE_NEW_ACCOUNT_CAP}/24h at signup`,
      } as any);

      // Log the outcome every time, not just on a raised cap — this is the
      // only visibility into WHY an account didn't get raised (no IP
      // resolved at all vs. a dirty signal vs. providers disabled), so it's
      // possible to tell from the Fraud Dashboard whether accounts are still
      // failing to clear because resolveClientIp() found no usable header.
      await supabase.from('fraud_flags').insert({
        user_id: user.id,
        flag_type: raisedCap ? 'new_account_cap_raised' : 'new_account_precheck_not_cleared',
        severity: 'low',
        description: raisedCap
          ? `New-account cap raised to €${RAISED_NEW_ACCOUNT_CAP}/24h at signup (clean signals)`
          : !precheckIp
            ? 'New-account precheck: no client IP could be resolved from request headers — IP-based signals skipped'
            : !ipSignalChecked
              ? 'New-account precheck: IP resolved but no provider returned a result (disabled or all requests failed)'
              : 'New-account precheck: cap not raised — dirty signal detected',
        metadata: { ip: precheckIp, ip_signal_checked: ipSignalChecked, flags: precheckFlags },
      }).then(() => {}, () => {});

      return json({ cap });
    }

    // === FRAUD CHECK FOR PURCHASE ===
    const flags: string[] = [];
    let riskScore = 0;
    let ipqsMaxScore: number | null = null;
    let externalBlockReason: string | null = null;

    const clientIp = resolveClientIp();

    // 0. Check whitelist — if whitelisted, skip all checks.
    // Use parameterized .eq() queries (never string-interpolated .or() filters)
    // and fail closed on any query error.
    const userEmail = (user.email || '').toLowerCase();
    const lookupListEntries = async (listType: 'whitelist' | 'blacklist') => {
      const queries = [
        supabase.from('fraud_lists').select('id, entry_type, value')
          .eq('list_type', listType).eq('entry_type', 'email').eq('value', userEmail),
      ];
      if (clientIp) {
        queries.push(
          supabase.from('fraud_lists').select('id, entry_type, value')
            .eq('list_type', listType).eq('entry_type', 'ip').eq('value', clientIp),
        );
      }
      const results = await Promise.all(queries);
      for (const r of results) {
        if (r.error) throw new Error(`fraud_lists ${listType} lookup failed: ${r.error.message}`);
      }
      return results.flatMap((r) => r.data || []);
    };

    let whitelistEntries: any[];
    let blacklistEntries: any[];
    try {
      whitelistEntries = await lookupListEntries('whitelist');
      blacklistEntries = await lookupListEntries('blacklist');
    } catch (lookupErr) {
      // Fail closed: if we cannot verify the fraud lists, do not allow the purchase.
      console.error(lookupErr);
      return json({
        allowed: false,
        risk_score: 100,
        risk_level: 'critical',
        flags: ['Fraud screening temporarily unavailable — please try again'],
      } as FraudCheckResult);
    }

    if (whitelistEntries && whitelistEntries.length > 0) {
      return json({
        allowed: true,
        risk_score: 0,
        risk_level: 'low',
        flags: ['Whitelisted — skipped fraud checks'],
      } as FraudCheckResult);
    }

    // 0b. Check blacklist — if blacklisted, instant block
    if (blacklistEntries.length > 0) {
      const entry = blacklistEntries[0] as any;
      const reason = `Blacklisted ${entry.entry_type}: ${entry.value}`;
      await upsertFraudScore(supabase, user.id, {
        risk_score: 100,
        risk_level: 'critical',
        is_blocked: true,
        notes: reason,
      });
      await supabase.from('fraud_flags').insert({
        user_id: user.id,
        flag_type: 'blacklist_block',
        severity: 'critical',
        description: reason,
        metadata: { entry_type: entry.entry_type, value: entry.value },
      });
      await notifyTelegram(
        `🚫 <b>Purchase BLOCKED (blacklist)</b>\n` +
        `User: <code>${user.email || user.id}</code>\n` +
        `Amount: €${(total_amount ?? 0).toFixed(2)}\n` +
        `Reason: ${reason}\n` +
        `IP: <code>${clientIp || 'n/a'}</code>`
      );
      return json({
        allowed: false,
        risk_score: 100,
        risk_level: 'critical',
        flags: [reason],
        blocked_reason: 'Your transaction has been blocked. Please contact support.',
      } as FraudCheckResult);
    }

    // 1. Check if user is already blocked
    const { data: existingScore } = await supabase
      .from('fraud_scores')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingScore?.is_blocked) {
      // Do NOT send a Telegram notification here — the admin was already
      // notified when this user was first blocked. Repeated checkout attempts
      // by an already-blocked user would otherwise spam the channel.
      return json({
        allowed: false,
        risk_score: 100,
        risk_level: 'critical',
        flags: ['Account is blocked'],
        blocked_reason: existingScore.notes || 'Your account has been suspended due to suspicious activity.',
      } as FraudCheckResult);
    }

    // 2. Account age check
    // New accounts (< 24h) are capped at €20/24h cumulative spend by default,
    // raised to €60/24h if IP + email signals look clean (evaluated once at
    // signup by auto_precheck_new_account, or here on first use if that never
    // ran — e.g. OAuth signups skip the signup-time call). Admins can also
    // apply the base limit manually after a manual unblock by setting
    // `new_account_limit_until`, and can fully remove any cap after real
    // (human) verification via `new_account_limit_exempt` — that flag is
    // never set automatically, regardless of how clean the signals look.
    const accountAge = Date.now() - new Date(user.created_at).getTime();
    const accountAgeHours = accountAge / (1000 * 60 * 60);

    const manualLimitUntil = (existingScore as any)?.new_account_limit_until
      ? new Date((existingScore as any).new_account_limit_until).getTime()
      : 0;
    const manualLimitActive = manualLimitUntil > Date.now();
    const isExempt = !!(existingScore as any)?.new_account_limit_exempt;
    const treatAsNewAccount = !isExempt && (accountAgeHours < 24 || manualLimitActive);

    if (treatAsNewAccount) {
      let newAccountCap = (existingScore as any)?.new_account_limit_cap;
      if (newAccountCap == null) {
        const { clean, ipSignalChecked } = await checkCleanSignals(supabase, user.email, clientIp);
        newAccountCap = (clean && ipSignalChecked) ? RAISED_NEW_ACCOUNT_CAP : BASE_NEW_ACCOUNT_CAP;
        await upsertFraudScore(supabase, user.id, { new_account_limit_cap: newAccountCap });
      }

      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentSpendOrders } = await supabase
        .from('orders')
        .select('price')
        .eq('user_id', user.id)
        .gte('created_at', windowStart);
      const spentLast24h = (recentSpendOrders || []).reduce((sum: number, o: any) => sum + (o.price || 0), 0);
      const prospectiveSpend = spentLast24h + (total_amount ?? 0);

      if (prospectiveSpend > newAccountCap) {
        riskScore += 50;
        const hoursLeft = manualLimitActive
          ? (manualLimitUntil - Date.now()) / (1000 * 60 * 60)
          : (24 - accountAgeHours);
        const reason = manualLimitActive
          ? `Manual trust-building window active — 24h spend €${prospectiveSpend.toFixed(2)} would exceed €${newAccountCap} cap, ${hoursLeft.toFixed(1)}h left`
          : `New account (<24h) — 24h spend €${prospectiveSpend.toFixed(2)} would exceed €${newAccountCap} cap`;
        flags.push(reason);
        if (!externalBlockReason) {
          externalBlockReason = `NEW_ACCOUNT_LIMIT|For your security, new accounts are limited to €${newAccountCap} total per 24 hours. Time remaining: ~${hoursLeft.toFixed(1)}h. Please lower the order, wait, or contact support to review your order manually.`;
        }
      }
    }

    // 3. Email verification check
    if (!user.email_confirmed_at) {
      riskScore += 20;
      flags.push('Email not verified');
    }

    // 4. Rapid purchase frequency check (purchases in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    if ((recentOrders || 0) >= 5) {
      riskScore += 35;
      flags.push(`${recentOrders} purchases in the last hour (velocity alert)`);
    } else if ((recentOrders || 0) >= 3) {
      riskScore += 20;
      flags.push(`${recentOrders} purchases in the last hour`);
    }

    // 5. High value transaction check
    if (total_amount > 200) {
      riskScore += 15;
      flags.push(`High value transaction: €${total_amount.toFixed(2)}`);
    } else if (total_amount > 100) {
      riskScore += 8;
      flags.push(`Elevated transaction value: €${total_amount.toFixed(2)}`);
    }

    // 6. Large quantity of same item
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.quantity >= 5) {
          riskScore += 25;
          flags.push(`Bulk purchase: ${item.quantity}x "${item.title}"`);
        } else if (item.quantity >= 3) {
          riskScore += 10;
          flags.push(`Multiple quantity: ${item.quantity}x "${item.title}"`);
        }
      }
    }

    // 7. Daily spend check
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: todayOrders } = await supabase
      .from('orders')
      .select('price')
      .eq('user_id', user.id)
      .gte('created_at', todayStart.toISOString());

    const dailySpend = (todayOrders || []).reduce((sum: number, o: any) => sum + (o.price || 0), 0) + total_amount;
    if (dailySpend > 500) {
      riskScore += 30;
      flags.push(`Daily spend €${dailySpend.toFixed(2)} exceeds €500 limit`);
    } else if (dailySpend > 300) {
      riskScore += 15;
      flags.push(`Elevated daily spend: €${dailySpend.toFixed(2)}`);
    }

    // 8. Multiple accounts check - same email domain pattern (disposable email detection)
    const emailDomain = (user.email?.split('@')[1] || '').toLowerCase();
    if (DISPOSABLE_EMAIL_DOMAINS.includes(emailDomain)) {
      riskScore += 40;
      flags.push(`Disposable email provider: ${emailDomain}`);
    }

    // 9. Previous fraud history
    if (existingScore) {
      riskScore += Math.min(existingScore.risk_score * 0.3, 20); // Carry over 30% of previous score, max 20
      if (existingScore.total_chargebacks > 0) {
        riskScore += 40;
        flags.push(`${existingScore.total_chargebacks} previous chargeback(s)`);
      }
      if (existingScore.total_flags > 3) {
        riskScore += 15;
        flags.push(`${existingScore.total_flags} previous fraud flags`);
      }
    }

    // 10. Blaze coins abuse check
    const { data: coinData } = await supabase
      .from('user_coins')
      .select('balance, total_earned, total_spent')
      .eq('user_id', user.id)
      .maybeSingle();

    if (coinData && coinData.total_earned > 1000 && accountAgeHours < 72) {
      riskScore += 25;
      flags.push('Abnormally high coin earnings for new account');
    }

    // Protection-layer switches (admin controlled)
    const { data: protSettings } = await supabase
      .from('site_settings')
      .select('ipqs_enabled, proxycheck_enabled, abuseipdb_enabled')
      .eq('id', 1)
      .maybeSingle();
    const ipqsEnabled = protSettings?.ipqs_enabled !== false;
    const proxycheckEnabled = protSettings?.proxycheck_enabled !== false;
    const abuseipdbEnabled = protSettings?.abuseipdb_enabled !== false;

    // 11. AbuseIPDB check
    const ABUSE_IP_DB_KEY = abuseipdbEnabled ? Deno.env.get('ABUSE_IP_DB_KEY') : null;
    if (ABUSE_IP_DB_KEY && clientIp) {
      const abuseResult = await checkAbuseIPDB(ABUSE_IP_DB_KEY, clientIp);
      if (abuseResult) {
        if (abuseResult.abuseConfidenceScore > 75) {
          riskScore += 60;
          externalBlockReason = `High-risk IP detected (AbuseIPDB score: ${abuseResult.abuseConfidenceScore})`;
          flags.push(externalBlockReason);
        } else if (abuseResult.abuseConfidenceScore > 40) {
          riskScore += 25;
          flags.push(`Suspicious IP (AbuseIPDB score: ${abuseResult.abuseConfidenceScore})`);
        } else if (abuseResult.abuseConfidenceScore > 10) {
          riskScore += 10;
          flags.push(`Mild IP risk (AbuseIPDB score: ${abuseResult.abuseConfidenceScore})`);
        }
        if (abuseResult.isTor) {
          riskScore += 30;
          flags.push('Tor exit node detected');
        }
        if (abuseResult.totalReports > 50) {
          riskScore += 15;
          flags.push(`IP reported ${abuseResult.totalReports} times on AbuseIPDB`);
        }
      }
    }

    // 12. IP + Email reputation (IPQS primary, ProxyCheck.io fallback)
    const IPQS_API_KEY = ipqsEnabled ? Deno.env.get('IPQS_API_KEY') : null;
    const PROXYCHECK_API_KEY = proxycheckEnabled ? Deno.env.get('PROXYCHECK_API_KEY') : null;
    {
      // IP check
      if (clientIp) {
        let ipProvider = 'IPQS';
        let ipqsIp = IPQS_API_KEY
          ? await checkIpQuality(IPQS_API_KEY, clientIp, supabase)
          : null;
        if (!ipqsIp && PROXYCHECK_API_KEY) {
          ipqsIp = await checkProxyCheck(PROXYCHECK_API_KEY, clientIp, supabase);
          ipProvider = 'ProxyCheck';
        }
        if (ipqsIp) {
          const P = ipProvider;
          // Mobile/cellular networks (CGNAT) — many real customers share the
          // same IP, so a single bad actor poisons the score for everyone.
          // Soften the IPQS impact by ~40% and skip VPN/Proxy penalties when
          // the connection is mobile.
          const isMobile = ipqsIp.mobile === true
            || /mobile|cellular/i.test(ipqsIp.connection_type || '');
          // VPN/Proxy users: providers (especially IPQS) inflate the score to
          // 90-100 and often mark shared VPN exit nodes as "bot" purely because
          // the IP is a datacenter range. Gaming-key buyers legitimately use
          // VPNs, so a VPN/proxy connection gets its score halved and is never
          // hard-blocked on score or bot_status alone — only Tor stays a block.
          const isVpnLike = (ipqsIp.vpn === true || ipqsIp.proxy === true) && ipqsIp.tor !== true;
          const softenFactor = isMobile ? 0.6 : (isVpnLike ? 0.5 : 1);
          const adjustedIpScore = Math.round(ipqsIp.fraud_score * softenFactor);
          ipqsMaxScore = Math.max(ipqsMaxScore ?? 0, adjustedIpScore);
          if (isMobile) flags.push(`${P}: Mobile/cellular network detected (${ipqsIp.connection_type || 'mobile'}) — softened scoring`);
          if (isVpnLike) flags.push(`${P}: VPN/Proxy connection — softened scoring (raw ${ipqsIp.fraud_score})`);
          // Gaming keys customers commonly use VPN/proxy for region-locked products,
          // so VPN/Proxy alone is NEVER a hard block — auto-block only on
          // score > 85 or Tor/Bot (clear abuse signals). Scores 70–85 pass through.
          if (adjustedIpScore > 85) {
            riskScore += 60;
            externalBlockReason = `${P} flagged IP as high risk (score: ${adjustedIpScore}${isMobile ? `, raw ${ipqsIp.fraud_score}` : ''})`;
            flags.push(externalBlockReason);
          } else if (adjustedIpScore >= 70) {
            riskScore += 15;
            flags.push(`${P} suspicious IP (score: ${adjustedIpScore}) — allowed to continue`);
          } else if (adjustedIpScore >= 60) {
            riskScore += 10;
            flags.push(`${P} elevated IP risk (score: ${adjustedIpScore})`);
          }
          if (ipqsIp.tor) {
            riskScore += 60;
            if (!externalBlockReason) externalBlockReason = `${P}: Tor exit node detected`;
            flags.push(`${P}: Tor exit node (hard block)`);
          }
          // VPN / Proxy: informational only, never an auto-block on their own.
          if (ipqsIp.vpn && !isMobile) { riskScore += 5; flags.push(`${P}: VPN detected (not blocking)`); }
          if (ipqsIp.proxy && !isMobile) { riskScore += 5; flags.push(`${P}: Proxy detected (not blocking)`); }
          if (ipqsIp.bot_status && isVpnLike) {
            // Shared VPN exit nodes are routinely mislabelled as bots.
            // This is pure noise for legitimate VPN users — ignore completely.
          } else if (ipqsIp.bot_status) {
            riskScore += 60;
            if (!externalBlockReason) externalBlockReason = `${P}: Bot activity detected`;
            flags.push(`${P}: Bot activity detected (hard block)`);
          }
        }
      }
      // Email check
      if (user.email && IPQS_API_KEY) {
        const ipqsEmail = await checkEmailQuality(IPQS_API_KEY, user.email, supabase);
        if (ipqsEmail) {
          ipqsMaxScore = Math.max(ipqsMaxScore ?? 0, ipqsEmail.fraud_score);
          if (!ipqsEmail.valid) { riskScore += 25; flags.push('IPQS: Invalid email address'); }
          if (ipqsEmail.disposable) { riskScore += 35; flags.push('IPQS: Disposable email'); }
          if (ipqsEmail.fraud_score >= 90) {
            riskScore += 40;
            if (!externalBlockReason) externalBlockReason = `IPQS flagged email as high risk (score: ${ipqsEmail.fraud_score})`;
            flags.push(`IPQS high-risk email (score: ${ipqsEmail.fraud_score})`);
          } else if (ipqsEmail.fraud_score >= 75) {
            riskScore += 20;
            flags.push(`IPQS suspicious email (score: ${ipqsEmail.fraud_score})`);
          }
        }
      }
    }

    // === Trust discount for returning customers ===
    // Customers with successful past purchases (and zero chargebacks) get a
    // score reduction. This offsets shared-IP false positives (mobile CGNAT,
    // office networks, etc.) for users who already proved themselves.
    // Discount is NOT applied when a hard external block is already set
    // (Tor, Bot, blacklist, IPQS >= 95) — trust does not override abuse.
    // Count REAL completed orders — never attempts. A brand new user must not
    // get a trust discount just because they reached checkout before.
    const { count: completedOrdersCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['completed', 'delivered']);
    const successfulOrders = completedOrdersCount || 0;
    const chargebacks = existingScore?.total_chargebacks || 0;
    let trustDiscount = 0;
    if (successfulOrders >= 1 && chargebacks === 0 && !externalBlockReason) {
      if (successfulOrders >= 5) trustDiscount = 30;
      else if (successfulOrders >= 3) trustDiscount = 20;
      else trustDiscount = 10;
      riskScore = Math.max(0, riskScore - trustDiscount);
      flags.push(`Trusted customer: ${successfulOrders} successful purchase(s) — −${trustDiscount} risk`);
    }

    // Calculate risk level
    const cappedScore = Math.min(Math.round(riskScore), 100);
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (cappedScore >= 95) riskLevel = 'critical';
    else if (cappedScore >= 70) riskLevel = 'high';
    else if (cappedScore >= 40) riskLevel = 'medium';

    const allowed = !externalBlockReason && cappedScore < 95; // Block only on external reason or score >= 95
    const wasAlreadyBlocked = !!existingScore?.is_blocked;
    // New-account €20/24h limit is a SOFT block — it stops this attempt but
    // does NOT permanently mark the account as blocked or trigger the
    // "account blocked" email. It naturally clears once the account ages out.
    const isNewAccountLimit = !!externalBlockReason && externalBlockReason.startsWith('NEW_ACCOUNT_LIMIT|');
    const becomingBlocked = !allowed && !wasAlreadyBlocked && !isNewAccountLimit;

    // Save fraud score
    await upsertFraudScore(supabase, user.id, {
      risk_score: cappedScore,
      risk_level: riskLevel,
      total_flags: (existingScore?.total_flags || 0) + flags.length,
      // Only count as a "purchase attempt" when the check actually allowed it.
      // Blocked attempts shouldn't inflate the counter.
      // Reflect actual completed orders, not checkout attempts.
      total_purchases: successfulOrders,
      last_purchase_at: existingScore?.last_purchase_at ?? null,
      is_blocked: (!allowed && !isNewAccountLimit) || (existingScore?.is_blocked ?? false),
      notes: externalBlockReason || existingScore?.notes || null,
      ...(ipqsMaxScore !== null ? { ipqs_score: ipqsMaxScore } : {}),
    });

    // Log flags
    if (flags.length > 0) {
      // Dedup: skip flags identical to ones created for this user in the last 30s
      // (prevents duplicates from React StrictMode / double-clicks / client retries)
      const dedupCutoff = new Date(Date.now() - 30 * 1000).toISOString();
      const { data: recentFlags } = await supabase
        .from('fraud_flags')
        .select('description')
        .eq('user_id', user.id)
        .gte('created_at', dedupCutoff);
      const recentDescs = new Set((recentFlags || []).map(r => r.description));
      const newFlags = flags.filter(desc => !recentDescs.has(desc));
      if (newFlags.length > 0) {
        const flagRows = newFlags.map(desc => ({
          user_id: user.id,
          flag_type: cappedScore >= 60 || externalBlockReason ? 'high_risk_purchase' : 'suspicious_activity',
          severity: externalBlockReason ? 'critical' : riskLevel,
          description: desc,
          metadata: {
            total_amount,
            items_count: items?.length || 0,
            items_titles: Array.isArray(items)
              ? items.map((it: any) => ({
                  title: String(it?.title || '').slice(0, 120),
                  quantity: Number(it?.quantity) || 1,
                  price: Number(it?.price) || 0,
                }))
              : [],
            risk_score: cappedScore,
            ipqs_score: ipqsMaxScore,
            blocked_by_ipqs: !!externalBlockReason,
            allowed,
            client_ip: clientIp,
          },
        }));
        await supabase.from('fraud_flags').insert(flagRows);
      }
    }

    const result: FraudCheckResult = {
      allowed,
      risk_score: cappedScore,
      risk_level: externalBlockReason ? 'critical' : riskLevel,
      flags,
      blocked_reason: !allowed
        ? (externalBlockReason || 'Your purchase has been flagged for review. Please contact support.')
        : undefined,
    };

    if (!allowed) {
      // Only notify Telegram on the FIRST time a user is blocked, or the
      // first new-account-limit hit. Repeated attempts by the same user
      // would otherwise spam the channel with duplicate alerts.
      const isFirstHit = becomingBlocked || (isNewAccountLimit && !wasAlreadyBlocked);
      if (isFirstHit) {
        const blockKind = isNewAccountLimit
          ? '🚫 <b>Purchase BLOCKED (new account €20 limit)</b>'
          : '🚫 <b>Purchase BLOCKED (fraud score)</b>';
        await notifyTelegram(
          `${blockKind}\n` +
          `User: <code>${user.email || user.id}</code>\n` +
          `Account age: ${accountAgeHours.toFixed(1)}h\n` +
          `Amount: €${(total_amount ?? 0).toFixed(2)}\n` +
          `Risk Score: ${cappedScore}/100 (${result.risk_level})\n` +
          `IP: <code>${clientIp || 'n/a'}</code>\n` +
          `Flags:\n• ${flags.slice(0, 8).join('\n• ')}`
        );
      }
      // Send the user a one-time email explaining the restriction
      if (becomingBlocked && user.email) {
        try {
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'account-blocked',
              recipientEmail: user.email,
              idempotencyKey: `account-blocked-${user.id}`,
              templateData: {
                customerName: (user.user_metadata as any)?.username
                  || (user.user_metadata as any)?.full_name
                  || (user.email?.split('@')[0]),
                reason: externalBlockReason || flags.slice(0, 3).join(' · ') || 'Multiple security signals during checkout.',
              },
            },
          });
        } catch (e) {
          console.error('account-blocked email failed', e);
        }
      }
      // One-time explainer email when blocked by the €20/24h new-account
      // limit. Idempotency key is per-user so repeated attempts within the
      // 24h window only send the email once.
      if (isNewAccountLimit && !wasAlreadyBlocked && user.email) {
        try {
          const hoursLeft = Math.max(0, 24 - accountAgeHours);
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'new-account-limit-blocked',
              recipientEmail: user.email,
              idempotencyKey: `new-account-limit-${user.id}`,
              templateData: {
                customerName: (user.user_metadata as any)?.username
                  || (user.user_metadata as any)?.full_name
                  || (user.email?.split('@')[0]),
                hoursLeft,
              },
            },
          });
        } catch (e) {
          console.error('new-account-limit-blocked email failed', e);
        }
      }
    } else if (cappedScore >= 60) {
      await notifyTelegram(
        `⚠️ <b>High-risk purchase ALLOWED</b>\n` +
        `User: <code>${user.email || user.id}</code>\n` +
        `Amount: €${(total_amount ?? 0).toFixed(2)}\n` +
        `Risk Score: ${cappedScore}/100 (${result.risk_level})\n` +
        `IP: <code>${clientIp || 'n/a'}</code>\n` +
        `Flags:\n• ${flags.slice(0, 8).join('\n• ')}`
      );
    }

    return json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Fraud check error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function notifyTelegram(message: string) {
  try {
    // Strip HTML tags for the plain message body; telegram-notify will re-escape.
    const plain = message.replace(/<[^>]+>/g, '');
    // Pull the first line as title, the rest as the message body.
    const lines = plain.split('\n');
    const title = lines[0]?.trim() || 'Fraud alert';
    const body = lines.slice(1).join('\n').trim() || title;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ type: 'fraud', title, message: body }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`notifyTelegram (via telegram-notify) failed [${res.status}]: ${t}`);
    }
  } catch (e) {
    console.error('Telegram notify failed:', e);
  }
}

async function upsertFraudScore(supabase: any, userId: string, updates: Record<string, any>) {
  const { data: existing } = await supabase
    .from('fraud_scores')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('fraud_scores')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  } else {
    await supabase
      .from('fraud_scores')
      .insert({ user_id: userId, ...updates });
  }
}

// === IPQualityScore API helpers ===

interface IpQualityResult {
  fraud_score: number;
  vpn: boolean;
  tor: boolean;
  bot_status: boolean;
  proxy: boolean;
  country_code: string;
  mobile: boolean;
  connection_type: string;
}

interface EmailQualityResult {
  fraud_score: number;
  valid: boolean;
  disposable: boolean;
  leaked: boolean;
  overall_score: number;
}

const IPQS_CACHE_TTL_HOURS = 24;

async function getCachedIpqs(supabase: any, key: string): Promise<any | null> {
  try {
    const { data } = await supabase
      .from('ipqs_cache')
      .select('data, expires_at')
      .eq('cache_key', key)
      .maybeSingle();
    if (data && new Date(data.expires_at).getTime() > Date.now()) {
      return data.data;
    }
  } catch (e) {
    console.error('ipqs cache read failed', e);
  }
  return null;
}

async function setCachedIpqs(supabase: any, key: string, kind: string, data: any): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + IPQS_CACHE_TTL_HOURS * 3600 * 1000).toISOString();
    await supabase.from('ipqs_cache').upsert({
      cache_key: key,
      kind,
      data,
      expires_at: expiresAt,
    }, { onConflict: 'cache_key' });
  } catch (e) {
    console.error('ipqs cache write failed', e);
  }
}

async function checkIpQuality(apiKey: string, ip: string, supabase?: any): Promise<IpQualityResult | null> {
  // Primary provider. Returns null on failure/insufficient credits so the
  // caller can fall back to ProxyCheck.io.
  const cacheKey = `ip:${ip}`;
  if (supabase) {
    const cached = await getCachedIpqs(supabase, cacheKey);
    if (cached) return cached as IpQualityResult;
  }
  try {
    const url = `https://ipqualityscore.com/api/json/ip/${apiKey}/${encodeURIComponent(ip)}?strictness=1&allow_public_access_points=true&lighter_penalties=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.error(`IPQS IP check failed [${res.status}]`);
      return null;
    }
    const data = await res.json();
    if (!data.success) {
      console.error('IPQS IP check error:', data.message);
      return null;
    }
    const result: IpQualityResult = {
      fraud_score: data.fraud_score ?? 0,
      vpn: data.vpn ?? false,
      tor: data.tor ?? false,
      bot_status: data.bot_status ?? false,
      proxy: data.proxy ?? false,
      country_code: data.country_code ?? '',
      mobile: data.mobile ?? false,
      connection_type: data.connection_type ?? '',
    };
    if (supabase) await setCachedIpqs(supabase, cacheKey, 'ip', result);
    return result;
  } catch (e) {
    console.error('IPQS IP check exception:', e);
    return null;
  }
}

async function checkEmailQuality(apiKey: string, email: string, supabase?: any): Promise<EmailQualityResult | null> {
  const cacheKey = `email:${email.toLowerCase()}`;
  // (IPQS-only; ProxyCheck does not provide email reputation)
  if (supabase) {
    const cached = await getCachedIpqs(supabase, cacheKey);
    if (cached) return cached as EmailQualityResult;
  }
  try {
    const url = `https://ipqualityscore.com/api/json/email/${apiKey}/${encodeURIComponent(email)}?fast=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.error(`IPQS email check failed [${res.status}]`);
      return null;
    }
    const data = await res.json();
    if (!data.success) {
      console.error('IPQS email check error:', data.message);
      return null;
    }
    const result: EmailQualityResult = {
      fraud_score: data.fraud_score ?? 0,
      valid: data.valid ?? true,
      disposable: data.disposable ?? false,
      leaked: data.leaked ?? false,
      overall_score: data.overall_score ?? 0,
    };
    if (supabase) await setCachedIpqs(supabase, cacheKey, 'email', result);
    return result;
  } catch (e) {
    console.error('IPQS email check exception:', e);
    return null;
  }
}

// === AbuseIPDB API helper ===

interface AbuseIPDBResult {
  abuseConfidenceScore: number;
  isTor: boolean;
  totalReports: number;
  countryCode: string;
}

async function checkAbuseIPDB(apiKey: string, ip: string): Promise<AbuseIPDBResult | null> {
  try {
    const url = `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose=false`;
    const res = await fetch(url, {
      headers: { 'Key': apiKey, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`AbuseIPDB check failed [${res.status}]`);
      await res.text();
      return null;
    }
    const json = await res.json();
    const data = json.data;
    if (!data) return null;
    return {
      abuseConfidenceScore: data.abuseConfidenceScore ?? 0,
      isTor: data.isTor ?? false,
      totalReports: data.totalReports ?? 0,
      countryCode: data.countryCode ?? '',
    };
  } catch (e) {
    console.error('AbuseIPDB check exception:', e);
    return null;
  }
}

// ===== ProxyCheck.io fallback (VPN / Proxy / Tor / Hosting detection) =====
// Used automatically when IPQS is unavailable (no key, error, or out of
// credits). Normalized to the same IpQualityResult scale so existing
// thresholds keep working. When IPQS credits return, IPQS becomes primary
// again with no further changes.
async function checkProxyCheck(apiKey: string, ip: string, supabase?: any): Promise<IpQualityResult | null> {
  const cacheKey = `pc:${ip}`;
  if (supabase) {
    const cached = await getCachedIpqs(supabase, cacheKey);
    if (cached) return cached as IpQualityResult;
  }
  try {
    const url = `https://proxycheck.io/v2/${encodeURIComponent(ip)}?key=${apiKey}&vpn=3&asn=1&risk=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.error(`ProxyCheck failed [${res.status}]`);
      return null;
    }
    const data = await res.json();
    if (data.status !== 'ok' && data.status !== 'warning') {
      console.error('ProxyCheck error:', data.message || data.status);
      return null;
    }
    const node = data[ip];
    if (!node) return null;

    const isProxy = node.proxy === 'yes';
    const type = String(node.type || '').toLowerCase();
    const isVpn = type === 'vpn';
    const isTor = type === 'tor';
    const isHosting = type.includes('hosting') || type.includes('compromised');
    // proxycheck "risk" is already 0-100
    let score = Number(node.risk ?? 0);
    if (isTor) score = Math.max(score, 100);
    else if (isProxy || isVpn) score = Math.max(score, 75);
    else if (isHosting) score = Math.max(score, 65);

    const result: IpQualityResult = {
      fraud_score: score,
      vpn: isVpn || (isProxy && !isTor),
      tor: isTor,
      bot_status: false,
      proxy: isProxy,
      country_code: node.isocode || '',
      mobile: type === 'mobile' || /mobile|cellular/i.test(String(node.provider || '')),
      connection_type: node.type || '',
    };
    if (supabase) await setCachedIpqs(supabase, cacheKey, 'ip', result);
    return result;
  } catch (e) {
    console.error('ProxyCheck exception:', e);
    return null;
  }
}

// Shared "is this signup/checkout attempt clean?" signal check — used both
// to raise a brand-new account's spend cap right after signup, and to
// evaluate it at checkout time if that never ran (e.g. OAuth signups skip
// the signup-time call). One definition so the two paths can't drift apart.
// Fails closed: requires an actual IP signal to have been checked — a clean
// email alone is never enough evidence to raise the cap.
async function checkCleanSignals(
  supabase: any,
  email: string | null | undefined,
  ip: string | null,
): Promise<{ clean: boolean; ipSignalChecked: boolean; flags: string[] }> {
  const flags: string[] = [];
  let clean = true;
  let ipSignalChecked = false;

  const emailDomain = (email || '').split('@')[1]?.toLowerCase() || '';
  if (DISPOSABLE_EMAIL_DOMAINS.includes(emailDomain)) {
    clean = false;
    flags.push(`Disposable email provider: ${emailDomain}`);
  }

  const { data: settings } = await supabase
    .from('site_settings')
    .select('ipqs_enabled, proxycheck_enabled, abuseipdb_enabled')
    .eq('id', 1)
    .maybeSingle();
  const ipqsKey = settings?.ipqs_enabled !== false ? Deno.env.get('IPQS_API_KEY') : null;
  const proxycheckKey = settings?.proxycheck_enabled !== false ? Deno.env.get('PROXYCHECK_API_KEY') : null;
  const abuseKey = settings?.abuseipdb_enabled !== false ? Deno.env.get('ABUSE_IP_DB_KEY') : null;

  if (ip) {
    let ipResult = ipqsKey ? await checkIpQuality(ipqsKey, ip, supabase) : null;
    if (!ipResult && proxycheckKey) ipResult = await checkProxyCheck(proxycheckKey, ip, supabase);
    if (ipResult) {
      ipSignalChecked = true;
      // Same hard-block bar as real checkout: Tor/bot/very high fraud score
      // disqualify. VPN/proxy alone does NOT — gaming-key buyers legitimately
      // use VPNs for region-locked products.
      if (ipResult.tor || ipResult.bot_status || ipResult.fraud_score > 85) {
        clean = false;
        flags.push(`IP risk: fraud_score=${ipResult.fraud_score}, tor=${ipResult.tor}, bot=${ipResult.bot_status}`);
      }
    }
    if (abuseKey) {
      const abuseResult = await checkAbuseIPDB(abuseKey, ip);
      if (abuseResult) {
        ipSignalChecked = true;
        if (abuseResult.abuseConfidenceScore > 75 || abuseResult.isTor) {
          clean = false;
          flags.push(`AbuseIPDB risk: score=${abuseResult.abuseConfidenceScore}, tor=${abuseResult.isTor}`);
        }
      }
    }
  }

  if (ipqsKey && email) {
    const emailResult = await checkEmailQuality(ipqsKey, email, supabase);
    if (emailResult) {
      if (!emailResult.valid || emailResult.disposable || emailResult.fraud_score >= 90) {
        clean = false;
        flags.push(`IPQS email risk: valid=${emailResult.valid}, disposable=${emailResult.disposable}, fraud_score=${emailResult.fraud_score}`);
      }
    }
  }

  return { clean, ipSignalChecked, flags };
}
