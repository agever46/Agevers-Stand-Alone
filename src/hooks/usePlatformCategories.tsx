import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PLATFORM_CATEGORIES as STATIC_CATEGORIES,
  type PlatformCategory,
} from "@/lib/platformConfig";

/**
 * Loads Platform / Store options dynamically from `nav_menu_items`
 * so admin can add/edit/remove categories without code changes.
 * Falls back to the static `platformConfig` list while loading or on error.
 */
export function usePlatformCategories() {
  const { data } = useQuery({
    queryKey: ["platform-categories-nav"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlatformCategory[]> => {
      const { data, error } = await supabase
        .from("nav_menu_items")
        .select("id, name, href, parent_id, display_order, is_visible")
        .eq("is_visible", true)
        .order("display_order", { ascending: true });
      if (error || !data) return STATIC_CATEGORIES;

      const tops = data.filter((r) => !r.parent_id);
      return tops.map((t) => {
        const subs = data.filter((r) => r.parent_id === t.id);
        return {
          name: t.name,
          href: t.href,
          subcategories: subs.length
            ? subs.map((s) => ({ name: s.name, href: s.href }))
            : undefined,
        };
      });
    },
  });

  const categories = data && data.length ? data : STATIC_CATEGORIES;

  const subPlatformMap: Record<string, string[]> = Object.fromEntries(
    categories.map((c) => [
      c.name,
      c.subcategories?.map((s) => s.name) ?? [c.name],
    ])
  );

  const getSubPlatforms = (platform: string): string[] =>
    subPlatformMap[platform] || subPlatformMap[categories[0]?.name] || [];

  return { categories, subPlatformMap, getSubPlatforms };
}