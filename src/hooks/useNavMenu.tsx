import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NavMenuItem {
  id: string;
  name: string;
  href: string;
  parent_id: string | null;
  display_order: number;
  is_visible: boolean;
  filter_keywords?: string[];
}

export interface NavCategory {
  id: string;
  name: string;
  href: string;
  is_visible: boolean;
  display_order: number;
  subcategories?: NavSubCategory[];
}

export interface NavSubCategory {
  id: string;
  name: string;
  href: string;
  is_visible: boolean;
  display_order: number;
  filter_keywords?: string[];
  subcategories?: { id: string; name: string; href: string; is_visible: boolean; display_order: number; filter_keywords?: string[] }[];
}

// Module-level cache to avoid repeated DB scans across components/mounts
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min — nav menu rarely changes
let cachedCategories: NavCategory[] | null = null;
let cacheTimestamp = 0;
let inflight: Promise<NavCategory[]> | null = null;
const subscribers = new Set<(c: NavCategory[]) => void>();

const fetchNavMenu = async (): Promise<NavCategory[]> => {
  const { data } = await supabase
    .from("nav_menu_items")
    .select("id, name, href, parent_id, display_order, is_visible, filter_keywords")
    .order("display_order", { ascending: true });

  if (!data) return [];

  const items = data as NavMenuItem[];
  const topLevel = items.filter((i) => !i.parent_id);
  return topLevel.map((t) => ({
    id: t.id,
    name: t.name,
    href: t.href,
    is_visible: t.is_visible,
    display_order: t.display_order,
    subcategories: items
      .filter((s) => s.parent_id === t.id)
      .sort((a, b) => a.display_order - b.display_order)
      .map((s) => ({
        id: s.id, name: s.name, href: s.href, is_visible: s.is_visible, display_order: s.display_order,
        filter_keywords: s.filter_keywords || [],
        subcategories: items
          .filter((gc) => gc.parent_id === s.id)
          .sort((a, b) => a.display_order - b.display_order)
          .map((gc) => ({ id: gc.id, name: gc.name, href: gc.href, is_visible: gc.is_visible, display_order: gc.display_order, filter_keywords: gc.filter_keywords || [] })),
      })),
  }));
};

const getNavMenu = async (force = false): Promise<NavCategory[]> => {
  const fresh = cachedCategories && Date.now() - cacheTimestamp < CACHE_TTL_MS;
  if (!force && fresh) return cachedCategories!;
  if (inflight) return inflight;
  inflight = fetchNavMenu()
    .then((cats) => {
      cachedCategories = cats;
      cacheTimestamp = Date.now();
      subscribers.forEach((cb) => cb(cats));
      return cats;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

export const useNavMenu = () => {
  const [categories, setCategories] = useState<NavCategory[]>(cachedCategories ?? []);
  const [loading, setLoading] = useState(!cachedCategories);

  useEffect(() => {
    let mounted = true;
    const cb = (c: NavCategory[]) => {
      if (mounted) setCategories(c);
    };
    subscribers.add(cb);
    if (!cachedCategories || Date.now() - cacheTimestamp >= CACHE_TTL_MS) {
      getNavMenu().then((c) => {
        if (mounted) {
          setCategories(c);
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }
    return () => {
      mounted = false;
      subscribers.delete(cb);
    };
  }, []);

  const refetch = useCallback(async () => {
    const c = await getNavMenu(true);
    setCategories(c);
  }, []);

  return { categories, loading, refetch };
};
