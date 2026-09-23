import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";

const fetchAllBundles = async () => {
  const { data } = await supabase
    .from("bundles")
    .select("id, name, slug, description, image_url, discount_type, discount_value, bundle_products(allowed_product_id, display_order)")
    .eq("is_active", true)
    .order("display_order");

  if (!data || data.length === 0) return [];

  const allProductIds = (data as any[]).flatMap((b: any) =>
    (b.bundle_products || []).map((bp: any) => bp.allowed_product_id)
  );

  if (allProductIds.length === 0) return [];

  const { data: products } = await supabase
    .from("allowed_products")
    .select("id, title, image_url, platform, slug")
    .in("id", allProductIds);

  const { data: prices } = await supabase.rpc("get_public_kinguin_by_ids" as any, { _ids: allProductIds });

  const productMap = new Map((products || []).map((p) => [p.id, p]));
  const priceMap = new Map(
    ((prices as any[]) || [])
      .filter((p: any) => p.is_active)
      .map((p: any) => [p.allowed_product_id, p])
  );

  return (data as any[])
    .map((b: any) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      description: b.description,
      image_url: b.image_url,
      discount_type: b.discount_type,
      discount_value: b.discount_value,
      products: (b.bundle_products || [])
        .map((bp: any) => {
          const prod = productMap.get(bp.allowed_product_id);
          const price = priceMap.get(bp.allowed_product_id);
          if (!prod || !price) return null;
          return { ...prod, sell_price: Number(price.sell_price) };
        })
        .filter(Boolean),
    }))
    .filter((b: any) => b.products.length >= 2);
};

const Bundles = () => {
  const { data: bundles = [], isLoading } = useQuery({ queryKey: ["bundles-all"], queryFn: fetchAllBundles });
  const { addItem } = useCart();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          Bundle Deals
        </h1>
        <p className="text-muted-foreground mb-8">Save more when you buy together! Curated game bundles at special prices.</p>

        {isLoading ? (
          <p className="text-muted-foreground">Loading bundles...</p>
        ) : bundles.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No bundles available right now. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bundles.map((b: any) => {
              const totalOriginal = b.products.reduce((sum: number, p: any) => {
                return sum + p.sell_price;
              }, 0);
              const discount = b.discount_type === "percentage"
                ? totalOriginal * (b.discount_value / 100)
                : b.discount_value;
              const bundlePrice = Math.max(0, totalOriginal - discount);
              const savePct = Math.round((discount / totalOriginal) * 100);

              return (
                <div key={b.id} className="glass rounded-xl p-5 space-y-4 hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <h2 className="font-display font-bold text-foreground">{b.name}</h2>
                    <span className="ml-auto inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/20 text-primary">
                      SAVE {savePct}%
                    </span>
                  </div>

                  {b.description && <p className="text-sm text-muted-foreground">{b.description}</p>}

                  <div className="grid grid-cols-3 gap-2">
                    {b.products.map((p: any) => (
                      <div
                        key={p.id}
                        onClick={() => navigate(`/product/${p.slug}`)}
                        className="cursor-pointer"
                      >
                        <img
                          src={p.image_url || "/placeholder.svg"}
                          alt={p.title}
                          className="w-full aspect-[3/4] object-cover rounded-lg border border-border/30 hover:border-primary/50 transition-all"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">{p.title}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <div>
                      <span className="text-sm text-muted-foreground line-through mr-2">€{totalOriginal.toFixed(2)}</span>
                      <span className="text-xl font-display font-bold text-primary">€{bundlePrice.toFixed(2)}</span>
                    </div>
                    <Button
                      onClick={() => {
                        b.products.forEach((p: any) => {
                          addItem({
                            offerId: p.id,
                            title: p.title,
                            platform: p.platform,
                            price: p.sell_price,
                            sellerName: "Agevers",
                            image_url: p.image_url,
                          });
                        });
                      }}
                    >
                      Add Bundle to Cart
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Bundles;
