import { Trophy, Lock, Award } from "lucide-react";
import { useAchievements } from "@/hooks/useAchievements";
import AchievementCard from "./AchievementCard";
import NextAchievementBanner from "./NextAchievementBanner";
import { useTranslation } from "react-i18next";

const AccountAchievements = () => {
  const { t } = useTranslation();
  const { achievements, unlockedCount, totalCount, loading } = useAchievements();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Trophy className="h-10 w-10 text-yellow-400 animate-pulse" />
      </div>
    );
  }

  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-xl p-6 border border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 to-orange-500/5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
            <Trophy className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-black tracking-wider text-foreground">{t("account.achievements.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("account.achievements.subtitle")}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
              {unlockedCount}/{totalCount}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("account.achievements.unlocked")}</p>
          </div>
        </div>
      </div>

      {/* Next achievement banner */}
      <NextAchievementBanner />

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-5 w-5 text-green-400" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
              {t("account.achievements.unlockedSection", { count: unlocked.length })}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unlocked.map((a) => <AchievementCard key={a.id} achievement={a} />)}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
              {t("account.achievements.lockedSection", { count: locked.length })}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locked.map((a) => <AchievementCard key={a.id} achievement={a} />)}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountAchievements;
