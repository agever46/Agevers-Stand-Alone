import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";
import { Sparkles } from "lucide-react";

interface FBTItem {
  id: string;
  title: string;
  platform: string;
  image_url: string | null;
  slug: string;
  sold_count: number;
  price?: number;
}

interface Props {
  productTitle: string;
  platform: string;
  currentProductId?: string;
}

const FrequentlyBoughtTogether = ({ productTitle, platform, currentProductId }: Props) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [items, setItems] = useState<FBTItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any).rpc("get_frequently_bought_together", {
        _product_title: productTitle,
        _platform: platform,
        _limit: 6,
      });
      if (cancelled) return;
      if (error || !data) {
        setItems([]);
        setLoading(false);
        return;
      }
      const filtered = (data as FBTItem[]).filter((i) => i.id !== currentProductId).slice(0, 4);
      // Fetch prices for these products from kinguin_products
      if (filtered.length > 0) {
        const ids = filtered.map((i) => i.id);
        const { data: prices } = await supabase.rpc("get_public_kinguin_by_ids" as any, { _ids: ids });
        const priceMap = new Map<string, number>();
        ((prices as any[]) || []).forEach((p: any) => {
          if (!p.is_active) return;
          const sp = Number(p.sell_price);
          if (!priceMap.has(p.allowed_product_id) || sp < (priceMap.get(p.allowed_product_id) || Infinity)) {
            priceMap.set(p.allowed_product_id, sp);
          }
        });
        filtered.forEach((i) => { i.price = priceMap.get(i.id); });
      }
      setItems(filtered);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [productTitle, platform, currentProductId]);

  if (loading || items.length === 0) return null;

  return (
    <section className="mt-12 glass rounded-xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-black tracking-wider text-foreground uppercase">
          Frequently Bought Together
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(`/product/${item.slug || item.id}`)}
            className="group flex flex-col text-left rounded-lg overflow-hidden bg-secondary/30 hover:bg-secondary/60 transition-colors"
          >
            <div className="relative aspect-[801/700] overflow-hidden bg-background">
              {item.image_url && (
                <>
                  <img src={item.image_url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40" />
                  <img src={item.image_url} alt={item.title} loading="lazy" className="absolute inset-0 w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
                </>
              )}
            </div>
            <div className="p-3 flex flex-col flex-1">
              <p className="text-[10px] font-display tracking-widest uppercase text-primary mb-1 font-bold">{item.platform}</p>
              <h3 className="font-display text-xs font-semibold text-foreground line-clamp-2 mb-2 min-h-[2rem]">{item.title}</h3>
              {item.price !== undefined && (
                <span className="mt-auto font-display text-sm font-bold text-primary">{formatPrice(item.price)}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default FrequentlyBoughtTogether;