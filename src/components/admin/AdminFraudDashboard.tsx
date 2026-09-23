import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, ShieldAlert, ShieldX, ShieldCheck, Ban, Unlock, Eye, CheckCircle, AlertTriangle, Search, Plus, Trash2, ListChecks, ListX, Clock, TrendingUp, Filter, X, ChevronDown, ChevronRight, Activity, MessageSquare, ThumbsUp, ThumbsDown, RefreshCw, Gauge, Loader2 } from "lucide-react";
import AgeversLoader from "@/components/AgeversLoader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, format } from "date-fns";

interface FraudScore {
  id: string;
  user_id: string;
  risk_score: number;
  risk_level: string;
  is_blocked: boolean;
  total_flags: number;
  total_purchases: number;
  total_chargebacks: number;
  notes: string | null;
  last_purchase_at: string | null;
  updated_at: string;
  ipqs_score: number | null;
  new_account_limit_exempt?: boolean | null;
  new_account_limit_cap?: number | null;
}

interface FraudFlag {
  id: string;
  user_id: string;
  flag_type: string;
  severity: string;
  description: string;
  metadata: any;
  resolved: boolean;
  resolution_note: string | null;
  created_at: string;
}

interface FraudListEntry {
  id: string;
  list_type: 'whitelist' | 'blacklist';
  entry_type: 'email' | 'ip';
  value: string;
  reason: string | null;
  created_at: string;
}

const AdminFraudDashboard = () => {
  const [scores, setScores] = useState<FraudScore[]>([]);
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [attemptsByUser, setAttemptsByUser] = useState<Record<string, { count: number; lastAmount: number | null; lastTitles: string[]; lastAt: string | null }>>({});
  const [paidByUser, setPaidByUser] = useState<Record<string, number>>({});
  // Payment-stage evidence: did the user actually reach the PayPal payment step?
  const [payEventsByUser, setPayEventsByUser] = useState<Record<string, { at: string; status: string; hasPaypalId: boolean }[]>>({});
  const [paidOrderTimesByUser, setPaidOrderTimesByUser] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userFlags, setUserFlags] = useState<FraudFlag[]>([]);
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});
  const [userAuthEmails, setUserAuthEmails] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'overview' | 'flags' | 'blocked' | 'whitelist' | 'blacklist' | 'appeals'>('overview');
  const [appeals, setAppeals] = useState<any[]>([]);
  const [appealComment, setAppealComment] = useState<Record<string, string>>({});
  const [appealActioning, setAppealActioning] = useState<string | null>(null);
  const [ipqsCredits, setIpqsCredits] = useState<{ credits: number; usage: number } | null>(null);
  const [ipqsLoading, setIpqsLoading] = useState(false);
  const [pcCredits, setPcCredits] = useState<{ credits: number; usage: number; daily_limit: number } | null>(null);
  const [pcLoading, setPcLoading] = useState(false);
  const [protections, setProtections] = useState<{ ipqs_enabled: boolean; proxycheck_enabled: boolean; abuseipdb_enabled: boolean } | null>(null);
  const [protSaving, setProtSaving] = useState<string | null>(null);

  const fetchProtections = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('ipqs_enabled, proxycheck_enabled, abuseipdb_enabled')
      .eq('id', 1)
      .maybeSingle();
    if (data) setProtections(data as any);
  };

  const toggleProtection = async (key: 'ipqs_enabled' | 'proxycheck_enabled' | 'abuseipdb_enabled', label: string) => {
    if (!protections) return;
    const next = !protections[key];
    setProtSaving(key);
    const prev = protections;
    setProtections({ ...protections, [key]: next });
    const { error } = await supabase.from('site_settings').update({ [key]: next } as any).eq('id', 1);
    setProtSaving(null);
    if (error) {
      setProtections(prev);
      toast.error(`Failed to update ${label}`);
    } else {
      toast.success(`${label} ${next ? 'enabled' : 'disabled'}`);
    }
  };

  const fetchIpqsCredits = async () => {
    setIpqsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ipqs-credits');
      if (error) throw error;
      if (data && typeof data.credits === 'number') {
        setIpqsCredits({ credits: data.credits, usage: data.usage ?? 0 });
      }
    } catch (err) {
      console.error('Failed to fetch IPQS credits:', err);
    } finally {
      setIpqsLoading(false);
    }
  };

  const fetchProxyCheckCredits = async () => {
    setPcLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('proxycheck-credits');
      if (error) throw error;
      if (data && typeof data.credits === 'number') {
        setPcCredits({ credits: data.credits, usage: data.usage ?? 0, daily_limit: data.daily_limit ?? 0 });
      }
    } catch (err) {
      console.error('Failed to fetch ProxyCheck credits:', err);
    } finally {
      setPcLoading(false);
    }
  };

  useEffect(() => { fetchIpqsCredits(); fetchProxyCheckCredits(); fetchProtections(); }, []);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [expandedFlags, setExpandedFlags] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'risk' | 'attempts'>('date');
  const [riskLevelFilter, setRiskLevelFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'blocked' | 'active'>('all');
  const [chargebackFilter, setChargebackFilter] = useState<boolean>(false);
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  // Whitelist/Blacklist state
  const [listEntries, setListEntries] = useState<FraudListEntry[]>([]);
  const [newEntryType, setNewEntryType] = useState<'email' | 'ip'>('email');
  const [newEntryValue, setNewEntryValue] = useState("");
  const [newEntryReason, setNewEntryReason] = useState("");
  const [addingEntry, setAddingEntry] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (tab === 'whitelist' || tab === 'blacklist') {
      fetchListEntries(tab);
    }
    if (tab === 'appeals') {
      fetchAppeals();
    }
  }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    const [scoresRes, flagsRes] = await Promise.all([
      supabase.from('fraud_scores' as any).select('*').order('risk_score', { ascending: false }),
      supabase.from('fraud_flags' as any).select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    const scoresData = (scoresRes.data || []) as unknown as FraudScore[];
    const flagsData = (flagsRes.data || []) as unknown as FraudFlag[];
    setScores(scoresData);
    setFlags(flagsData);

    // Build per-user purchase attempts (one attempt = one unique created_at-minute that has total_amount in metadata)
    const scoredUserIds = [...new Set([
      ...scoresData.map(s => s.user_id),
      ...flagsData.map(f => f.user_id),
    ].filter(Boolean))];
    if (scoredUserIds.length > 0) {
      const { data: allUserFlags } = await supabase
        .from('fraud_flags' as any)
        .select('user_id, created_at, metadata')
        .in('user_id', scoredUserIds)
        .order('created_at', { ascending: false })
        .limit(2000);
      const map: Record<string, { attempts: Map<string, { amount: number | null; titles: string[]; at: string }> }> = {};
      ((allUserFlags || []) as any[]).forEach((f) => {
        const meta = (f.metadata || {}) as any;
        if (meta.total_amount == null) return;
        const minuteKey = f.created_at.slice(0, 16); // group by minute
        if (!map[f.user_id]) map[f.user_id] = { attempts: new Map() };
        if (!map[f.user_id].attempts.has(minuteKey)) {
          const titles = Array.isArray(meta.items_titles)
            ? meta.items_titles.map((t: any) => t?.quantity > 1 ? `${t.quantity}× ${t.title}` : t.title).filter(Boolean)
            : [];
          map[f.user_id].attempts.set(minuteKey, { amount: meta.total_amount, titles, at: f.created_at });
        }
      });
      const result: Record<string, { count: number; lastAmount: number | null; lastTitles: string[]; lastAt: string | null }> = {};
      Object.entries(map).forEach(([uid, v]) => {
        const sorted = [...v.attempts.values()].sort((a, b) => b.at.localeCompare(a.at));
        const last = sorted[0];
        result[uid] = { count: v.attempts.size, lastAmount: last?.amount ?? null, lastTitles: last?.titles || [], lastAt: last?.at ?? null };
      });
      setAttemptsByUser(result);
    }

    // Count REAL paid orders per user (money actually received)
    if (scoredUserIds.length > 0) {
      const { data: paidOrders } = await supabase
        .from('orders')
        .select('user_id, status, created_at')
        .in('user_id', scoredUserIds)
        .in('status', ['completed', 'paid', 'delivered']);
      const paidMap: Record<string, number> = {};
      const paidTimes: Record<string, string[]> = {};
      ((paidOrders || []) as any[]).forEach((o) => {
        paidMap[o.user_id] = (paidMap[o.user_id] || 0) + 1;
        (paidTimes[o.user_id] ||= []).push(o.created_at);
      });
      setPaidByUser(paidMap);
      setPaidOrderTimesByUser(paidTimes);

      // PayPal checkout sessions = proof the buyer reached the payment step
      const { data: pending } = await supabase
        .from('pending_paypal_orders' as any)
        .select('user_id, status, created_at, paypal_order_id')
        .in('user_id', scoredUserIds)
        .order('created_at', { ascending: false })
        .limit(2000);
      const payMap: Record<string, { at: string; status: string; hasPaypalId: boolean }[]> = {};
      ((pending || []) as any[]).forEach((p) => {
        if (!p.user_id) return;
        (payMap[p.user_id] ||= []).push({
          at: p.created_at,
          status: p.status,
          hasPaypalId: !!p.paypal_order_id,
        });
      });
      setPayEventsByUser(payMap);
    }

    const userIds = [...new Set([
      ...scoresData.map(s => s.user_id),
      ...flagsData.map(f => f.user_id),
    ])];

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name')
        .in('user_id', userIds);

      const emailMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        emailMap[p.user_id] = p.username || p.display_name || p.user_id.slice(0, 8);
      });
      setUserEmails(emailMap);
    }

    // Fetch real auth emails for these users via admin-users edge function
    try {
      const { data: adminData } = await supabase.functions.invoke('admin-users', {
        body: { action: 'list_users' },
      });
      const list = (adminData as any)?.users || [];
      const emailsMap: Record<string, string> = {};
      list.forEach((u: any) => {
        if (u?.id && u?.email) emailsMap[u.id] = u.email;
      });
      setUserAuthEmails(emailsMap);
    } catch (e) {
      console.warn('admin-users fetch failed', e);
    }

    setLoading(false);
  };

  const fetchListEntries = async (listType: 'whitelist' | 'blacklist') => {
    const { data } = await supabase
      .from('fraud_lists' as any)
      .select('*')
      .eq('list_type', listType)
      .order('created_at', { ascending: false });
    setListEntries((data || []) as unknown as FraudListEntry[]);
  };

  const fetchAppeals = async () => {
    const { data } = await supabase
      .from('account_appeals' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setAppeals((data || []) as any[]);
  };

  const handleAppealAction = async (appealId: string, action: 'approve' | 'deny') => {
    setAppealActioning(appealId);
    const { data, error } = await supabase.functions.invoke('manage-appeal', {
      body: { appeal_id: appealId, action, admin_comment: appealComment[appealId] || null },
    });
    setAppealActioning(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Action failed');
      return;
    }
    toast.success(`Appeal ${action === 'approve' ? 'approved & user unblocked' : 'denied'}`);
    setAppealComment((c) => ({ ...c, [appealId]: '' }));
    fetchAppeals();
    fetchData();
  };

  const addListEntry = async () => {
    if (!newEntryValue.trim()) {
      toast.error("Please enter a value");
      return;
    }
    const listType = tab as 'whitelist' | 'blacklist';
    setAddingEntry(true);
    const { error } = await supabase.from('fraud_lists' as any).insert({
      list_type: listType,
      entry_type: newEntryType,
      value: newEntryValue.trim().toLowerCase(),
      reason: newEntryReason.trim() || null,
    } as any);
    setAddingEntry(false);
    if (error) {
      toast.error(error.message.includes('duplicate') ? "Entry already exists" : "Failed to add entry");
      return;
    }
    toast.success(`Added to ${listType}`);
    setNewEntryValue("");
    setNewEntryReason("");
    fetchListEntries(listType);
  };

  const removeListEntry = async (id: string) => {
    const { error } = await supabase.from('fraud_lists' as any).delete().eq('id', id);
    if (error) {
      toast.error("Failed to remove");
      return;
    }
    toast.success("Entry removed");
    setListEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleBlockUser = async (userId: string, reason?: string) => {
    const note = reason || prompt("Block reason:");
    if (!note) return;

    const { error } = await supabase.functions.invoke('fraud-check', {
      body: { action: 'block_user', target_user_id: userId, reason: note },
    });

    if (error) {
      toast.error("Failed to block user");
    } else {
      toast.success("User blocked successfully");
      fetchData();
    }
  };

  const handleUnblockUser = async (userId: string) => {
    if (!confirm("Are you sure you want to unblock this user?")) return;

    const { error } = await supabase.functions.invoke('fraud-check', {
      body: { action: 'unblock_user', target_user_id: userId, reason: 'Unblocked by admin' },
    });

    if (error) {
      toast.error("Failed to unblock user");
    } else {
      toast.success("User unblocked");
      setScores(prev => prev.map(s => s.user_id === userId
        ? { ...s, is_blocked: false, risk_level: 'medium', notes: 'Unblocked by admin' }
        : s));
    }
  };

  const handleToggleNewAccountLimit = async (userId: string, currentlyExempt: boolean, currentCap?: number | null) => {
    const exempt = !currentlyExempt;
    const cap = currentCap ?? 20;
    const msg = exempt
      ? `Remove the €${cap}/24h new-account purchase limit for this user?`
      : `Re-enable the €${cap}/24h new-account purchase limit for this user?`;
    if (!confirm(msg)) return;

    const { error } = await supabase.functions.invoke('fraud-check', {
      body: { action: 'set_new_account_exempt', target_user_id: userId, exempt },
    });

    if (error) {
      toast.error("Failed to update new-account limit");
    } else {
      toast.success(exempt ? "24h limit removed for user" : "24h limit re-enabled for user");
      setScores(prev => prev.map(s => s.user_id === userId ? { ...s, new_account_limit_exempt: exempt } : s));
    }
  };

  const handleResolveFlag = async (flagId: string) => {
    const note = prompt("Resolution note:");
    const { error } = await supabase.functions.invoke('fraud-check', {
      body: { action: 'resolve_flag', flag_id: flagId, resolution_note: note || 'Resolved' },
    });

    if (error) {
      toast.error("Failed to resolve flag");
    } else {
      toast.success("Flag resolved");
      setFlags(prev => prev.map(f => f.id === flagId ? { ...f, resolved: true, resolution_note: note || 'Resolved' } : f));
      setUserFlags(prev => prev.map(f => f.id === flagId ? { ...f, resolved: true, resolution_note: note || 'Resolved' } : f));
    }
  };

  const handleDeleteFlag = async (flagId: string) => {
    if (!confirm("Delete this flag permanently?")) return;
    const { error } = await supabase.functions.invoke('fraud-check', {
      body: { action: 'delete_flag', flag_id: flagId },
    });
    if (error) {
      toast.error("Failed to delete flag");
    } else {
      toast.success("Flag deleted");
      setFlags(prev => prev.filter(f => f.id !== flagId));
      setUserFlags(prev => prev.filter(f => f.id !== flagId));
    }
  };

  const viewUserFlags = async (userId: string) => {
    setSelectedUserId(userId);
    const { data } = await supabase
      .from('fraud_flags' as any)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setUserFlags((data || []) as unknown as FraudFlag[]);
  };

  const getRiskBadge = (level: string) => {
    const config: Record<string, { bg: string; text: string; icon: typeof Shield }> = {
      low: { bg: 'bg-green-500/20', text: 'text-green-400', icon: ShieldCheck },
      medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Shield },
      high: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: ShieldAlert },
      critical: { bg: 'bg-red-500/20', text: 'text-red-400', icon: ShieldX },
    };
    const c = config[level] || config.low;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.bg} ${c.text}`}>
        <Icon className="h-3 w-3" /> {level}
      </span>
    );
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  const getTimeGroup = (dateStr: string): string => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    if (isThisWeek(d)) return 'This Week';
    const now = new Date();
    const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 30) return 'This Month';
    return 'Older';
  };

  const groupByTime = <T extends { created_at: string }>(items: T[]): Record<string, T[]> => {
    const groups: Record<string, T[]> = {};
    items.forEach(item => {
      const g = getTimeGroup(item.created_at);
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    });
    return groups;
  };

  const toggleFlagExpanded = (id: string) => {
    setExpandedFlags(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const matchesTimeFilter = (dateStr: string): boolean => {
    if (timeFilter === 'all') return true;
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (timeFilter === 'today') return isToday(d);
    if (timeFilter === 'week') return diffDays <= 7;
    if (timeFilter === 'month') return diffDays <= 30;
    return true;
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 60) return 'bg-orange-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Was this flagged attempt a real payment attempt, or abandoned before payment?
  const CHECKOUT_WINDOW_MS = 45 * 60 * 1000;
  const getCheckoutStage = (flag: FraudFlag): { label: string; className: string; title: string } | null => {
    const t = new Date(flag.created_at).getTime();
    const inWindow = (iso: string) => {
      const d = new Date(iso).getTime();
      return d >= t - CHECKOUT_WINDOW_MS && d <= t + CHECKOUT_WINDOW_MS;
    };

    if ((paidOrderTimesByUser[flag.user_id] || []).some(inWindow)) {
      return { label: 'Paid', className: 'text-green-400 border-green-500/40 bg-green-500/10', title: 'A paid order exists around this attempt' };
    }
    const events = (payEventsByUser[flag.user_id] || []).filter(e => inWindow(e.at));
    if (events.length > 0) {
      const ev = events[0];
      if (ev.status === 'fulfilled') {
        return { label: 'Paid', className: 'text-green-400 border-green-500/40 bg-green-500/10', title: 'PayPal order fulfilled' };
      }
      if (ev.status === 'failed') {
        return { label: 'Payment failed', className: 'text-orange-400 border-orange-500/40 bg-orange-500/10', title: 'Reached PayPal but payment failed' };
      }
      return {
        label: 'Reached payment',
        className: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
        title: `PayPal checkout session created (status: ${ev.status})${ev.hasPaypalId ? '' : ' — no PayPal order id'} — not completed`,
      };
    }
    return {
      label: 'Abandoned before payment',
      className: 'text-muted-foreground border-border bg-secondary/40',
      title: 'No PayPal checkout session was created around this attempt',
    };
  };

  const blockedUsers = scores.filter(s => s.is_blocked);
  const highRiskUsers = scores.filter(s => s.risk_level === 'high' || s.risk_level === 'critical');
  const unresolvedFlags = flags.filter(f => !f.resolved);
  const flagsLast24h = flags.filter(f => {
    const diff = (Date.now() - new Date(f.created_at).getTime()) / (1000 * 60 * 60);
    return diff <= 24;
  });

  // Filtered flags for the flags tab
  const visibleFlags = flags.filter(f => {
    if (!showResolved && f.resolved) return false;
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    if (!matchesTimeFilter(f.created_at)) return false;
    if (searchQuery) {
      const email = userEmails[f.user_id] || '';
      const q = searchQuery.toLowerCase();
      if (
        !email.toLowerCase().includes(q) &&
        !f.user_id.includes(searchQuery) &&
        !f.flag_type.toLowerCase().includes(q) &&
        !(f.description || '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const scoreDate = (s: FraudScore): number => {
    const a = s.last_purchase_at ? new Date(s.last_purchase_at).getTime() : 0;
    const b = s.updated_at ? new Date(s.updated_at).getTime() : 0;
    const c = attemptsByUser[s.user_id]?.lastAt ? new Date(attemptsByUser[s.user_id]!.lastAt as string).getTime() : 0;
    return Math.max(a, b, c);
  };

  const filteredScores = scores
    .filter(s => {
      if (riskLevelFilter !== 'all' && s.risk_level !== riskLevelFilter) return false;
      if (statusFilter === 'blocked' && !s.is_blocked) return false;
      if (statusFilter === 'active' && s.is_blocked) return false;
      if (chargebackFilter && (s.total_chargebacks ?? 0) <= 0) return false;
      const paidCount = paidByUser[s.user_id] ?? 0;
      if (paidFilter === 'paid' && paidCount <= 0) return false;
      if (paidFilter === 'unpaid' && paidCount > 0) return false;
      if (timeFilter !== 'all') {
        const ts = scoreDate(s);
        if (!ts || !matchesTimeFilter(new Date(ts).toISOString())) return false;
      }
      if (!searchQuery) return true;
      const email = (userEmails[s.user_id] || '').toLowerCase();
      const authEmail = (userAuthEmails[s.user_id] || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      return email.includes(q) || authEmail.includes(q) || s.user_id.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'risk') return b.risk_score - a.risk_score;
      if (sortBy === 'attempts') {
        return (attemptsByUser[b.user_id]?.count ?? b.total_purchases) - (attemptsByUser[a.user_id]?.count ?? a.total_purchases);
      }
      return scoreDate(b) - scoreDate(a);
    });

  const visibleBlocked = blockedUsers
    .filter(s => {
      if (riskLevelFilter !== 'all' && s.risk_level !== riskLevelFilter) return false;
      if (chargebackFilter && (s.total_chargebacks ?? 0) <= 0) return false;
      const paidCount = paidByUser[s.user_id] ?? 0;
      if (paidFilter === 'paid' && paidCount <= 0) return false;
      if (paidFilter === 'unpaid' && paidCount > 0) return false;
      if (timeFilter !== 'all') {
        const ts = scoreDate(s);
        if (!ts || !matchesTimeFilter(new Date(ts).toISOString())) return false;
      }
      if (!searchQuery) return true;
      const email = (userEmails[s.user_id] || '').toLowerCase();
      const authEmail = (userAuthEmails[s.user_id] || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      return email.includes(q) || authEmail.includes(q) || s.user_id.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'risk') return b.risk_score - a.risk_score;
      if (sortBy === 'attempts') {
        return (attemptsByUser[b.user_id]?.count ?? b.total_purchases) - (attemptsByUser[a.user_id]?.count ?? a.total_purchases);
      }
      return scoreDate(b) - scoreDate(a);
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <AgeversLoader />
      </div>
    );
  }

  const renderListTab = () => {
    const listType = tab as 'whitelist' | 'blacklist';
    const isWhitelist = listType === 'whitelist';
    const icon = isWhitelist ? <ListChecks className="h-4 w-4 text-green-400" /> : <ListX className="h-4 w-4 text-red-400" />;
    const accentColor = isWhitelist ? 'green' : 'red';

    return (
      <div className="space-y-4">
        {/* Add entry form */}
        <div className={`glass rounded-xl p-4 border border-${accentColor}-500/30`}>
          <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2 mb-3">
            {icon} Add to {isWhitelist ? 'Whitelist' : 'Blacklist'}
          </h3>
          <div className="flex gap-2 flex-wrap">
            <Select value={newEntryType} onValueChange={(v: 'email' | 'ip') => setNewEntryType(v)}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="ip">IP</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={newEntryType === 'email' ? 'user@example.com' : '192.168.1.1'}
              value={newEntryValue}
              onChange={(e) => setNewEntryValue(e.target.value)}
              className="flex-1 h-8 text-xs min-w-[200px]"
            />
            <Input
              placeholder="Reason (optional)"
              value={newEntryReason}
              onChange={(e) => setNewEntryReason(e.target.value)}
              className="flex-1 h-8 text-xs min-w-[150px]"
            />
            <Button
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={addListEntry}
              disabled={addingEntry}
            >
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </div>
        </div>

        {/* Entries list */}
        <div className="space-y-1">
          {listEntries.length === 0 ? (
            <div className="text-center py-10 glass rounded-xl">
              {icon}
              <p className="text-muted-foreground text-sm font-display mt-2">
                No {listType} entries yet
              </p>
            </div>
          ) : listEntries.map(entry => (
            <div key={entry.id} className={`glass rounded-lg p-3 flex items-center justify-between border-l-2 border-${accentColor}-500/50`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-${accentColor}-500/20 text-${accentColor}-400`}>
                  {entry.entry_type}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground font-mono">{entry.value}</p>
                  {entry.reason && (
                    <p className="text-[10px] text-muted-foreground truncate">{entry.reason}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(entry.created_at).toLocaleDateString()}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeListEntry(entry.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Provider credits chips */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
          <Gauge className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">IPQS Credits Left:</span>
          {ipqsLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : ipqsCredits ? (
            <span className={`text-sm font-bold ${ipqsCredits.credits < 100 ? 'text-destructive' : ipqsCredits.credits < 300 ? 'text-yellow-500' : 'text-green-500'}`}>
              {ipqsCredits.credits.toLocaleString()}
              {ipqsCredits.usage > 0 && (
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                  (used {ipqsCredits.usage.toLocaleString()})
                </span>
              )}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">N/A</span>
          )}
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={fetchIpqsCredits} disabled={ipqsLoading}>
            <RefreshCw className={`h-3 w-3 ${ipqsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
          <Gauge className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">ProxyCheck Left Today:</span>
          {pcLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : pcCredits ? (
            <span className={`text-sm font-bold ${pcCredits.credits < 50 ? 'text-destructive' : pcCredits.credits < 200 ? 'text-yellow-500' : 'text-green-500'}`}>
              {pcCredits.credits.toLocaleString()}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                (used {pcCredits.usage.toLocaleString()}{pcCredits.daily_limit ? ` / ${pcCredits.daily_limit.toLocaleString()}` : ''})
              </span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">N/A</span>
          )}
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={fetchProxyCheckCredits} disabled={pcLoading}>
            <RefreshCw className={`h-3 w-3 ${pcLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Protection layers */}
      <div className="glass rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-3">Protection Layers</p>
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'ipqs_enabled', label: 'IPQS' },
            { key: 'proxycheck_enabled', label: 'ProxyCheck.io' },
            { key: 'abuseipdb_enabled', label: 'AbuseIPDB' },
          ] as const).map(({ key, label }) => {
            const on = protections ? protections[key] : true;
            return (
              <Button
                key={key}
                size="sm"
                variant="outline"
                disabled={!protections || protSaving === key}
                onClick={() => toggleProtection(key, label)}
                className={`gap-2 text-xs font-display ${on ? 'border-green-500/40 text-green-400' : 'border-destructive/40 text-destructive'}`}
              >
                {protSaving === key ? <Loader2 className="h-3 w-3 animate-spin" /> : on ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
                {label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${on ? 'bg-green-500/15' : 'bg-destructive/15'}`}>{on ? 'ON' : 'OFF'}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="glass rounded-xl p-4 text-center hover:border-red-500/40 border border-transparent transition-colors cursor-pointer" onClick={() => setTab('blocked')}>
          <ShieldX className="h-6 w-6 text-red-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">{blockedUsers.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Blocked Users</p>
        </div>
        <div className="glass rounded-xl p-4 text-center hover:border-orange-500/40 border border-transparent transition-colors cursor-pointer" onClick={() => setTab('overview')}>
          <ShieldAlert className="h-6 w-6 text-orange-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">{highRiskUsers.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">High Risk</p>
        </div>
        <div className="glass rounded-xl p-4 text-center hover:border-yellow-500/40 border border-transparent transition-colors cursor-pointer" onClick={() => setTab('flags')}>
          <AlertTriangle className="h-6 w-6 text-yellow-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">{unresolvedFlags.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Unresolved Flags</p>
        </div>
        <div className="glass rounded-xl p-4 text-center hover:border-cyan-500/40 border border-transparent transition-colors cursor-pointer" onClick={() => { setTab('flags'); setTimeFilter('today'); }}>
          <Activity className="h-6 w-6 text-cyan-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">{flagsLast24h.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Flags · Last 24h</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <Shield className="h-6 w-6 text-primary mx-auto mb-1" />
          <p className="text-2xl font-black text-foreground">{scores.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tracked Users</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['overview', 'flags', 'blocked', 'appeals', 'whitelist', 'blacklist'] as const).map(t => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? 'default' : 'outline'}
            onClick={() => { setTab(t); setSelectedUserId(null); }}
            className="font-display text-xs tracking-wider gap-1"
          >
            {t === 'overview' ? 'All Users' : 
             t === 'flags' ? `Flags (${unresolvedFlags.length})` : 
             t === 'blocked' ? `Blocked (${blockedUsers.length})` :
             t === 'appeals' ? <><MessageSquare className="h-3 w-3" /> Appeals ({appeals.filter((a: any) => a.status === 'pending').length})</> :
             t === 'whitelist' ? <><ListChecks className="h-3 w-3" /> Whitelist</> :
             <><ListX className="h-3 w-3" /> Blacklist</>}
          </Button>
        ))}
      </div>

      {/* Whitelist/Blacklist tabs */}
      {tab === 'appeals' ? (
        <div className="space-y-3">
          {appeals.length === 0 ? (
            <p className="text-muted-foreground text-sm font-display text-center py-8">No appeals submitted yet</p>
          ) : (
            appeals.map((a: any) => (
              <div key={a.id} className="glass rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-display text-sm font-bold">{a.user_email || a.user_id}</p>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(a.created_at), 'PPp')}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider uppercase ${
                    a.status === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                    a.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                    'bg-destructive/20 text-destructive'
                  }`}>{a.status}</span>
                </div>
                {a.blocked_reason && (
                  <p className="text-[11px] text-muted-foreground"><strong>Blocked reason:</strong> {a.blocked_reason}</p>
                )}
                <p className="text-xs bg-secondary/40 rounded p-2 whitespace-pre-line">{a.buyer_message}</p>
                {a.admin_comment && (
                  <p className="text-[11px] italic text-muted-foreground">Admin note: "{a.admin_comment}"</p>
                )}
                {a.status === 'pending' && (
                  <div className="space-y-2 pt-1">
                    <Input
                      placeholder="Optional note for the buyer..."
                      value={appealComment[a.id] || ''}
                      onChange={(e) => setAppealComment((c) => ({ ...c, [a.id]: e.target.value }))}
                      className="text-xs h-8"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" disabled={appealActioning === a.id} onClick={() => handleAppealAction(a.id, 'deny')} className="gap-1 text-destructive">
                        <ThumbsDown className="h-3 w-3" /> Deny
                      </Button>
                      <Button size="sm" disabled={appealActioning === a.id} onClick={() => handleAppealAction(a.id, 'approve')} className="gap-1">
                        <ThumbsUp className="h-3 w-3" /> Approve & Unblock
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (tab === 'whitelist' || tab === 'blacklist') ? renderListTab() : (
        <>
          {/* Search + Filters */}
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tab === 'flags' ? "Search by user, flag type or description..." : "Search by username or user ID..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary/50 border-border/50 font-display text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {tab === 'flags' && (
              <>
                <Select value={severityFilter} onValueChange={(v: any) => setSeverityFilter(v)}>
                  <SelectTrigger className="w-full md:w-36 h-9 text-xs">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
                  <SelectTrigger className="w-full md:w-36 h-9 text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant={showResolved ? 'default' : 'outline'}
                  onClick={() => setShowResolved(!showResolved)}
                  className="h-9 text-xs gap-1"
                >
                  <CheckCircle className="h-3 w-3" />
                  {showResolved ? 'Hide' : 'Show'} Resolved
                </Button>
              </>
            )}
            {(tab === 'overview' || tab === 'blocked') && (
              <>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-full md:w-40 h-9 text-xs">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Sort: Newest first</SelectItem>
                    <SelectItem value="risk">Sort: Highest risk</SelectItem>
                    <SelectItem value="attempts">Sort: Most attempts</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={riskLevelFilter} onValueChange={(v: any) => setRiskLevelFilter(v)}>
                  <SelectTrigger className="w-full md:w-36 h-9 text-xs">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Risk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk Levels</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                {tab === 'overview' && (
                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className="w-full md:w-36 h-9 text-xs">
                      <Filter className="h-3 w-3 mr-1" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="blocked">Blocked Only</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Select value={paidFilter} onValueChange={(v: any) => setPaidFilter(v)}>
                  <SelectTrigger className="w-full md:w-36 h-9 text-xs">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Paid" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Payments</SelectItem>
                    <SelectItem value="paid">Has Paid Orders</SelectItem>
                    <SelectItem value="unpaid">No Paid Orders</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant={chargebackFilter ? 'default' : 'outline'}
                  onClick={() => setChargebackFilter(!chargebackFilter)}
                  className="h-9 text-xs gap-1"
                  title="Show only users with chargebacks"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Chargebacks
                </Button>
                <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
                  <SelectTrigger className="w-full md:w-36 h-9 text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
                {(riskLevelFilter !== 'all' || statusFilter !== 'all' || paidFilter !== 'all' || chargebackFilter || timeFilter !== 'all' || searchQuery) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setRiskLevelFilter('all'); setStatusFilter('all'); setPaidFilter('all'); setChargebackFilter(false); setTimeFilter('all'); setSearchQuery(''); }}
                    className="h-9 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" /> Clear
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Main Table */}
          {tab === 'flags' ? (
            <div className="space-y-4">
              <div className="text-[10px] text-muted-foreground font-display uppercase tracking-wider flex items-center justify-between">
                <span>Showing {visibleFlags.length} of {flags.length} flags</span>
                {(severityFilter !== 'all' || timeFilter !== 'all' || searchQuery || showResolved) && (
                  <button
                    onClick={() => { setSeverityFilter('all'); setTimeFilter('all'); setSearchQuery(''); setShowResolved(false); }}
                    className="text-primary hover:text-primary/80 normal-case tracking-normal"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              {visibleFlags.length === 0 ? (
                <div className="text-center py-10 glass rounded-xl">
                  <ShieldCheck className="h-10 w-10 text-green-400 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm font-display">No flags match these filters</p>
                </div>
              ) : (
                Object.entries(groupByTime(visibleFlags)).map(([groupName, groupFlags]) => (
                  <div key={groupName} className="space-y-2">
                    <div className="flex items-center gap-2 sticky top-0 z-10 py-1">
                      <Clock className="h-3 w-3 text-primary" />
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary">{groupName}</h4>
                      <span className="text-[10px] text-muted-foreground">({groupFlags.length})</span>
                      <div className="flex-1 h-px bg-border/50" />
                    </div>
                    {groupFlags.map(flag => {
                      const expanded = expandedFlags.has(flag.id);
                      const hasMetadata = flag.metadata && Object.keys(flag.metadata).length > 0;
                      const stage = getCheckoutStage(flag);
                      return (
                        <div key={flag.id} className={`glass rounded-lg overflow-hidden border-l-2 ${
                          flag.resolved ? 'border-l-green-500/50 opacity-70' :
                          flag.severity === 'critical' ? 'border-l-red-500' :
                          flag.severity === 'high' ? 'border-l-orange-500' :
                          flag.severity === 'medium' ? 'border-l-yellow-500' :
                          'border-l-green-500'
                        }`}>
                          <div className="p-3 flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <button
                                onClick={() => hasMetadata && toggleFlagExpanded(flag.id)}
                                className={`mt-0.5 ${hasMetadata ? 'text-muted-foreground hover:text-foreground' : 'invisible'}`}
                                aria-label="Expand"
                              >
                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {getRiskBadge(flag.severity)}
                                  <span className="text-[10px] font-mono uppercase text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">{flag.flag_type}</span>
                                  {stage && (
                                    <span
                                      title={stage.title}
                                      className={`text-[10px] font-display font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${stage.className}`}
                                    >
                                      {stage.label}
                                    </span>
                                  )}
                                  {flag.resolved && (
                                    <span className="text-[10px] text-green-400 inline-flex items-center gap-1">
                                      <CheckCircle className="h-3 w-3" /> Resolved
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-foreground">{flag.description}</p>
                                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-foreground/70">{userEmails[flag.user_id] || flag.user_id.slice(0, 8)}</span>
                                  <span>•</span>
                                  <span title={new Date(flag.created_at).toLocaleString()}>
                                    <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                                    {getRelativeTime(flag.created_at)}
                                  </span>
                                  <span className="opacity-60">({format(new Date(flag.created_at), 'MMM d, HH:mm')})</span>
                                </p>
                                {flag.resolved && flag.resolution_note && (
                                  <p className="text-[10px] text-green-400 mt-1 italic">
                                    Resolution: {flag.resolution_note}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => viewUserFlags(flag.user_id)} title="View user flags">
                                <Eye className="h-3 w-3" />
                              </Button>
                              {!flag.resolved && (
                                <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-green-400 border-green-500/30" onClick={() => handleResolveFlag(flag.id)} title="Resolve">
                                  <CheckCircle className="h-3 w-3" />
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-destructive border-destructive/30" onClick={() => handleDeleteFlag(flag.id)} title="Delete flag">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {expanded && hasMetadata && (
                            <div className="border-t border-border/30 bg-secondary/20 p-3">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-bold">Metadata</p>
                              <pre className="text-[10px] text-foreground/80 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                                {JSON.stringify(flag.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground font-display uppercase tracking-wider">
                Showing {(tab === 'blocked' ? visibleBlocked : filteredScores).length} {tab === 'blocked' ? 'blocked users' : 'tracked users'} · sorted by {sortBy === 'date' ? 'newest activity' : sortBy === 'risk' ? 'highest risk' : 'most attempts'}
              </p>
              {(tab === 'blocked' ? visibleBlocked : filteredScores).map(score => (
                <div key={score.id} className={`glass rounded-lg overflow-hidden ${score.is_blocked ? 'border-l-2 border-l-red-500' : ''}`}>
                  <div className="p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getRiskBadge(score.risk_level)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => selectedUserId === score.user_id ? setSelectedUserId(null) : viewUserFlags(score.user_id)}
                          className="text-xs font-bold text-foreground truncate hover:text-primary transition-colors text-left inline-flex items-center gap-1"
                          title="Click to view flags"
                        >
                          {selectedUserId === score.user_id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {userEmails[score.user_id] || score.user_id.slice(0, 8)}
                        </button>
                        {score.is_blocked && (
                          <span className="inline-flex items-center gap-1 text-red-400 text-[10px] font-bold bg-red-500/10 px-1.5 py-0.5 rounded">
                            <Ban className="h-2.5 w-2.5" /> BLOCKED
                          </span>
                        )}
                        {score.total_chargebacks > 0 && (
                          <span className="text-red-400 text-[10px] font-bold bg-red-500/10 px-1.5 py-0.5 rounded">
                            ⚠ {score.total_chargebacks} chargeback{score.total_chargebacks > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {userAuthEmails[score.user_id] && (
                        <p className="text-[10px] text-muted-foreground/90 mt-0.5 truncate font-mono" title={userAuthEmails[score.user_id]}>
                          ✉ {userAuthEmails[score.user_id]}
                        </p>
                      )}
                      {/* Risk score bar */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 max-w-[140px] h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                          <div className={`h-full ${getRiskScoreColor(score.risk_score)} transition-all`} style={{ width: `${Math.min(100, score.risk_score)}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">{score.risk_score}/100</span>
                        {score.ipqs_score !== null && (
                          <span className="text-[10px] text-purple-400 font-mono">IPQS {score.ipqs_score}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <span><AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />{score.total_flags} flags</span>
                        <span>•</span>
                        <span title="Total checkout attempts (blocked + allowed)">
                          🛒 {(attemptsByUser[score.user_id]?.count ?? score.total_purchases)} attempts
                          {(paidByUser[score.user_id] ?? 0) > 0
                            ? ` (${paidByUser[score.user_id]} paid ✓)`
                            : ' (0 paid)'}
                        </span>
                        {score.last_purchase_at && (
                          <>
                            <span>•</span>
                            <span title={new Date(score.last_purchase_at).toLocaleString()}>
                              Last: {getRelativeTime(score.last_purchase_at)}
                            </span>
                          </>
                        )}
                      </p>
                      {attemptsByUser[score.user_id]?.lastTitles?.length > 0 && (
                        <p className="text-[10px] text-orange-300/80 mt-1 truncate" title={attemptsByUser[score.user_id].lastTitles.join(', ')}>
                          🎯 Tried to buy: {attemptsByUser[score.user_id].lastTitles.slice(0, 2).join(', ')}
                          {attemptsByUser[score.user_id].lastTitles.length > 2 && ` +${attemptsByUser[score.user_id].lastTitles.length - 2}`}
                          {attemptsByUser[score.user_id].lastAmount != null && ` · €${attemptsByUser[score.user_id].lastAmount.toFixed(2)}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => selectedUserId === score.user_id ? setSelectedUserId(null) : viewUserFlags(score.user_id)} title="View flags">
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-7 text-[10px] ${score.new_account_limit_exempt ? 'text-amber-400 border-amber-500/30' : 'text-blue-400 border-blue-500/30'}`}
                      onClick={() => handleToggleNewAccountLimit(score.user_id, !!score.new_account_limit_exempt, score.new_account_limit_cap)}
                      title={score.new_account_limit_exempt ? `Re-enable €${score.new_account_limit_cap ?? 20}/24h new-account limit` : `Remove €${score.new_account_limit_cap ?? 20}/24h new-account limit for this user`}
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      {score.new_account_limit_exempt ? '24h Limit Off' : 'Remove 24h Limit'}
                    </Button>
                    {score.is_blocked ? (
                      <Button size="sm" variant="outline" className="h-7 text-[10px] text-green-400 border-green-500/30" onClick={() => handleUnblockUser(score.user_id)}>
                        <Unlock className="h-3 w-3 mr-1" /> Unblock
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-[10px] text-red-400 border-red-500/30" onClick={() => handleBlockUser(score.user_id)}>
                        <Ban className="h-3 w-3 mr-1" /> Block
                      </Button>
                    )}
                  </div>
                  </div>
                  {selectedUserId === score.user_id && (
                    <div className="border-t border-primary/30 bg-secondary/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-display font-bold text-xs text-foreground">
                          Flags for {userEmails[score.user_id] || score.user_id.slice(0, 8)}
                        </h4>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedUserId(null)} className="h-6 text-[10px]">Close</Button>
                      </div>
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {userFlags.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-3">No flags</p>
                        ) : userFlags.map(flag => (
                          <div key={flag.id} className={`p-2.5 rounded-lg text-xs space-y-1 ${flag.resolved ? 'bg-green-500/5 border border-green-500/20' : 'bg-red-500/5 border border-red-500/20'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getRiskBadge(flag.severity)}
                                <span className="text-muted-foreground text-[10px] font-mono uppercase">{flag.flag_type}</span>
                              </div>
                              <span className="text-muted-foreground text-[10px] shrink-0" title={new Date(flag.created_at).toLocaleString()}>{getRelativeTime(flag.created_at)}</span>
                            </div>
                            <p className="text-foreground text-[11px]">{flag.description}</p>
                            {flag.metadata?.items_titles && Array.isArray(flag.metadata.items_titles) && flag.metadata.items_titles.length > 0 && (
                              <p className="text-orange-300/80 text-[10px]">
                                🎯 {flag.metadata.items_titles.map((t: any) => t?.quantity > 1 ? `${t.quantity}× ${t.title}` : t?.title).filter(Boolean).join(', ')}
                                {flag.metadata.total_amount != null && ` · €${Number(flag.metadata.total_amount).toFixed(2)}`}
                              </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              {flag.resolved ? (
                                <p className="text-green-400 text-[10px] flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" /> Resolved: {flag.resolution_note}
                                </p>
                              ) : (
                                <Button size="sm" variant="outline" className="h-6 text-[10px] mt-1" onClick={() => handleResolveFlag(flag.id)}>
                                  <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-6 text-[10px] mt-1 text-destructive border-destructive/30" onClick={() => handleDeleteFlag(flag.id)}>
                                <Trash2 className="h-3 w-3 mr-1" /> Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {(tab === 'blocked' ? visibleBlocked : filteredScores).length === 0 && (
                <div className="text-center py-10 glass rounded-xl">
                  <Shield className="h-10 w-10 text-primary mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm font-display">
                    {tab === 'blocked' ? 'No blocked users' : 'No fraud data yet'}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminFraudDashboard;
