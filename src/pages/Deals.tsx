import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GameCard from "@/components/GameCard";
import GameCardSkeleton from "@/components/GameCardSkeleton";
import { Flame, Zap } from "lucide-react";
import { useGameGroupMap, collapseByGameGroup } from "@/hooks/useGameGroupMap";

interface DealItem {
  id: string;
  title: string;
  image_url: string | null;
  platform: string;
  slug: string;
  sale_price: number;
  original_price: number | null;
  stock: number;
}

const fetchDeals = async (): Promise<DealItem[]> => {
  const { data } = await supabase
    .from("daily_deals")
    .select("sale_price, original_price, allowed_products!inner(id, title, image_url, platform, slug)")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (!data) return [];
  const ids = (data as any[]).map((d) => d.allowed_products.id);
  const [{ data: kData }, { data: keyData }] = await Promise.all([
    supabase.rpc("get_public_kinguin_by_ids", { _ids: ids }),
    (supabase as any)
      .from("product_keys")
      .select("allowed_product_id")
      .in("allowed_product_id", ids)
      .eq("status", "active"),
  ]);
  const kinguinPriceMap = new Map<string, number>();
  const kinguinStockMap = new Map<string, number>();
  if (kData) (kData as any[]).forEach((k: any) => {
    kinguinPriceMap.set(k.allowed_product_id, k.sell_price);
    kinguinStockMap.set(k.allowed_product_id, k.kinguin_stock ?? 0);
  });
  const manualStockMap = new Map<string, number>();
  (keyData as any[] | null)?.forEach((k: any) => {
    manualStockMap.set(k.allowed_product_id, (manualStockMap.get(k.allowed_product_id) || 0) + 1);
  });

  return (data as any[]).map((d: any) => ({
    id: d.allowed_products.id,
    title: d.allowed_products.title,
    image_url: d.allowed_products.image_url,
    platform: d.allowed_products.platform,
    slug: d.allowed_products.slug,
    sale_price: d.sale_price,
    // Always prefer the live site price so the "original" reflects current pricing.
    original_price: kinguinPriceMap.get(d.allowed_products.id) ?? d.original_price ?? null,
    stock:
      (kinguinStockMap.get(d.allowed_products.id) || 0) +
      (manualStockMap.get(d.allowed_products.id) || 0),
  }));
};

const Deals = () => {
  const { data: rawDeals = [], isLoading } = useQuery({ queryKey: ["deals-page"], queryFn: fetchDeals });
  const { data: groupMap } = useGameGroupMap();
  const deals = collapseByGameGroup(rawDeals, groupMap);
  const { addItem } = useCart();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Deals of the Day — Discounted Game Keys | Agever's";
    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };
    const desc = "Today's hottest game key deals — limited stock, deep discounts on Steam, Xbox, PlayStation and more. Grab them before they're gone.";
    setMeta("description", desc);
    setMeta("og:title", "Deals of the Day | Agever's", "property");
    setMeta("og:description", desc, "property");
    setMeta("og:url", "https://agevers.com/deals", "property");
    setMeta("og:type", "website", "property");
    setLink("canonical", "https://agevers.com/deals");
    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/15 text-destructive border border-destructive/30 mb-4">
            <Flame className="h-5 w-5 animate-pulse" />
            <span className="text-sm font-bold uppercase tracking-[0.2em]">Limited time</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black mb-3">Deals of the Day</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Hand-picked discounts on top game keys, gift cards and DLC. Stock is limited — once these sell out, they're gone.
          </p>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 10 }).map((_, i) => <GameCardSkeleton key={i} />)}
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No active deals right now. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {deals.map((deal) => (
              <div key={deal.id} className="relative">
                <GameCard
                  id={deal.id}
                  title={deal.title}
                  platform={deal.platform}
                  slug={deal.slug}
                  price={deal.sale_price}
                  originalPrice={
                    deal.original_price && deal.original_price > deal.sale_price ? deal.original_price : undefined
                  }
                  image={deal.image_url || "/placeholder.svg"}
                  stock={deal.stock}
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
                {deal.stock > 0 && deal.stock <= 10 && (
                  <span className="pointer-events-none absolute top-2 right-2 z-20 rounded-md px-2 py-0.5 text-[11px] font-black tracking-wide shadow-md bg-destructive text-destructive-foreground animate-pulse">
                    Only {deal.stock} left
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Deals;