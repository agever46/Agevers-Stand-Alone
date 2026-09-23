import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Listens for new achievement unlocks and shows a celebratory toast.
// Mounted once globally in App.tsx for any logged-in user.
export const useAchievementToasts = () => {
  const { user } = useAuth();
  const initialLoadDone = useRef(false);
  const knownIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      initialLoadDone.current = false;
      knownIds.current = new Set();
      return;
    }

    let mounted = true;

    // Prime the set of already-unlocked achievements so we don't spam toasts on first load
    (async () => {
      const { data } = await (supabase
        .from("user_achievements" as any)
        .select("achievement_id")
        .eq("user_id", user.id) as any);
      if (!mounted) return;
      knownIds.current = new Set(((data as any[]) || []).map((r: any) => r.achievement_id));
      initialLoadDone.current = true;
    })();

    const channel = supabase
      .channel(`achievement-toasts-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_achievements", filter: `user_id=eq.${user.id}` },
        async (payload: any) => {
          if (!initialLoadDone.current) return;
          const achievementId = payload.new?.achievement_id;
          if (!achievementId || knownIds.current.has(achievementId)) return;
          knownIds.current.add(achievementId);

          // Fetch achievement details
          const { data: ach } = await (supabase
            .from("achievements" as any)
            .select("title, icon, reward_type, reward_value")
            .eq("id", achievementId)
            .maybeSingle() as any);

          if (!ach) return;

          const meta = payload.new?.reward_metadata || {};
          // Coin-type rewards are temporarily disabled site-wide, so
          // grant_achievement_reward no longer actually credits any coins
          // for this unlock — don't claim it did.
          if (ach.reward_type === "coins") {
            toast.success(`${ach.icon} Achievement Unlocked: ${ach.title}!`, { duration: 6000 });
            return;
          }
          const rewardText = meta.coupon_code
            ? `Coupon: ${meta.coupon_code} (${ach.reward_value}% off)`
            : `${ach.reward_value}% off coupon`;

          toast.success(`${ach.icon} Achievement Unlocked: ${ach.title}!`, {
            description: rewardText,
            duration: 6000,
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);
};
