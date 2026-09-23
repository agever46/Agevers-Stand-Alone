import { Trophy, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import GameCard from "@/components/GameCard";
import GameCardSkeleton from "@/components/GameCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import SectionBanner from "@/components/SectionBanner";
import { useCart } from "@/hooks/useCart";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import bestsellersBanner from "@/assets/banners/bestsellers_new.jpg";
import { useGameGroupMap, collapseByGameGroup } from "@/hooks/useGameGroupMap";

interface BestsellerProduct {
  id: string;
  title: string;
  platform: string;
  image_url: string;
  region: string;
  slug: string;
  badges: string[] | null;
  sold_count: number;
  sell_price: number;
  release_date?: string | null;
}

const fetchBestsellers = async (): Promise<BestsellerProduct[]> => {
  const { data: ap } = await supabase
    .from("allowed_products")
    .select("id, title, platform, image_url, region, badges, sold_count, slug, release_date")
    .order("sold_count", { ascending: false })
    .limit(30);

  if (!ap || ap.length === 0) return [];

  const ids = ap.map((p) => p.id);
  const [{ data: kp }, { data: mkCounts }] = await Promise.all([
    supabase.rpc("get_public_kinguin_by_ids", { _ids: ids }),
    supabase.rpc("get_manual_key_counts"),
  ]);

  const priceMap = new Map<string, number>();
  kp?.forEach((k: any) => priceMap.set(k.allowed_product_id, k.sell_price));

  const manualSet = new Set<string>();
  mkCounts?.forEach((m: any) => manualSet.add(m.allowed_product_id));

  return ap
    .filter((p) => priceMap.has(p.id) || manualSet.has(p.id))
    .map((p) => ({
      ...p,
      sell_price: priceMap.get(p.id) || 0,
    }))
    .slice(0, 10);
};

const BestsellersSection = () => {
  const { data: rawProducts = [], isLoading } = useQuery({ queryKey: ["home-bestsellers"], queryFn: fetchBestsellers });
  const { data: groupMap } = useGameGroupMap();
  const products = collapseByGameGroup(rawProducts, groupMap);
  const { addItem } = useCart();

  if (isLoading) return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <Skeleton className="h-16 w-full rounded-xl mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <GameCardSkeleton key={i} />)}
        </div>
      </div>
    </section>
  );

  if (products.length === 0) return null;

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <SectionBanner image={bestsellersBanner} title="BESTSELLERS" icon={Trophy} iconColor="bg-[hsl(var(--neon-gold))]">
          <Link
            to="/search?sort=bestsellers"
            className="text-sm text-white hover:text-white/80 font-display tracking-wide flex items-center gap-1 drop-shadow-lg"
          >
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </SectionBanner>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {products.map((product) => (
            <div key={product.id}>
              <GameCard
                id={product.id}
                title={product.title}
                platform={product.platform}
                slug={product.slug}
                price={product.sell_price}
                image={product.image_url || "/placeholder.svg"}
                badges={product.badges || undefined}
                releaseDate={(product as any).release_date}
                region={product.region}
                soldCount={product.sold_count}
                onAddToCart={(e) => {
                  e.stopPropagation();
                  addItem({
                    offerId: product.id,
                    title: product.title,
                    platform: product.platform,
                    price: product.sell_price,
                    sellerName: "Agevers",
                    image_url: product.image_url,
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

export default BestsellersSection;
