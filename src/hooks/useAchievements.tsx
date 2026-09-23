import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  criteria_type: "signup" | "order_count" | "total_spent" | "games_played" | "coins_won";
  criteria_value: number;
  reward_type: "coins" | "coupon";
  reward_value: number;
  display_order: number;
}

export interface UserAchievement {
  achievement_id: string;
  unlocked_at: string;
  reward_metadata: any;
}

export interface AchievementWithProgress extends Achievement {
  unlocked: boolean;
  unlocked_at?: string;
  reward_metadata?: any;
  current_value: number;
  progress_pct: number;
}

export const useAchievements = () => {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [coinsWon, setCoinsWon] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const [achRes, uaRes, ordersRes, playsRes] = await Promise.all([
      (supabase.from("achievements" as any).select("*").eq("is_active", true).order("display_order") as any),
      (supabase.from("user_achievements" as any).select("achievement_id, unlocked_at, reward_metadata").eq("user_id", user.id) as any),
      supabase.from("orders").select("paypal_order_id, id, price, quantity, status").eq("user_id", user.id),
      (supabase.from("game_plays" as any).select("coins_won").eq("user_id", user.id) as any),
    ]);

    setAchievements((achRes.data as any) || []);
    setUserAchievements((uaRes.data as any) || []);

    const completedOrders = ((ordersRes.data as any) || []).filter((o: any) =>
      ["completed", "paid", "delivered"].includes(o.status)
    );
    const distinctOrderIds = new Set(completedOrders.map((o: any) => o.paypal_order_id || o.id));
    setOrderCount(distinctOrderIds.size);
    setTotalSpent(completedOrders.reduce((sum: number, o: any) => sum + Number(o.price || 0) * (o.quantity || 1), 0));

    const plays = ((playsRes.data as any) || []) as { coins_won: number | null }[];
    setGamesPlayed(plays.length);
    setCoinsWon(plays.reduce((sum, p) => sum + Number(p.coins_won || 0), 0));

    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user-achievements-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_achievements", filter: `user_id=eq.${user.id}` }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const computeCurrent = (a: Achievement): number => {
    if (a.criteria_type === "order_count") return orderCount;
    if (a.criteria_type === "total_spent") return totalSpent;
    if (a.criteria_type === "games_played") return gamesPlayed;
    if (a.criteria_type === "coins_won") return coinsWon;
    return 0;
  };

  const enriched: AchievementWithProgress[] = achievements.map((a) => {
    const ua = userAchievements.find((x) => x.achievement_id === a.id);
    const current = computeCurrent(a);
    const pct = a.criteria_value > 0
      ? Math.min(100, Math.round((current / Number(a.criteria_value)) * 100))
      : (ua ? 100 : 0);
    return {
      ...a,
      unlocked: !!ua,
      unlocked_at: ua?.unlocked_at,
      reward_metadata: ua?.reward_metadata,
      current_value: current,
      progress_pct: ua ? 100 : pct,
    };
  });

  // reward_type "coins" is excluded — Blaze Coins is temporarily disabled
  // site-wide, so an achievement that would pay out coins isn't a
  // meaningful "next" goal to suggest right now.
  const nextAchievement = enriched
    .filter((a) => !a.unlocked && a.criteria_type !== "signup" && a.reward_type !== "coins")
    .sort((a, b) => b.progress_pct - a.progress_pct)[0];

  return {
    loading,
    achievements: enriched,
    nextAchievement,
    orderCount,
    totalSpent,
    unlockedCount: userAchievements.length,
    totalCount: achievements.length,
    refresh: load,
  };
};
