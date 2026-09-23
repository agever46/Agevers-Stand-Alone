import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Flame, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DealItem {
  id: string;
  title: string;
  image_url: string | null;
  slug: string;
  sale_price: number;
  original_price: number | null;
  stock: number;
}

const fetchActiveDeals = async (): Promise<DealItem[]> => {
  const { data } = await supabase
    .from("daily_deals")
    .select("sale_price, original_price, allowed_products!inner(id, title, image_url, slug)")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const rows = (data || []) as any[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.allowed_products.id);

  const [{ data: kData }, { data: keyData }] = await Promise.all([
    supabase.rpc("get_public_kinguin_by_ids", { _ids: ids }),
    (supabase as any)
      .from("product_keys")
      .select("allowed_product_id")
      .in("allowed_product_id", ids)
      .eq("status", "active"),
  ]);

  const kinguinStock = new Map<string, number>();
  const kinguinPrice = new Map<string, number>();
  (kData as any[] | null)?.forEach((k) => {
    kinguinStock.set(k.allowed_product_id, k.kinguin_stock ?? 0);
    if (k.sell_price != null) kinguinPrice.set(k.allowed_product_id, k.sell_price);
  });
  const manualStock = new Map<string, number>();
  (keyData as any[] | null)?.forEach((k) => {
    manualStock.set(k.allowed_product_id, (manualStock.get(k.allowed_product_id) || 0) + 1);
  });

  return rows.map((row) => ({
    id: row.allowed_products.id,
    title: row.allowed_products.title,
    image_url: row.allowed_products.image_url,
    slug: row.allowed_products.slug,
    sale_price: row.sale_price,
    // Always reflect the live site price as the "original" so it stays in sync.
    original_price: kinguinPrice.get(row.allowed_products.id) ?? row.original_price,
    stock: (kinguinStock.get(row.allowed_products.id) || 0) + (manualStock.get(row.allowed_products.id) || 0),
  }));
};

export const useTopDailyDeal = () =>
  useQuery({
    queryKey: ["active-daily-deals-banner"],
    queryFn: fetchActiveDeals,
    staleTime: 60_000,
  });

const DealOfTheDayBanner = () => {
  const { data: deals } = useTopDailyDeal();
  if (!deals || deals.length === 0) return null;

  return (
    <div className="container mx-auto px-4 py-4 md:py-6 flex justify-center animate-in fade-in slide-in-from-top-2 duration-500">
      <Link
        to="/deals"
        className="inline-block max-w-full group relative overflow-hidden rounded-3xl border-2 border-destructive/60 bg-gradient-to-r from-destructive/30 via-orange-500/20 to-background hover:border-destructive hover:shadow-destructive/40 transition-all shadow-2xl shadow-destructive/30"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-destructive/30 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-orange-500/30 blur-3xl pointer-events-none" />

        <div className="relative px-4 md:px-8 py-5 md:py-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-destructive uppercase tracking-[0.2em]">
                <Flame className="h-4 w-4 animate-pulse" /> Deal of the Day
              </div>
              <h2 className="font-display text-2xl md:text-4xl font-black text-foreground leading-tight">
                The Hottest Deals On Agevers
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-destructive group-hover:translate-x-1 transition-transform">
              See all deals <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          <div className="flex flex-wrap justify-start gap-3 md:gap-4 pb-1 -mx-1 px-1">
            {deals.map((d) => {
              const discountPct =
                d.original_price && d.original_price > d.sale_price
                  ? Math.round(((d.original_price - d.sale_price) / d.original_price) * 100)
                  : null;
              return (
                <div key={d.id} className="shrink-0 w-28 md:w-36 group/card">
                  <div className="relative overflow-hidden rounded-xl border-2 border-destructive/40 shadow-lg shadow-destructive/30 bg-black/40 aspect-[3/4]">
                    {d.image_url ? (
                      <img
                        src={d.image_url}
                        alt={d.title}
                        loading="lazy"
                        className="h-full w-full object-contain group-hover/card:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-destructive/20 text-destructive">
                        <Flame className="h-8 w-8" />
                      </div>
                    )}
                    {discountPct && (
                      <span className="absolute top-1.5 left-1.5 rounded-md bg-destructive px-1.5 py-0.5 text-[10px] md:text-xs font-black text-destructive-foreground shadow-md">
                        -{discountPct}%
                      </span>
                    )}
                    {d.stock === 0 ? (
                      <span className="absolute bottom-1.5 left-1.5 right-1.5 text-center rounded-md px-1.5 py-0.5 text-[10px] md:text-xs font-black tracking-wide shadow-md bg-muted/90 text-muted-foreground">
                        Out of stock
                      </span>
                    ) : d.stock <= 10 ? (
                      <span className="absolute bottom-1.5 left-1.5 right-1.5 text-center rounded-md px-1.5 py-0.5 text-[10px] md:text-xs font-black tracking-wide shadow-md bg-destructive/90 text-destructive-foreground animate-pulse">
                        Only {d.stock} left
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-xs md:text-sm font-semibold text-foreground line-clamp-2 leading-tight">
                    {d.title}
                  </p>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-sm md:text-base font-black text-destructive tabular-nums">
                      €{d.sale_price.toFixed(2)}
                    </span>
                    {d.original_price && d.original_price > d.sale_price && (
                      <span className="text-[10px] md:text-xs text-muted-foreground line-through">
                        €{d.original_price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Link>
    </div>
  );
};

export default DealOfTheDayBanner;