import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, RefreshCw, ChevronDown, ChevronRight, ExternalLink,
  Clock, XCircle, CheckCircle2, AlertTriangle, User, Mail, Package,
} from "lucide-react";
import { toast } from "sonner";

interface PendingItem {
  title: string;
  quantity: number;
  price: number;
  image_url?: string;
  platform?: string;
  sellerName?: string;
}

interface PendingOrder {
  id: string;
  paypal_order_id: string | null;
  user_id: string | null;
  user_email: string | null;
  guest_email: string | null;
  items: PendingItem[];
  total_eur: number;
  total_charge: number;
  charge_currency: string;
  status: string;
  last_error: string | null;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
  paypal_payer_snapshot: any;
}

const STATUS_STYLES: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: "Pending", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", Icon: Clock },
  expired: { label: "Abandoned", cls: "bg-muted text-muted-foreground border-border", Icon: XCircle },
  failed: { label: "Failed", cls: "bg-destructive/15 text-destructive border-destructive/30", Icon: AlertTriangle },
  fulfilled: { label: "Fulfilled", cls: "bg-green-500/15 text-green-400 border-green-500/30", Icon: CheckCircle2 },
};

// The backend never actually writes the literal status "pending" to this
// table — an in-flight PayPal order attempt is "created" (order opened,
// not yet paid) or "captured" (paid, fulfillment not confirmed yet). Both
// were already falling back to the "Pending" badge below via
// `STATUS_STYLES[o.status] || STATUS_STYLES.pending`, but stats/filtering
// only ever matched the literal string "pending" — so rows visibly badged
// "Pending" in the list were never counted in the Pending stat card.
const PENDING_STATUSES = ["pending", "created", "captured"];
const normalizeStatus = (status: string) => (PENDING_STATUSES.includes(status) ? "pending" : status);

const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const AdminPendingPayPalOrders = () => {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ pending: 0, expired: 0, failed: 0, fulfilled: 0, total_lost: 0 });

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pending_paypal_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Failed to load: " + error.message);
      setLoading(false);
      return;
    }
    setOrders((data as any) || []);
    setLoading(false);
  };

  // Stat cards must reflect the true totals across the whole table, not just
  // the most recent 500 rows the list view fetches — counted server-side so
  // this stays correct no matter how large the table grows.
  const fetchStats = async () => {
    const [{ count: pending }, { count: expired }, { count: failed }, { count: fulfilled }, { data: lostRows }] =
      await Promise.all([
        supabase.from("pending_paypal_orders").select("*", { count: "exact", head: true }).in("status", PENDING_STATUSES),
        supabase.from("pending_paypal_orders").select("*", { count: "exact", head: true }).eq("status", "expired"),
        supabase.from("pending_paypal_orders").select("*", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("pending_paypal_orders").select("*", { count: "exact", head: true }).eq("status", "fulfilled"),
        supabase.from("pending_paypal_orders").select("total_eur").in("status", ["expired", "failed"]),
      ]);
    const total_lost = (lostRows || []).reduce((sum, r: any) => sum + Number(r.total_eur || 0), 0);
    setStats({ pending: pending || 0, expired: expired || 0, failed: failed || 0, fulfilled: fulfilled || 0, total_lost });
  };

  useEffect(() => {
    fetchOrders();
    fetchStats();
    const channel = supabase
      .channel("admin-pending-paypal")
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_paypal_orders" }, () => {
        fetchOrders();
        fetchStats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== "all") list = list.filter((o) => normalizeStatus(o.status) === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((o) =>
        (o.user_email || "").toLowerCase().includes(q) ||
        (o.guest_email || "").toLowerCase().includes(q) ||
        (o.paypal_order_id || "").toLowerCase().includes(q) ||
        (o.items || []).some((i) => (i.title || "").toLowerCase().includes(q))
      );
    }
    return list;
  }, [orders, statusFilter, search]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const StatCard = ({ label, value, cls, Icon }: { label: string; value: string | number; cls: string; Icon: typeof Clock }) => (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-display font-bold tracking-wider uppercase opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="text-2xl font-display font-black">{value}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-black tracking-wider text-foreground">PayPal Order Attempts</h2>
          <p className="text-sm text-muted-foreground mt-1">Every PayPal order created — abandoned, stuck, failed, or fulfilled.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchOrders(); fetchStats(); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Pending" value={stats.pending} cls={STATUS_STYLES.pending.cls} Icon={Clock} />
        <StatCard label="Abandoned" value={stats.expired} cls={STATUS_STYLES.expired.cls} Icon={XCircle} />
        <StatCard label="Failed" value={stats.failed} cls={STATUS_STYLES.failed.cls} Icon={AlertTriangle} />
        <StatCard label="Fulfilled" value={stats.fulfilled} cls={STATUS_STYLES.fulfilled.cls} Icon={CheckCircle2} />
        <StatCard label="Lost Revenue" value={`€${stats.total_lost.toFixed(2)}`} cls="bg-primary/10 text-primary border-primary/30" Icon={Package} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, product title, or PayPal ID…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 bg-secondary/40 rounded-lg p-1">
          {["all", "pending", "expired", "failed", "fulfilled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-display font-bold tracking-wide rounded-md transition-all capitalize ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "expired" ? "Abandoned" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No orders match your filters.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((o) => {
              const cfg = STATUS_STYLES[normalizeStatus(o.status)] || STATUS_STYLES.pending;
              const isOpen = expanded.has(o.id);
              const email = o.user_email || o.guest_email || "—";
              const isGuest = !!o.guest_email && !o.user_email;
              return (
                <div key={o.id} className="hover:bg-secondary/30 transition-colors">
                  <button
                    onClick={() => toggleExpand(o.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 text-left"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-display font-bold tracking-wider uppercase ${cfg.cls}`}>
                      <cfg.Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    {o.status === "captured" && (
                      <span
                        title="Payment was captured but fulfillment hasn't been confirmed — the customer was charged."
                        className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[9px] font-display font-bold tracking-wider uppercase shrink-0"
                      >
                        Paid — stuck
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground truncate">
                        {isGuest ? <User className="h-3 w-3 text-yellow-500 shrink-0" /> : <Mail className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <span className="truncate">{email}</span>
                        {isGuest && <span className="text-[10px] font-display font-bold tracking-wider text-yellow-500 uppercase">Guest</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {(o.items?.[0]?.title) || "—"}
                        {o.items?.length > 1 && ` +${o.items.length - 1} more`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-display font-black text-foreground">
                        {o.charge_currency !== "EUR" ? `${o.total_charge?.toFixed(2)} ${o.charge_currency}` : `€${o.total_eur?.toFixed(2)}`}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{relTime(o.created_at)}</div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-12 pb-4 space-y-4 bg-background/50">
                      {(o.status === "created" || o.status === "captured") && (
                        <div className="text-xs text-muted-foreground">
                          {o.status === "created"
                            ? "Checkout was opened on PayPal but never paid — no charge was made."
                            : "Payment was captured on PayPal, but fulfillment hasn't been confirmed yet — the customer was charged."}
                        </div>
                      )}
                      {/* Items */}
                      <div className="space-y-2">
                        {o.items?.map((it, idx) => (
                          <div key={idx} className="flex items-center gap-3 rounded-lg border border-border p-2 bg-card">
                            {it.image_url && <img src={it.image_url} alt="" className="h-10 w-10 rounded object-cover" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-foreground truncate">{it.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {it.platform || "—"} · Qty {it.quantity} · {it.sellerName || "—"}
                              </div>
                            </div>
                            <div className="text-sm font-semibold">€{Number(it.price).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>

                      {/* Meta grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <div className="text-muted-foreground uppercase font-bold tracking-wider mb-1">PayPal ID</div>
                          <div className="font-mono text-foreground truncate">{o.paypal_order_id || "—"}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground uppercase font-bold tracking-wider mb-1">Currency</div>
                          <div className="text-foreground">{o.charge_currency}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground uppercase font-bold tracking-wider mb-1">Created</div>
                          <div className="text-foreground">{new Date(o.created_at).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground uppercase font-bold tracking-wider mb-1">Last Update</div>
                          <div className="text-foreground">{new Date(o.updated_at).toLocaleString()}</div>
                        </div>
                      </div>

                      {o.last_error && (
                        <div className="rounded-lg border border-border bg-secondary/40 p-3">
                          <div className="text-[10px] font-display font-bold tracking-wider uppercase text-muted-foreground mb-1">Reason / Error</div>
                          <div className="text-xs text-foreground font-mono break-words">{o.last_error}</div>
                        </div>
                      )}

                      {o.user_id && (
                        <a
                          href={`/admin/fraud?user=${o.user_id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> View user fraud profile
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPendingPayPalOrders;