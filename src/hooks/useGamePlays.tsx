import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useGamePlays = () => {
  const { user } = useAuth();
  const [coins, setCoins] = useState(0);
  const [freePlaysLeft, setFreePlaysLeft] = useState(2);
  const [paidPlaysLeft, setPaidPlaysLeft] = useState(0);
  const [loading, setLoading] = useState(true);

  const getActiveUser = useCallback(async () => {
    if (user) return user;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user ?? null;
  }, [user]);

  const refresh = useCallback(async () => {
    const activeUser = await getActiveUser();

    if (!activeUser) {
      setLoading(false);
      return { freeLeft: 0, paidLeft: 0 };
    }

    // Run all reads in parallel for speed
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [coinRes, freeCountRes, purchasesRes] = await Promise.all([
      supabase.from("user_coins" as any).select("balance").eq("user_id", activeUser.id).maybeSingle(),
      supabase
        .from("game_plays" as any)
        .select("*", { count: "exact", head: true })
        .eq("user_id", activeUser.id)
        .eq("is_paid", false)
        .gte("created_at", since),
      supabase
        .from("play_purchases" as any)
        .select("plays_remaining")
        .eq("user_id", activeUser.id)
        .gt("plays_remaining", 0),
    ]);

    const balance = (coinRes.data as any)?.balance || 0;
    const freeLeft = Math.max(0, 2 - (freeCountRes.count || 0));
    const paidLeft = (purchasesRes.data || []).reduce(
      (s: number, p: any) => s + (p.plays_remaining || 0),
      0
    );

    setCoins(balance);
    setFreePlaysLeft(freeLeft);
    setPaidPlaysLeft(paidLeft);
    setLoading(false);
    return { freeLeft, paidLeft };
  }, [getActiveUser]);

  useEffect(() => {
    refresh();
    // Refresh whenever the tab regains focus, so the counter never goes stale
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const canPlay = freePlaysLeft > 0 || paidPlaysLeft > 0;

  const recordPlay = async (gameType: string, coinsWon: number) => {
    const activeUser = await getActiveUser();
    if (!activeUser) throw new Error("No active session");

    // Always re-read fresh counts before deciding free vs paid, so we never
    // misclassify due to stale React state.
    const fresh = await refresh();
    const freeLeft = fresh?.freeLeft ?? freePlaysLeft;
    const paidLeft = fresh?.paidLeft ?? paidPlaysLeft;

    if (freeLeft <= 0 && paidLeft <= 0) {
      // No plays available — refuse to insert.
      throw new Error("No plays available");
    }

    // Atomically verify availability + insert play row server-side.
    // Direct client INSERT into game_plays is no longer allowed by RLS.
    const { data: recordData, error: playError } = await supabase.rpc("record_play" as any, {
      _game_type: gameType,
    });
    if (playError) throw playError;
    const playRow: any = Array.isArray(recordData) ? recordData[0] : recordData;
    const playId: string | undefined = playRow?.play_id;
    if (!playId) {
      throw new Error("Game play was not saved");
    }
    const playData = { id: playId };

    // Add or subtract coins via secure RPC.
    // The server hard-caps a single credit at +/-100, so clamp here to make
    // sure a big score still pays out the maximum instead of erroring out.
    const cappedCoins = Math.max(-100, Math.min(100, Math.trunc(coinsWon)));
    if (cappedCoins !== 0 && playData?.id) {
      const { error: coinsError } = await supabase.rpc("add_coins" as any, {
        _user_id: activeUser.id,
        _amount: cappedCoins,
        _game_play_id: playData.id,
      });
      if (coinsError) throw coinsError;
    }

    // Telegram admin notifications are restricted to service-role/admin callers
    // (see security hardening of telegram-notify). End-user game-play pings
    // were removed to prevent abuse of the admin alert channel.

    await refresh();
    return playData?.id || true;
  };

  const buyPlays = async () => {
    if (!user) return false;
    if (coins < 50) return false;

    const { data: success } = await supabase.rpc("buy_plays_with_coins" as any, {
      _user_id: user.id,
    });

    if (!success) return false;

    await refresh();
    return true;
  };

  return { coins, freePlaysLeft, paidPlaysLeft, canPlay, loading, recordPlay, buyPlays, refresh };
};
