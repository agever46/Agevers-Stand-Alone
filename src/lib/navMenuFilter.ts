/**
 * Dynamic Nav Menu Product Filtering
 * --------------------------------------------------
 * Each nav menu item can have:
 *   - filter_keywords: TEXT[]   → auto-match in title / description / badges
 *   - allowed_products has nav_menu_includes UUID[]  → manual add
 *   - allowed_products has nav_menu_excludes UUID[]  → manual exclude
 *
 * A product belongs to a nav menu item iff:
 *   (auto-keyword match  OR  manually included)
 *   AND NOT manually excluded.
 */
import { supabase } from "@/integrations/supabase/client";

export interface NavMenuFilterItem {
  id: string;
  href: string;
  filter_keywords: string[];
}

/**
 * Find a nav_menu_items row that matches a given URL path + tab query param.
 * Returns null if no match.
 */
export const findNavMenuItemForRoute = async (
  pathWithQuery: string
): Promise<NavMenuFilterItem | null> => {
  const { data } = await supabase
    .from("nav_menu_items")
    .select("id, href, filter_keywords")
    .eq("href", pathWithQuery)
    .maybeSingle();
  return (data as NavMenuFilterItem | null) ?? null;
};

/**
 * Apply a Supabase query filter for a given nav menu item.
 * Combines:
 *   - keyword match in title / description / badges
 *   - manual nav_menu_includes
 *   - manual nav_menu_excludes
 *
 * Pass any Postgrest filter builder for the `allowed_products` table.
 */
export const buildNavMenuOrFilter = (item: NavMenuFilterItem): string => {
  const kws = (item.filter_keywords || []).filter(Boolean);
  const orParts: string[] = [];
  // Manual include
  orParts.push(`nav_menu_includes.cs.{${item.id}}`);
  // Keyword match (case-insensitive ILIKE) on title + description + badges
  for (const kw of kws) {
    const safe = kw.replace(/[%,]/g, " ").trim();
    if (!safe) continue;
    orParts.push(`title.ilike.%${safe}%`);
    orParts.push(`description.ilike.%${safe}%`);
    orParts.push(`badges.cs.{${safe}}`);
  }
  return orParts.join(",");
};

/**
 * Filter an in-memory list of products by a nav menu item.
 * Use for client-side filtering on already-loaded product arrays.
 */
export const matchesNavMenuItem = (
  product: {
    id: string;
    title?: string | null;
    description?: string | null;
    badges?: string[] | null;
    nav_menu_includes?: string[] | null;
    nav_menu_excludes?: string[] | null;
  },
  item: NavMenuFilterItem
): boolean => {
  // Hard exclude wins
  if ((product.nav_menu_excludes || []).includes(item.id)) return false;
  // Manual include
  if ((product.nav_menu_includes || []).includes(item.id)) return true;
  // Keyword match
  const kws = (item.filter_keywords || []).map((k) => k.toLowerCase()).filter(Boolean);
  if (kws.length === 0) return false;
  const haystack = [
    product.title || "",
    product.description || "",
    ...(product.badges || []),
  ]
    .join(" ")
    .toLowerCase();
  return kws.some((k) => haystack.includes(k));
};

/**
 * Priority-based match score for a product against a nav menu item.
 * Higher score = higher priority in display order.
 *
 *   100 = manual include (highest)
 *    30 = keyword found in TITLE
 *    20 = keyword found in BADGES
 *    10 = keyword found in DESCRIPTION
 *     0 = no match (excluded from results)
 *    -1 = manually excluded
 *
 * Scan order: title → badges → description (first hit wins).
 */
export const navMenuMatchScore = (
  product: {
    id: string;
    title?: string | null;
    description?: string | null;
    badges?: string[] | null;
    nav_menu_includes?: string[] | null;
    nav_menu_excludes?: string[] | null;
  },
  item: NavMenuFilterItem
): number => {
  if ((product.nav_menu_excludes || []).includes(item.id)) return -1;
  if ((product.nav_menu_includes || []).includes(item.id)) return 100;
  const kws = (item.filter_keywords || []).map((k) => k.toLowerCase()).filter(Boolean);
  if (kws.length === 0) return 0;
  const title = (product.title || "").toLowerCase();
  if (kws.some((k) => title.includes(k))) return 30;
  const badges = (product.badges || []).map((b) => b.toLowerCase());
  if (kws.some((k) => badges.some((b) => b.includes(k)))) return 20;
  const desc = (product.description || "").toLowerCase();
  if (kws.some((k) => desc.includes(k))) return 10;
  return 0;
};

/**
 * Sort products by nav menu match priority (title > badges > description).
 * Products with score <= 0 are filtered out.
 */
export const sortByNavMenuPriority = <T extends {
  id: string;
  title?: string | null;
  description?: string | null;
  badges?: string[] | null;
  nav_menu_includes?: string[] | null;
  nav_menu_excludes?: string[] | null;
}>(products: T[], item: NavMenuFilterItem): T[] => {
  return products
    .map((p) => ({ p, score: navMenuMatchScore(p, item) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
};