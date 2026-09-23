import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PricingRule {
  id: string;
  tier_order: number;
  max_cost: number;
  margin_pct: number;
}

export interface PricingSettings {
  fixed_fee: number;
  platform_pct: number;
}

const DEFAULT_RULES: PricingRule[] = [
  { id: "1", tier_order: 1, max_cost: 10, margin_pct: 0.15 },
  { id: "2", tier_order: 2, max_cost: 50, margin_pct: 0.10 },
  { id: "3", tier_order: 3, max_cost: 150, margin_pct: 0.07 },
  { id: "4", tier_order: 4, max_cost: 99999, margin_pct: 0.04 },
];

const DEFAULT_SETTINGS: PricingSettings = { fixed_fee: 0, platform_pct: 0 };

const PRICING_QUERY_KEY = ["pricing-rules-bundle"];

const fetchPricingBundle = async () => {
  const [rulesRes, topupRes, settingsRes] = await Promise.all([
    supabase.from("pricing_rules").select("*").order("tier_order"),
    supabase.from("pricing_rules_topups" as any).select("*").order("tier_order"),
    supabase.from("pricing_settings").select("*").eq("id", 1).single(),
  ]);
  return {
    rules: (rulesRes.data && rulesRes.data.length > 0 ? rulesRes.data : DEFAULT_RULES) as PricingRule[],
    topupRules: (topupRes.data && (topupRes.data as any[]).length > 0 ? topupRes.data : DEFAULT_RULES) as PricingRule[],
    settings: (settingsRes.data || DEFAULT_SETTINGS) as PricingSettings,
  };
};

export const usePricingRules = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: PRICING_QUERY_KEY,
    queryFn: fetchPricingBundle,
    staleTime: 10 * 60 * 1000, // 10 min – pricing rules rarely change
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const rules = data?.rules ?? DEFAULT_RULES;
  const topupRules = data?.topupRules ?? DEFAULT_RULES;
  const settings = data?.settings ?? DEFAULT_SETTINGS;
  const loading = isLoading;

  const fetchRules = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: PRICING_QUERY_KEY });
  }, [queryClient]);

  const getMargin = useCallback((cost: number): number => {
    const sorted = [...rules].sort((a, b) => a.tier_order - b.tier_order);
    for (const rule of sorted) {
      if (cost <= rule.max_cost) return rule.margin_pct;
    }
    return sorted[sorted.length - 1]?.margin_pct || 0.04;
  }, [rules]);

  const calculate = useCallback((cost: number) => {
    const margin = getMargin(cost);
    const rawPrice = (cost + settings.fixed_fee) / (1 - settings.platform_pct - margin);
    const finalPrice = Math.ceil(rawPrice * 100) / 100;
    const platformFees = settings.fixed_fee + settings.platform_pct * finalPrice;
    const netProfit = finalPrice - cost - platformFees;
    const netProfitPct = finalPrice > 0 ? (netProfit / finalPrice) * 100 : 0;
    return { cost, marginTier: `${(margin * 100).toFixed(0)}%`, platformFees, finalPrice, netProfit, netProfitPct };
  }, [getMargin, settings]);

  const getTopupMargin = useCallback((cost: number): number => {
    const sorted = [...topupRules].sort((a, b) => a.tier_order - b.tier_order);
    for (const rule of sorted) {
      if (cost <= rule.max_cost) return rule.margin_pct;
    }
    return sorted[sorted.length - 1]?.margin_pct || 0.03;
  }, [topupRules]);

  const calculateTopup = useCallback((cost: number) => {
    const margin = getTopupMargin(cost);
    const rawPrice = cost / (1 - margin);
    const finalPrice = Math.ceil(rawPrice * 100) / 100;
    const netProfit = finalPrice - cost;
    const netProfitPct = finalPrice > 0 ? (netProfit / finalPrice) * 100 : 0;
    return { cost, marginTier: `${(margin * 100).toFixed(0)}%`, platformFees: 0, finalPrice, netProfit, netProfitPct };
  }, [getTopupMargin]);

  return { rules, topupRules, settings, loading, fetchRules, getMargin, getTopupMargin, calculate, calculateTopup };
};

