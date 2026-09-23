import { TrendingUp, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import GameCard from "@/components/GameCard";
import GameCardSkeleton from "@/components/GameCardSkeleton";
import SectionBanner from "@/components/SectionBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import trendingBanner from "@/assets/banners/trending_new.jpg";
import newReleasesBanner from "@/assets/banners/new_releases_new.jpg";
import { useGameGroupMap, collapseByGameGroup } from "@/hooks/useGameGroupMap";

interface ProductItem {
  id: string;
  title: string;
  image_url: string | null;
  platform: string;
  slug: string;
  sell_price: number;
  kinguin_stock: number | null;
  release_date?: string | null;
}

const fetchTrending = async (): Promise<ProductItem[]> => {
  // Get a pool of allowed products with images, then fetch their public kinguin offers via RPC
  const { data: aps } = await supabase
    .from("allowed_products")
    .select("id, title, image_url, platform, slug, sold_count, release_date")
    .not("image_url", "is", null)
    .order("sold_count", { ascending: false })
    .limit(60);
  if (!aps || aps.length === 0) return [];

  const ids = aps.map((a: any) => a.id);
  const { data: offers } = await supabase.rpc("get_public_kinguin_by_ids" as any, { _ids: ids });
  if (!offers || !Array.isArray(offers)) return [];

  const apMap = new Map(aps.map((a: any) => [a.id, a]));
  return (offers as any[])
    .filter((o) => o.is_active && (o.kinguin_stock ?? 0) > 0 && apMap.has(o.allowed_product_id))
    .sort((a, b) => (b.kinguin_stock ?? 0) - (a.kinguin_stock ?? 0))
    .slice(0, 10)
    .map((o) => {
      const ap: any = apMap.get(o.allowed_product_id);
      return {
        id: ap.id,
        title: ap.title,
        image_url: ap.image_url,
        platform: ap.platform,
        slug: ap.slug,
        sell_price: Number(o.sell_price),
        kinguin_stock: o.kinguin_stock,
        release_date: ap.release_date ?? null,
      };
    });
};

export const TrendingSection = () => {
  const { data: rawItems = [], isLoading } = useQuery({ queryKey: ["home-trending"], queryFn: fetchTrending });
  const { data: groupMap } = useGameGroupMap();
  const items = collapseByGameGroup(rawItems, groupMap);
  const { addItem } = useCart();

  if (isLoading) return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <Skeleton className="h-16 w-full rounded-xl mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <GameCardSkeleton key={i} />)}
        </div>
      </div>
    </section>
  );

  if (items.length === 0) return null;

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <SectionBanner image={trendingBanner} title="TRENDING" icon={TrendingUp} iconColor="bg-primary" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((item) => {
            const displayPrice = item.sell_price;
            return (
              <div key={item.id}>
                <GameCard
                  id={item.id}
                  title={item.title}
                  platform={item.platform}
                  slug={item.slug}
                  price={displayPrice}
                  releaseDate={item.release_date}
                  image={item.image_url || "/placeholder.svg"}
                  onAddToCart={(e) => {
                    e.stopPropagation();
                    addItem({
                      offerId: item.id,
                      title: item.title,
                      platform: item.platform,
                      price: displayPrice,
                      sellerName: "Agevers",
                      image_url: item.image_url,
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const fetchNewReleases = async (): Promise<ProductItem[]> => {
  const nowIso = new Date().toISOString();
  const { data: aps } = await supabase
    .from("allowed_products")
    .select("id, title, image_url, platform, slug, release_date")
    .not("image_url", "is", null)
    .gte("release_date", "2026-01-01")
    .lt("release_date", "2027-01-01")
    .lte("release_date", nowIso)
    .order("release_date", { ascending: false })
    .limit(40);
  if (!aps || aps.length === 0) return [];

  const ids = aps.map((a: any) => a.id);
  const { data: offers } = await supabase.rpc("get_public_kinguin_by_ids" as any, { _ids: ids });
  if (!offers || !Array.isArray(offers)) return [];

  const apMap = new Map(aps.map((a: any) => [a.id, a]));
  const offerByAp = new Map((offers as any[]).map((o) => [o.allowed_product_id, o]));

  return aps
    .map((ap: any) => {
      const o: any = offerByAp.get(ap.id);
      if (!o || !o.is_active || (o.kinguin_stock ?? 0) <= 0) return null;
      return {
        id: ap.id,
        title: ap.title,
        image_url: ap.image_url,
        platform: ap.platform,
        slug: ap.slug,
        sell_price: Number(o.sell_price),
        kinguin_stock: o.kinguin_stock,
        release_date: ap.release_date ?? null,
      };
    })
    .filter(Boolean)
    .slice(0, 10) as ProductItem[];
};

export const NewReleasesSection = () => {
  const { data: rawItems = [], isLoading } = useQuery({ queryKey: ["home-new-releases"], queryFn: fetchNewReleases });
  const { data: groupMap } = useGameGroupMap();
  const items = collapseByGameGroup(rawItems, groupMap);
  const { addItem } = useCart();

  if (isLoading) return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <Skeleton className="h-16 w-full rounded-xl mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <GameCardSkeleton key={i} />)}
        </div>
      </div>
    </section>
  );

  if (items.length === 0) return null;

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <SectionBanner image={newReleasesBanner} title="NEW RELEASES" icon={Sparkles} iconColor="gradient-primary" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((item) => {
            const displayPrice = item.sell_price;
            return (
              <div key={item.id}>
                <GameCard
                  id={item.id}
                  title={item.title}
                  platform={item.platform}
                  slug={item.slug}
                  price={displayPrice}
                  releaseDate={item.release_date}
                  image={item.image_url || "/placeholder.svg"}
                  onAddToCart={(e) => {
                    e.stopPropagation();
                    addItem({
                      offerId: item.id,
                      title: item.title,
                      platform: item.platform,
                      price: displayPrice,
                      sellerName: "Agevers",
                      image_url: item.image_url,
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
