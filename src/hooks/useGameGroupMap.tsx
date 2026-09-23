import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GameGroupInfo {
  group_id: string;
  slug: string;
  title: string;
  image_url: string | null;
}

/**
 * Returns a Map<allowed_product_id, GameGroupInfo> for all active game groups.
 * Used to collapse multiple product variants into a single group tile.
 */
export const useGameGroupMap = () => {
  return useQuery({
    queryKey: ["game-group-map"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const map = new Map<string, GameGroupInfo>();
      const { data: groups } = await supabase
        .from("game_groups")
        .select("id, slug, title, image_url, is_active")
        .eq("is_active", true);
      if (!groups || groups.length === 0) return map;
      const groupById = new Map(groups.map((g: any) => [g.id, g]));
      const { data: items } = await supabase
        .from("game_group_items")
        .select("group_id, allowed_product_id")
        .in("group_id", groups.map((g: any) => g.id));
      (items || []).forEach((it: any) => {
        const g: any = groupById.get(it.group_id);
        if (!g) return;
        map.set(it.allowed_product_id, {
          group_id: g.id,
          slug: g.slug,
          title: g.title,
          image_url: g.image_url,
        });
      });
      return map;
    },
  });
};

/**
 * Collapse a product list so that products belonging to the same game group
 * appear only once (as a group tile). Preserves the position of the first
 * occurrence of each group.
 */
export function collapseByGameGroup<T extends { id: string; title: string; image_url?: string | null; slug?: string }>(
  products: T[],
  groupMap: Map<string, GameGroupInfo> | undefined,
): T[] {
  if (!groupMap || groupMap.size === 0) return products;
  const seenGroups = new Set<string>();
  const out: T[] = [];
  for (const p of products) {
    const info = groupMap.get(p.id);
    if (!info) {
      out.push(p);
      continue;
    }
    if (seenGroups.has(info.group_id)) continue;
    seenGroups.add(info.group_id);
    out.push({
      ...p,
      title: info.title,
      image_url: info.image_url || p.image_url,
      slug: `__game__/${info.slug}`,
    });
  }
  return out;
}