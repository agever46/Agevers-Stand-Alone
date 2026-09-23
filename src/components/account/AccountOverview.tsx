import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { User, Package, Heart, MessageSquare, Pencil, AlertTriangle, Send, Clock } from "lucide-react";
import ReferralCard from "./ReferralCard";
import NextAchievementBanner from "./NextAchievementBanner";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface AccountOverviewProps {
  onNavigate: (section: "orders" | "favorites" | "tickets" | "settings" | "achievements") => void;
}

const AccountOverview = ({ onNavigate }: AccountOverviewProps) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null; username: string | null; email_verified: boolean }>({ display_name: null, avatar_url: null, username: null, email_verified: false });
  const [orderCount, setOrderCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [ticketCount, setTicketCount] = useState(0);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);
  const [minutesLeft, setMinutesLeft] = useState<number>(0);

  useEffect(() => {
    if (!user?.created_at) return;
    const update = () => {
      const created = new Date(user.created_at).getTime();
      const unlockAt = created + 24 * 60 * 60 * 1000;
      const remainingMs = unlockAt - Date.now();
      if (remainingMs <= 0) {
        setHoursLeft(0);
        setMinutesLeft(0);
        return;
      }
      setHoursLeft(Math.floor(remainingMs / (60 * 60 * 1000)));
      setMinutesLeft(Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000)));
    };
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [user?.created_at]);

  const showNewAccountBanner = hoursLeft !== null && hoursLeft >= 0 && (hoursLeft > 0 || minutesLeft > 0);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("profiles").select("display_name, avatar_url, username, email_verified").eq("user_id", user.id).maybeSingle(),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("wishlist").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      (supabase.from("support_tickets" as any).select("*", { count: "exact", head: true }).eq("buyer_id", user.id).neq("status", "resolved").neq("status", "closed") as any),
    ]).then(([profileRes, ordersRes, wishlistRes, ticketsRes]: any[]) => {
      if (profileRes.data) setProfile({ ...profileRes.data, email_verified: profileRes.data.email_verified ?? false });
      setOrderCount(ordersRes.count || 0);
      setWishlistCount(wishlistRes.count || 0);
      setTicketCount(ticketsRes.count || 0);
    });
  }, [user]);

  const avatarUrl = profile.avatar_url?.startsWith("http")
    ? profile.avatar_url
    : profile.avatar_url
      ? supabase.storage.from("product-images").getPublicUrl(profile.avatar_url).data.publicUrl
      : null;

  const cards = [
    { labelKey: "account.overview.stats.orders", value: orderCount, icon: Package, section: "orders" as const, color: "text-primary" },
    { labelKey: "account.overview.stats.favorites", value: wishlistCount, icon: Heart, section: "favorites" as const, color: "text-pink-400" },
    { labelKey: "account.overview.stats.openTickets", value: ticketCount, icon: MessageSquare, section: "tickets" as const, color: "text-orange-400" },
  ];

  const handleResendVerification = async () => {
    if (sendingVerification) return;
    setSendingVerification(true);
    try {
      const { error } = await supabase.functions.invoke("send-verification-email");
      if (error) throw error;
      toast.success(t("account.overview.toast.verificationSent"));
    } catch (e: any) {
      if (e?.message?.includes("429")) {
        toast.error(t("account.overview.toast.rateLimited"));
      } else {
        toast.error(t("account.overview.toast.verificationFailed"));
      }
    } finally {
      setSendingVerification(false);
    }
  };

  const timeStr = hoursLeft! > 0 ? `${hoursLeft}h ${minutesLeft}m` : `${minutesLeft}m`;

  return (
    <div className="space-y-6">
      {!profile.email_verified && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm font-bold text-foreground">{t("account.overview.verifyEmail.title")}</p>
            <p className="text-xs text-muted-foreground">{t("account.overview.verifyEmail.desc")}</p>
          </div>
          <button
            onClick={handleResendVerification}
            disabled={sendingVerification}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-display font-semibold transition-colors disabled:opacity-50 shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            {sendingVerification ? t("account.overview.verifyEmail.sending") : t("account.overview.verifyEmail.verifyNow")}
          </button>
        </div>
      )}
      {showNewAccountBanner && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 flex items-start gap-4">
          <Clock className="h-6 w-6 text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm font-bold text-foreground">
              {t("account.overview.newAccountLimit.title")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("account.overview.newAccountLimit.desc", { time: timeStr })}{" "}
              <a href="/contact" className="text-blue-400 hover:underline">{t("account.overview.newAccountLimit.contactUs")}</a>{" "}
              {t("account.overview.newAccountLimit.contactSuffix")}
            </p>
          </div>
        </div>
      )}
      <div className="glass rounded-xl p-6 flex items-center gap-5">
        <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-border/50 shadow-inner">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={profile.display_name || "User Avatar"} 
              className="h-full w-full object-cover transition-opacity duration-300" 
              onError={(e) => {
                // Fallback if image fails to load
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement?.classList.add('bg-primary/20');
              }}
            />
          ) : (
            <User className="h-8 w-8 text-muted-foreground opacity-50" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl font-black tracking-wider text-foreground">
            {profile.display_name || profile.username || "User"}
          </h2>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
        <button
          onClick={() => onNavigate("settings")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-sm font-display transition-colors"
        >
          <Pencil className="h-4 w-4" />
          {t("account.overview.editProfile")}
        </button>
      </div>

      <ReferralCard />
      <NextAchievementBanner onClick={() => onNavigate("achievements")} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.labelKey}
              onClick={() => onNavigate(card.section)}
              className="glass rounded-xl p-5 text-left hover:ring-1 hover:ring-primary/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className={`h-6 w-6 ${card.color}`} />
                <span className="font-display text-2xl font-black text-foreground">{card.value}</span>
              </div>
              <p className="text-sm font-display text-muted-foreground group-hover:text-foreground transition-colors">{t(card.labelKey)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AccountOverview;
