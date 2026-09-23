import { useEffect, useState } from "react";
import { History } from "lucide-react";
import GameCard from "@/components/GameCard";
import SectionBanner from "@/components/SectionBanner";
import { useCart } from "@/hooks/useCart";
import { getRecentlyViewed, RecentlyViewedItem } from "@/lib/recentlyViewed";
import { supabase } from "@/integrations/supabase/client";
import recentlyViewedBanner from "@/assets/banners/recently-viewed.jpg";
import { useGameGroupMap, collapseByGameGroup } from "@/hooks/useGameGroupMap";

const RecentlyViewedSection = () => {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const { addItem } = useCart();
  const { data: groupMap } = useGameGroupMap();
  const displayItems = collapseByGameGroup(items, groupMap);

  useEffect(() => {
    const loadAndFilter = async () => {
      const recent = getRecentlyViewed().filter((i) => i.price > 0).slice(0, 20);
      if (recent.length === 0) return;

      const ids = recent.map((i) => i.id);
      const { data: existing } = await supabase
        .from("allowed_products")
        .select("id")
        .in("id", ids);

      const existingIds = new Set((existing || []).map((p: any) => p.id));
      const filtered = recent.filter((i) => existingIds.has(i.id)).slice(0, 10);

      if (filtered.length < recent.length) {
        const allRecent = getRecentlyViewed();
        const cleaned = allRecent.filter((i) => existingIds.has(i.id));
        try {
          localStorage.setItem("agevers_recently_viewed", JSON.stringify(cleaned));
        } catch {}
      }

      setItems(filtered);
    };
    loadAndFilter();
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <SectionBanner image={recentlyViewedBanner} title="RECENTLY VIEWED" icon={History} iconColor="bg-secondary" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {displayItems.map((item) => (
            <div key={item.id}>
              <GameCard
                id={item.id}
                title={item.title}
                platform={item.platform}
                slug={item.slug}
                price={item.price}
                image={item.image_url || "/placeholder.svg"}
                onAddToCart={(e) => {
                  e.stopPropagation();
                  addItem({
                    offerId: item.id,
                    title: item.title,
                    platform: item.platform,
                    price: item.price,
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

export default RecentlyViewedSection;
