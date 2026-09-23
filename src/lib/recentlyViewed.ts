const STORAGE_KEY = "agevers_recently_viewed";
const MAX_ITEMS = 20;

export interface RecentlyViewedItem {
  id: string;
  title: string;
  platform: string;
  image_url: string | null;
  price: number;
  slug?: string;
  viewedAt: number;
}

export const addRecentlyViewed = (item: Omit<RecentlyViewedItem, "viewedAt">) => {
  if (!item.price || item.price <= 0) return; // Don't track items without a valid price
  try {
    const existing = getRecentlyViewed();
    const filtered = existing.filter((i) => i.id !== item.id);
    filtered.unshift({ ...item, viewedAt: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)));
  } catch {}
};

export const getRecentlyViewed = (): RecentlyViewedItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentlyViewedItem[];
  } catch {
    return [];
  }
};

export const getRecentlyViewedPlatforms = (): string[] => {
  const items = getRecentlyViewed();
  const platforms = new Set(items.map((i) => i.platform));
  return Array.from(platforms);
};
