import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import GameCard from "@/components/GameCard";
import SectionBanner from "@/components/SectionBanner";
import { getRecentlyViewed } from "@/lib/recentlyViewed";
import { useQuery } from "@tanstack/react-query";
import justForYouBanner from "@/assets/banners/just-for-you.jpg";
import { useGameGroupMap, collapseByGameGroup } from "@/hooks/useGameGroupMap";

interface ProductItem {
  id: string;
  title: string;
  image_url: string | null;
  platform: string;
  slug: string;
  sell_price: number;
  release_date: string | null;
}

const JustForYouSection = () => {
  const { addItem } = useCart();

  const recent = useMemo(() => getRecentlyViewed(), []);
  const platforms = useMemo(() => [...new Set(recent.map((r) => r.platform))].slice(0, 3), [recent]);
  const viewedIds = useMemo(() => new Set(recent.map((r) => r.id)), [recent]);

  const { data: rawItems = [] } = useQuery({
    queryKey: ["home-just-for-you", platforms.join(",")],
    queryFn: async (): Promise<ProductItem[]> => {
      if (platforms.length === 0) return [];

      const { data: aps } = await supabase
        .from("allowed_products")
        .select("id, title, image_url, platform, slug, release_date")
        .not("image_url", "is", null)
        .in("platform", platforms)
        .limit(120);
      if (!aps || aps.length === 0) return [];

      const ids = aps.map((a: any) => a.id);
      const { data: offers } = await supabase.rpc("get_public_kinguin_by_ids" as any, { _ids: ids });
      if (!offers || !Array.isArray(offers)) return [];

      const offerByAp = new Map((offers as any[]).map((o) => [o.allowed_product_id, o]));
      const mapped = aps
        .map((ap: any) => {
          const o: any = offerByAp.get(ap.id);
          if (!o || !o.is_active || (o.kinguin_stock ?? 0) <= 0) return null;
          return {
            id: ap.id,
            title: ap.title,
            image_url: ap.image_url,
            platform: ap.platform,
            slug: ap.slug,
            release_date: ap.release_date ?? null,
            sell_price: Number(o.sell_price),
          };
        })
        .filter((p): p is ProductItem => !!p && !viewedIds.has(p.id));

      return mapped.sort(() => Math.random() - 0.5).slice(0, 10);
    },
    enabled: platforms.length > 0,
  });
  const { data: groupMap } = useGameGroupMap();
  const items = collapseByGameGroup(rawItems, groupMap);

  if (items.length === 0) return null;

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <SectionBanner image={justForYouBanner} title="JUST FOR YOU" icon={Sparkles} iconColor="gradient-primary" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.id}>
              <GameCard
                id={item.id}
                title={item.title}
                platform={item.platform}
                slug={item.slug}
                price={item.sell_price}
                releaseDate={item.release_date}
                image={item.image_url || "/placeholder.svg"}
                onAddToCart={(e) => {
                  e.stopPropagation();
                  addItem({
                    offerId: item.id,
                    title: item.title,
                    platform: item.platform,
                    price: item.sell_price,
                    sellerName: "Agevers",
                    image_url: item.image_url,
                  });
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default JustForYouSection;
