import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LucideIcon } from "lucide-react";
import {
  UserPlus, Package, Crown, MessageSquare, Store, Shield, Layers, RefreshCw,
  ShieldAlert, ArrowLeft, Wallet, UserCircle, ChevronDown, Users,
  Inbox, ClipboardList, Calculator, Mail, Receipt, GitBranch, Ticket,
  Building2, Lock, Unlock, Search, Settings, FileText, User, LogOut, ExternalLink, Wand2,
  TrendingUp, Gamepad2, AlertTriangle, BarChart3, Activity, Paperclip,
} from "lucide-react";

interface NavItem { id: string; label: string; icon: LucideIcon; path: string }
interface NavGroup { label: string; icon: LucideIcon; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: "Catalog", icon: Package, items: [
      { id: "products", label: "Manage Products", icon: Package, path: "/admin/products" },
      { id: "kinguin", label: "Kinguin", icon: Crown, path: "/admin/kinguin" },
      { id: "aliexpress", label: "AliExpress", icon: Package, path: "/admin/aliexpress" },
      { id: "suggestions", label: "Discover", icon: Inbox, path: "/admin/suggestions" },
      { id: "trending-research", label: "Trending Research", icon: TrendingUp, path: "/admin/trending-research" },
      { id: "collections", label: "Collections", icon: Layers, path: "/admin/collections" },
      { id: "game-groups", label: "Game Groups", icon: Layers, path: "/admin/game-groups" },
      { id: "title-reformatter", label: "Title Reformatter", icon: Wand2, path: "/admin/title-reformatter" },
    ],
  },
  {
    label: "Sales", icon: Receipt, items: [
      { id: "orders", label: "Orders", icon: Receipt, path: "/admin/orders" },
      { id: "pending-paypal", label: "PayPal Attempts", icon: AlertTriangle, path: "/admin/pending-paypal" },
      { id: "pricing", label: "Pricing", icon: Calculator, path: "/admin/pricing" },
      { id: "price-compare", label: "AllKeyShop", icon: Crown, path: "/admin/price-compare" },
      { id: "overpriced-cards", label: "Overpriced Cards", icon: AlertTriangle, path: "/admin/overpriced-cards" },
      { id: "discount-codes", label: "Coupons", icon: Ticket, path: "/admin/discount-codes" },
      { id: "daily-deals", label: "Daily Deals", icon: Ticket, path: "/admin/daily-deals" },
      { id: "bundles", label: "Bundles", icon: Package, path: "/admin/bundles" },
      { id: "giveaways", label: "Giveaways", icon: Crown, path: "/admin/giveaways" },
      { id: "game-plays", label: "Game Plays", icon: Gamepad2, path: "/admin/game-plays" },
      { id: "receipts", label: "Receipts", icon: Receipt, path: "/admin/receipts" },
    ],
  },
  {
    label: "Users", icon: Users, items: [
      { id: "users", label: "Create User", icon: UserPlus, path: "/admin" },
      { id: "fraud", label: "Fraud", icon: ShieldAlert, path: "/admin/fraud" },
      { id: "tickets", label: "Support Tickets", icon: MessageSquare, path: "/admin/tickets" },
      { id: "chat-attachments", label: "Chat Attachments", icon: Paperclip, path: "/admin/chat-attachments" },
      { id: "customer-suggestions", label: "Suggestion Mailbox", icon: Mail, path: "/admin/customer-suggestions" },
      { id: "requests", label: "Seller Requests", icon: Inbox, path: "/admin/requests" },
      { id: "seller-apps", label: "Seller Apps", icon: ClipboardList, path: "/admin/seller-apps" },
      { id: "withdrawals", label: "Withdrawals", icon: Wallet, path: "/admin/withdrawals" },
      { id: "fake-sellers", label: "Fake Sellers", icon: Users, path: "/admin/fake-sellers" },
    ],
  },
  {
    label: "Marketing", icon: Mail, items: [
      { id: "newsletter", label: "Newsletter", icon: Mail, path: "/admin/newsletter" },
      { id: "marketing-emails", label: "Marketing Emails", icon: Mail, path: "/admin/marketing-emails" },
      { id: "seo-generator", label: "SEO Generator", icon: Wand2, path: "/admin/seo-generator" },
      { id: "social-posts", label: "Social Posts", icon: MessageSquare, path: "/admin/social-posts" },
      { id: "business-portal", label: "Business Portal", icon: Building2, path: "/admin/business-portal" },
      { id: "search-logs", label: "Search Logs", icon: Search, path: "/admin/search-logs" },
      { id: "guides", label: "Help & Guides", icon: ClipboardList, path: "/admin/guides" },
      { id: "news", label: "News", icon: FileText, path: "/admin/news" },
    ],
  },
  {
    label: "Settings", icon: Settings, items: [
      { id: "sync-center", label: "Sync Center", icon: RefreshCw, path: "/admin/sync-center" },
      { id: "analytics", label: "Google Analytics", icon: BarChart3, path: "/admin/analytics" },
      { id: "function-health", label: "Function Health", icon: Activity, path: "/admin/function-health" },
      { id: "nav-menu", label: "Nav Menu", icon: Store, path: "/admin/nav-menu" },
      { id: "audit-log", label: "Audit Log", icon: FileText, path: "/admin/audit-log" },
      { id: "rate-limiting", label: "Rate Limiting", icon: Shield, path: "/admin/rate-limiting" },
      { id: "indexnow", label: "IndexNow", icon: Search, path: "/admin/indexnow" },
      { id: "email-provider", label: "Email Provider", icon: Mail, path: "/admin/email-provider" },
      { id: "email-logs", label: "Sent Emails", icon: Mail, path: "/admin/email-logs" },
    ],
  },
];

interface AdminNavButtonsProps {
  isSeller?: boolean;
  onCreateUser?: () => void;
}

const AdminNavButtons = ({ isSeller = false, onCreateUser }: AdminNavButtonsProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { section } = useParams<{ section: string }>();
  const { user } = useAuth();
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const { maintenance, maintenanceUntil, toggle: toggleMaintenance } = useMaintenanceMode();
  const [durationOpen, setDurationOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");

  const enableMaintenance = async (minutes: number | null) => {
    setDurationOpen(false);
    setCustomMinutes("");
    await toggleMaintenance(minutes);
    toast.success(
      minutes
        ? `🔒 Maintenance mode ON — ends in ${minutes >= 60 ? `${(minutes / 60).toFixed(minutes % 60 ? 1 : 0)}h` : `${minutes}m`}`
        : "🔒 Maintenance mode ON — no end time set"
    );
  };

  const handleMaintenanceToggle = async () => {
    if (!maintenance) {
      setDurationOpen(true);
      return;
    }
    await toggleMaintenance();
    toast.success("🔓 Maintenance mode OFF — site is live");
  };

  const currentPath = section || (location.pathname === "/admin" ? "users" : "");

  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        });
    }
  }, [user]);

  const [liveSupportCount, setLiveSupportCount] = useState(0);
  const [recentSalesCount, setRecentSalesCount] = useState(0);
  const [newSuggestionsCount, setNewSuggestionsCount] = useState(0);

  // Cash register "cha-ching" sound — synthesized via Web Audio API (no asset needed)
  const playCashRegisterSound = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const playBell = (freq: number, start: number, dur: number, vol = 0.25) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(vol, now + start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      };

      // "Cha" — short metallic ding
      playBell(1318.5, 0,    0.18, 0.22); // E6
      playBell(1760,   0,    0.18, 0.18); // A6 harmonic
      // "Ching" — bright sustained chime
      playBell(2093,   0.12, 0.45, 0.28); // C7
      playBell(2637,   0.12, 0.45, 0.20); // E7
      playBell(3135,   0.14, 0.40, 0.12); // G7 sparkle

      setTimeout(() => ctx.close().catch(() => {}), 1000);
    } catch {
      // ignore — audio is a nice-to-have
    }
  };

  useEffect(() => {
    const fetchPending = async () => {
      const { count } = await supabase
        .from("withdrawal_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingWithdrawals(count || 0);
    };
    fetchPending();
    const channel = supabase
      .channel("withdrawal-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, () => fetchPending())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const fetchLive = async () => {
      const { count } = await supabase
        .from("live_support_requests" as any)
        .select("*", { count: "exact", head: true })
        .eq("status", "pending") as any;
      setLiveSupportCount(count || 0);
    };
    fetchLive();
    const channel = supabase
      .channel("live-support-nav-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_support_requests" }, () => fetchLive())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // New customer suggestions badge (status = 'new')
  useEffect(() => {
    const fetchNewSuggestions = async () => {
      const { count } = await (supabase
        .from("customer_suggestions" as any)
        .select("*", { count: "exact", head: true })
        .eq("status", "new") as any);
      setNewSuggestionsCount(count || 0);
    };
    fetchNewSuggestions();
    const channel = supabase
      .channel("customer-suggestions-nav-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_suggestions" }, (payload) => {
        fetchNewSuggestions();
        if (payload.eventType === "INSERT") {
          const s = payload.new as any;
          toast.info(`📬 New suggestion: ${s.subject || "(no subject)"}`, { duration: 8000 });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Recent sales (last 24h, paid/completed) — red badge on Sales group
  useEffect(() => {
    const fetchSales = async () => {
      const stored = localStorage.getItem("admin_sales_last_seen");
      if (!stored) {
        // First visit — baseline to now so we only badge truly new sales
        localStorage.setItem("admin_sales_last_seen", new Date().toISOString());
        setRecentSalesCount(0);
        return;
      }
      const since = stored;
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since)
        .in("status", ["completed", "paid", "awaiting_reveal", "on_hold", "held"]);
      setRecentSalesCount(count || 0);
    };
    // Auto-clear when viewing the orders page itself
    if (location.pathname === "/admin/orders") {
      localStorage.setItem("admin_sales_last_seen", new Date().toISOString());
      setRecentSalesCount(0);
    } else {
      fetchSales();
    }
    const channel = supabase
      .channel("admin-sales-badge")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const o = payload.new as any;
          if (["completed", "paid", "awaiting_reveal", "on_hold", "held"].includes(o?.status)) {
            fetchSales();
            playCashRegisterSound();
            const msg = `💰 New order: ${o.game_title || "Order"} — €${Number(o.price || 0).toFixed(2)}`;
            if (o?.status === "held" || o?.status === "on_hold") {
              toast.warning(`⚠️ HELD — needs approval: ${o.game_title || "Order"} — €${Number(o.price || 0).toFixed(2)}`, { duration: 15000 });
            } else {
              toast.success(msg, { duration: 8000 });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const o = payload.new as any;
          const old = payload.old as any;
          const paidStatuses = ["completed", "paid", "awaiting_reveal", "on_hold", "held"];
          if (paidStatuses.includes(o?.status) && !paidStatuses.includes(old?.status)) {
            fetchSales();
            playCashRegisterSound();
            if (o?.status === "held" || o?.status === "on_hold") {
              toast.warning(`⚠️ Order HELD — needs approval: ${o.game_title || "Order"} — €${Number(o.price || 0).toFixed(2)}`, { duration: 15000 });
            } else {
              toast.success(`💰 Sale completed: ${o.game_title || "Order"} — €${Number(o.price || 0).toFixed(2)}`, {
                duration: 8000,
              });
            }
          }
        }
      )
      .subscribe();
    const interval = setInterval(fetchSales, 60_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!openGroup) return;
    const handler = () => setOpenGroup(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openGroup]);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [avatarMenuOpen]);

  return (
    <div className="flex items-center gap-2 flex-wrap w-full pb-1">
      <button
        onClick={async () => {
          const { data: { session } } = await supabase.auth.getSession();
          const targetUrl = new URL("/", window.location.origin);
          if (session?.access_token && session.refresh_token) {
            const handoffParams = new URLSearchParams({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
            targetUrl.hash = `session-handoff=${encodeURIComponent(handoffParams.toString())}`;
          }
          window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wide bg-secondary/60 text-muted-foreground hover:bg-primary/20 hover:text-primary transition-all whitespace-nowrap"
        title="Back to site"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Site
      </button>

      <button
        onClick={handleMaintenanceToggle}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wide transition-all whitespace-nowrap ${
          maintenance
            ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
            : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
        }`}
        title={maintenance ? "Site is LOCKED — click to unlock" : "Site is LIVE — click to lock"}
      >
        {maintenance ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        {maintenance
          ? maintenanceUntil
            ? `Site Locked until ${new Date(maintenanceUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Site Locked"
          : "Site Live"}
      </button>

      <Dialog open={durationOpen} onOpenChange={setDurationOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Maintenance duration</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {[15, 30, 60, 120, 240, 480, 720, 1440, 2880, 4320, 5760].map((m) => (
              <Button key={m} variant="secondary" onClick={() => enableMaintenance(m)}>
                {m < 60
                  ? `${m} minutes`
                  : m < 1440
                  ? `${m / 60} hour${m > 60 ? "s" : ""}`
                  : `${m / 1440} day${m > 1440 ? "s" : ""}`}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Input
              type="number"
              min={1}
              max={5760}
              placeholder="Custom minutes"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
            />
            <Button
              disabled={!Number(customMinutes)}
              onClick={() => enableMaintenance(Number(customMinutes))}
            >
              Start
            </Button>
          </div>
          <Button variant="ghost" onClick={() => enableMaintenance(null)}>
            No end time (indefinite)
          </Button>
        </DialogContent>
      </Dialog>



      <div className="flex items-center gap-2 mr-1 shrink-0">
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="font-display text-xl font-bold text-foreground whitespace-nowrap">Admin Panel</h1>
      </div>

      {navGroups.map((group) => {
        const GroupIcon = group.icon;
        const groupActive = group.items.some((i) => currentPath === i.id);
        const isOpen = openGroup === group.label;

        return (
          <div key={group.label} className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenGroup(isOpen ? null : group.label);
                if (group.label === "Sales") {
                  localStorage.setItem("admin_sales_last_seen", new Date().toISOString());
                  setRecentSalesCount(0);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wide transition-all whitespace-nowrap ${
                groupActive
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
                  : "bg-secondary/60 text-muted-foreground hover:bg-primary/20 hover:text-primary"
              }`}
            >
              <GroupIcon className="h-3.5 w-3.5" />
              {group.label}
              {group.label === "Users" && (pendingWithdrawals > 0 || liveSupportCount > 0 || newSuggestionsCount > 0) && (
                <span className={`ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold leading-none bg-destructive text-destructive-foreground ${(liveSupportCount > 0 || newSuggestionsCount > 0) ? "animate-pulse" : ""}`}>
                  {pendingWithdrawals + liveSupportCount + newSuggestionsCount}
                </span>
              )}
              {group.label === "Sales" && recentSalesCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold leading-none bg-destructive text-destructive-foreground animate-pulse">
                  {recentSalesCount}
                </span>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-lg shadow-xl py-1 min-w-[200px]">
                {group.items.map((btn) => {
                  const Icon = btn.icon;
                  const isActive = currentPath === btn.id;
                  return (
                    <button
                      key={btn.id}
                      onClick={() => {
                        if (btn.id === "users" && onCreateUser) {
                          navigate(btn.path);
                          onCreateUser();
                        } else {
                          navigate(btn.path);
                        }
                        setOpenGroup(null);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-display font-bold tracking-wide transition-all ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {btn.label}
                      {btn.id === "withdrawals" && pendingWithdrawals > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                          {pendingWithdrawals}
                        </span>
                      )}
                      {btn.id === "tickets" && liveSupportCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none animate-pulse">
                          🔴 {liveSupportCount}
                        </span>
                      )}
                      {btn.id === "customer-suggestions" && newSuggestionsCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none animate-pulse">
                          {newSuggestionsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {isSeller && (
        <button
          onClick={() => navigate("/seller")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wide bg-secondary/60 text-muted-foreground hover:bg-primary/20 hover:text-primary transition-all whitespace-nowrap"
        >
          <Store className="h-3.5 w-3.5" />
          Seller Dashboard
        </button>
      )}

      <div className="ml-auto shrink-0 relative" ref={avatarMenuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setAvatarMenuOpen((o) => !o); }}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-secondary/60 hover:bg-primary/20 transition-all overflow-hidden border border-border/50"
          title="Account menu"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover rounded-full" />
          ) : (
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        {avatarMenuOpen && (
          <div className="absolute top-full right-0 mt-1 z-50 bg-background border border-border rounded-lg shadow-xl py-1 min-w-[200px]">
            <button
              onClick={() => {
                setAvatarMenuOpen(false);
                navigate("/account", { state: { section: "overview", fromAdmin: true } });
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-display font-bold tracking-wide text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
            >
              <User className="h-3.5 w-3.5" />
              My Account
            </button>
            <button
              onClick={() => { setAvatarMenuOpen(false); navigate("/admin"); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-display font-bold tracking-wide text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
            >
              <Shield className="h-3.5 w-3.5" />
              Admin Home
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={async () => {
                setAvatarMenuOpen(false);
                await supabase.auth.signOut();
                toast.success("Signed out");
                navigate("/auth");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-display font-bold tracking-wide text-destructive hover:bg-destructive/10 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNavButtons;