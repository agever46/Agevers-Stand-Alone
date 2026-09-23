import { Trophy, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAchievements } from "@/hooks/useAchievements";
import { useTranslation } from "react-i18next";

interface Props { compact?: boolean; onClick?: () => void; }

const NextAchievementBanner = ({ compact = false, onClick }: Props) => {
  const { t } = useTranslation();
  const { nextAchievement, loading } = useAchievements();
  if (loading || !nextAchievement) return null;
  const a = nextAchievement;

  const remainingText =
    a.criteria_type === "order_count"
      ? t("account.achievements.progress.moreOrders", { count: Math.max(0, Number(a.criteria_value) - a.current_value) })
      : a.criteria_type === "total_spent"
        ? t("account.achievements.progress.moreSpend", { amount: Math.max(0, Number(a.criteria_value) - a.current_value).toFixed(0) })
        : t("account.achievements.progress.almostThere");

  const rewardText =
    a.reward_type === "coins"
      ? t("account.achievements.reward.blazeCoins", { value: a.reward_value })
      : t("account.achievements.reward.offCoupon", { value: a.reward_value });

  return (
    <button
      onClick={onClick}
      className="w-full text-left glass rounded-xl p-5 border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-orange-500/5 to-pink-500/10 hover:border-yellow-500/50 transition-all group"
    >
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
          {a.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Trophy className="h-3.5 w-3.5 text-yellow-400" />
            <span className="font-display text-[10px] uppercase tracking-wider text-yellow-400 font-bold">{t("account.achievements.next.label")}</span>
          </div>
          <h3 className="font-display text-base font-black text-foreground truncate">{a.title}</h3>
          {!compact && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <Sparkles className="inline h-3 w-3 text-pink-400 mr-1" />
              {remainingText} → <span className="text-pink-300 font-bold">{rewardText}</span>
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
            {a.progress_pct}%
          </div>
        </div>
      </div>
      <div className="mt-3">
        <Progress value={a.progress_pct} className="h-2" />
      </div>
    </button>
  );
};

export default NextAchievementBanner;
