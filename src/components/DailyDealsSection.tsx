import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import GameCard from "@/components/GameCard";
import GameCardSkeleton from "@/components/GameCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import SectionBanner from "@/components/SectionBanner";
import { Flame } from "lucide-react";
import dealsBanner from "@/assets/banners/deals_cyber_new.jpg";
import { useGameGroupMap, collapseByGameGroup } from "@/hooks/useGameGroupMap";

interface DealItem {
  id: string;
  title: string;
  image_url: string | null;
  platform: string;
  slug: string;
  sale_price: number;
  original_price: number | null;
}

const fetchDeals = async (): Promise<DealItem[]> => {
  const { data } = await supabase
    .from("daily_deals")
    .select("sale_price, original_price, allowed_products!inner(id, title, image_url, platform, slug)")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (!data) return [];

  const ids = data.map((d: any) => d.allowed_products.id);
  const { data: kData } = await supabase.rpc("get_public_kinguin_by_ids", { _ids: ids });

  const kinguinMap = new Map<string, number>();
  if (kData) {
    (kData as any[]).forEach((k: any) => {
      kinguinMap.set(k.allowed_product_id, k.sell_price);
    });
  }

  return data.map((d: any) => ({
    id: d.allowed_products.id,
    title: d.allowed_products.title,
    image_url: d.allowed_products.image_url,
    platform: d.allowed_products.platform,
    slug: d.allowed_products.slug,
    sale_price: d.sale_price,
    original_price: kinguinMap.get(d.allowed_products.id) ?? d.original_price ?? null,
  }));
};

const DailyDealsSection = () => {
  const { data: rawDeals = [], isLoading } = useQuery({ queryKey: ["daily-deals"], queryFn: fetchDeals });
  const { data: groupMap } = useGameGroupMap();
  const deals = collapseByGameGroup(rawDeals, groupMap);
  const { addItem } = useCart();

  if (isLoading) return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <Skeleton className="h-16 w-full rounded-xl mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <GameCardSkeleton key={i} />)}
        </div>
      </div>
    </section>
  );

  if (deals.length === 0) return null;

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <SectionBanner image={dealsBanner} title="HOT DEALS" icon={Flame} iconColor="bg-destructive" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {deals.map((deal) => (
            <div key={deal.id}>
              <GameCard
                id={deal.id}
                title={deal.title}
                platform={deal.platform}
                slug={deal.slug}
                price={deal.sale_price}
                originalPrice={deal.original_price && deal.original_price > deal.sale_price ? deal.original_price : undefined}
                image={deal.image_url || "/placeholder.svg"}
                onAddToCart={(e) => {
                  e.stopPropagation();
                  addItem({
                    offerId: deal.id,
                    title: deal.title,
                    platform: deal.platform,
                    price: deal.sale_price,
                    sellerName: "Agevers",
                    image_url: deal.image_url,
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

export default DailyDealsSection;
