import { Clock, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { Link } from "react-router-dom";
import GameCard from "@/components/GameCard";
import GameCardSkeleton from "@/components/GameCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import SectionBanner from "@/components/SectionBanner";
import { useQuery } from "@tanstack/react-query";
import preOrdersBanner from "@/assets/banners/pre_orders_new.jpg";
import { useGameGroupMap, collapseByGameGroup } from "@/hooks/useGameGroupMap";

interface PreOrderProduct {
  id: string;
  title: string;
  platform: string;
  image_url: string;
  slug: string;
  release_date: string;
  sell_price: number;
}

const FETCH_LIMIT = 120;
const MAX_PREORDERS = 20;
const MAX_PER_SERIES = 2;

const PREORDER_NOISE_PATTERNS = [
  /\bpre-?order\b/gi,
  /\b(deluxe|ultimate|gold|complete|collector'?s|premium|pro|elite|standard|bundle|edition)\b/gi,
  /\b(dlc|collection|bonus)\b/gi,
  /\([^)]*\)/g,
  /\[[^\]]*\]/g,
  /\s*[-–—:]\s*(pc|xbox|xbox one|xbox series x\|s|xbox series|playstation|ps4|ps5|nintendo switch|switch|global|europe|united states|united kingdom).*$/i,
];

const normalizePreOrderTitle = (title: string) => {
  let normalized = title.toLowerCase();

  for (const pattern of PREORDER_NOISE_PATTERNS) {
    normalized = normalized.replace(pattern, " ");
  }

  return normalized.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
};

const getSeriesKey = (title: string) => {
  const tokens = normalizePreOrderTitle(title).split(" ").filter(Boolean);
  if (tokens.length <= 2) return tokens.join(" ");

  const secondToken = tokens[1] || "";
  return /^([ivxlcdm]+|\d+[a-z0-9-]*)$/i.test(secondToken)
    ? tokens.slice(0, 2).join(" ")
    : tokens.slice(0, 3).join(" ");
};

const getImageKey = (imageUrl: string) =>
  imageUrl
    .split("?")[0]
    .split("/")
    .pop()
    ?.replace(/\.[a-z0-9]+$/i, "")
    .replace(/(?:-|_)?(?:800|700|111|big|large|main|cover)$/gi, "")
    .toLowerCase()
    .trim() || "";

const fetchPreOrders = async (): Promise<PreOrderProduct[]> => {
  const { data: ap } = await supabase
    .from("allowed_products")
    .select("id, title, platform, image_url, release_date, badges, slug")
    .not("release_date", "is", null)
    .gt("release_date", new Date().toISOString())
    .order("release_date", { ascending: true })
    .limit(FETCH_LIMIT);

  if (!ap || ap.length === 0) return [];

  const ids = ap.map((p) => p.id);
  const { data: kp } = await supabase.rpc("get_public_kinguin_by_ids", { _ids: ids });

  const priceMap = new Map<string, number>();
  kp?.forEach((k: any) => priceMap.set(k.allowed_product_id, k.sell_price));

  const mapped = ap
    .filter((p) => priceMap.has(p.id))
    .map((p) => ({
      ...p,
      image_url: p.image_url || "/placeholder.svg",
      release_date: p.release_date!,
      sell_price: priceMap.get(p.id) || 0,
    }))
    .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime());

  // Deduplicate aggressively enough to prevent one franchise from flooding the shelf.
  const seen = new Set<string>();
  const seenImages = new Set<string>();
  const seriesCounts = new Map<string, number>();
  const unique: typeof mapped = [];
  for (const p of mapped) {
    const baseKey = `${normalizePreOrderTitle(p.title)}|${(p.platform || "").toLowerCase()}`;
    const imageKey = getImageKey(p.image_url);
    const seriesKey = getSeriesKey(p.title);
    const seriesCount = seriesCounts.get(seriesKey) || 0;

    if (!baseKey || seen.has(baseKey)) continue;
    if (imageKey && seenImages.has(imageKey)) continue;
    if (seriesKey && seriesCount >= MAX_PER_SERIES) continue;

    seen.add(baseKey);
    if (imageKey) seenImages.add(imageKey);
    if (seriesKey) seriesCounts.set(seriesKey, seriesCount + 1);
    unique.push(p);

    if (unique.length >= MAX_PREORDERS) break;
  }
  return unique;
};

const PreOrdersSection = () => {
  const { data: rawProducts = [], isLoading } = useQuery({ queryKey: ["home-preorders"], queryFn: fetchPreOrders });
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
        <SectionBanner image={preOrdersBanner} title="PRE-ORDERS" icon={Clock} iconColor="bg-orange-500">
          <Link
            to="/pre-order"
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
                image={product.image_url}
                badge="PRE-ORDER"
                releaseDate={product.release_date}
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

export default PreOrdersSection;
