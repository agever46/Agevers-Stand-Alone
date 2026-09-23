import { Lock, CheckCircle2, Coins, Ticket, Copy, Gamepad2, ShoppingBag, Wallet, UserPlus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AchievementWithProgress } from "@/hooks/useAchievements";
import { useTranslation } from "react-i18next";

interface Props { achievement: AchievementWithProgress; }

// Color theme per criteria type — used for borders & accents
const themeFor = (type: AchievementWithProgress["criteria_type"]) => {
  switch (type) {
    case "games_played":
    case "coins_won":
      return {
        border: "border-fuchsia-500/40 hover:border-fuchsia-400/70",
        glow: "shadow-[0_0_20px_-4px_hsl(289_85%_60%/0.35)]",
        iconBg: "bg-gradient-to-br from-fuchsia-500/30 to-pink-500/20",
        Icon: Gamepad2,
      };
    case "total_spent":
      return {
        border: "border-emerald-500/40 hover:border-emerald-400/70",
        glow: "shadow-[0_0_20px_-4px_hsl(160_85%_50%/0.3)]",
        iconBg: "bg-gradient-to-br from-emerald-500/30 to-teal-500/20",
        Icon: Wallet,
      };
    case "order_count":
      return {
        border: "border-amber-500/40 hover:border-amber-400/70",
        glow: "shadow-[0_0_20px_-4px_hsl(38_92%_55%/0.3)]",
        iconBg: "bg-gradient-to-br from-amber-500/30 to-orange-500/20",
        Icon: ShoppingBag,
      };
    default:
      return {
        border: "border-sky-500/40 hover:border-sky-400/70",
        glow: "shadow-[0_0_20px_-4px_hsl(199_89%_55%/0.3)]",
        iconBg: "bg-gradient-to-br from-sky-500/30 to-blue-500/20",
        Icon: UserPlus,
      };
  }
};

const AchievementCard = ({ achievement: a }: Props) => {
  const { t } = useTranslation();
  const couponCode = a.reward_metadata?.coupon_code as string | undefined;
  const theme = themeFor(a.criteria_type);
  const FallbackIcon = theme.Icon;

  const formatProgress = () => {
    if (a.criteria_type === "signup") return a.unlocked ? t("account.achievements.progress.completed") : t("account.achievements.progress.pending");
    if (a.criteria_type === "order_count") return t("account.achievements.progress.orders", { current: Math.min(a.current_value, a.criteria_value), total: a.criteria_value });
    if (a.criteria_type === "total_spent") return t("account.achievements.progress.spent", { current: Math.min(a.current_value, Number(a.criteria_value)).toFixed(0), total: a.criteria_value });
    if (a.criteria_type === "games_played") return t("account.achievements.progress.games", { current: Math.min(a.current_value, a.criteria_value), total: a.criteria_value });
    if (a.criteria_type === "coins_won") return t("account.achievements.progress.coins", { current: Math.min(a.current_value, Number(a.criteria_value)).toLocaleString(), total: Number(a.criteria_value).toLocaleString() });
    return "";
  };

  const copyCoupon = () => {
    if (!couponCode) return;
    navigator.clipboard.writeText(couponCode);
    toast.success(`Copied ${couponCode}`);
  };

  return (
    <div
      className={cn(
        "glass rounded-xl p-5 border-2 transition-all relative overflow-hidden",
        a.unlocked
          ? "border-primary/70 bg-gradient-to-br from-primary/10 to-yellow-500/10 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.45)]"
          : cn("opacity-90 hover:opacity-100", theme.border, theme.glow)
      )}
    >
      {/* Decorative corner accent */}
      <div
        className={cn(
          "absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-20 pointer-events-none",
          a.unlocked ? "bg-gradient-to-bl from-yellow-400 to-orange-500" : theme.iconBg
        )}
      />

      <div className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center text-2xl shrink-0 border",
            a.unlocked
              ? "bg-gradient-to-br from-yellow-400/30 to-orange-500/30 border-yellow-400/50"
              : cn(theme.iconBg, "border-white/10")
          )}
        >
          {a.unlocked ? (
            <span>{a.icon}</span>
          ) : a.icon ? (
            <span className="opacity-50 saturate-50">{a.icon}</span>
          ) : (
            <FallbackIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-bold text-foreground truncate">{a.title}</h3>
            {a.unlocked && <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{formatProgress()}</span>
          <span className="font-display font-bold text-foreground">{a.progress_pct}%</span>
        </div>
        <Progress value={a.progress_pct} className="h-2" />
      </div>

      {/* Reward */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5 text-xs">
          {a.reward_type === "coins" ? (
            <>
              <Coins className="h-3.5 w-3.5 text-orange-400" />
              <span className="font-display font-bold text-orange-400">{t("account.achievements.reward.coins", { value: a.reward_value })}</span>
            </>
          ) : (
            <>
              <Ticket className="h-3.5 w-3.5 text-purple-400" />
              <span className="font-display font-bold text-purple-400">{t("account.achievements.reward.coupon", { value: a.reward_value })}</span>
            </>
          )}
        </div>
        {a.unlocked && couponCode && (
          <button
            onClick={copyCoupon}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-mono transition-colors"
            title={t("account.achievements.reward.coupon", { value: couponCode })}
          >
            <Copy className="h-3 w-3" />
            {couponCode}
          </button>
        )}
      </div>
    </div>
  );
};

export default AchievementCard;
