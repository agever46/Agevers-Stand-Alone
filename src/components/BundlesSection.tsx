import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useNewAccountLimit } from "@/hooks/useNewAccountLimit";
import { useNavigate } from "react-router-dom";
import { Package, ArrowRight, ShoppingCart, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionBanner from "@/components/SectionBanner";
import { toast } from "sonner";

interface BundleProduct {
  id: string;
  title: string;
  image_url: string | null;
  platform: string;
  slug: string;
}

interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  discount_type: string;
  discount_value: number;
  created_at: string;
  products: (BundleProduct & { sell_price: number })[];
}

const BUNDLE_LIFETIME_DAYS = 14;

const getDaysLeft = (createdAt: string): number => {
  const created = new Date(createdAt).getTime();
  const expires = created + BUNDLE_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
  const ms = expires - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
};

const fetchBundles = async (): Promise<Bundle[]> => {
  const { data } = await supabase
    .from("bundles")
    .select("id, name, slug, description, image_url, discount_type, discount_value, created_at, bundle_products(allowed_product_id, display_order)")
    .eq("is_active", true)
    .order("display_order");

  if (!data || data.length === 0) return [];

  const allProductIds = (data as any[]).flatMap((b: any) =>
    (b.bundle_products || []).map((bp: any) => bp.allowed_product_id)
  );

  if (allProductIds.length === 0) return [];

  // Fetch product details + prices
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
      created_at: b.created_at,
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

const BundleCard = ({ bundle }: { bundle: Bundle }) => {
  const { addItem, total } = useCart();
  const { isLimited: isNewAccountLimited, limitEur: newAccountLimitEur } = useNewAccountLimit();
  const navigate = useNavigate();

  const totalOriginal = bundle.products.reduce((sum, p) => sum + p.sell_price, 0);

  const discount = bundle.discount_type === "percentage"
    ? totalOriginal * (bundle.discount_value / 100)
    : bundle.discount_value;

  const bundlePrice = Math.max(0, totalOriginal - discount);
  const savePct = Math.round((discount / totalOriginal) * 100);

  const addBundleToCart = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Add the whole bundle atomically: each product goes into the cart at
    // its own (undiscounted) sell_price, so check the cart-total impact
    // against that sum up front rather than letting some products in and
    // rejecting others mid-bundle.
    if (isNewAccountLimited && total + totalOriginal > newAccountLimitEur) {
      toast.error("Account Security Limit", {
        description: `Adding "${bundle.name}" would put your cart over €${newAccountLimitEur} — new accounts are limited to €${newAccountLimitEur} total in cart for the first 24 hours.`,
        duration: 6000,
      });
      return;
    }
    bundle.products.forEach((p) => {
      addItem({
        offerId: p.id,
        title: p.title,
        platform: p.platform,
        price: p.sell_price,
        sellerName: "Agevers",
        image_url: p.image_url,
      }, { silent: true }); // one summary toast below instead of one per product
    });
    toast.success(`${bundle.name} added to cart!`, {
      description: `${bundle.products.length} games · €${bundlePrice.toFixed(2)}`,
    });
  };

  return (
    <div
      onClick={() => addBundleToCart()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addBundleToCart(); } }}
      className="glass rounded-xl overflow-hidden transition-all group focus:outline-none focus:ring-2 focus:ring-primary/40 hover:border-primary/30 cursor-pointer"
      aria-label={`Add ${bundle.name} to cart`}
    >
      <div className="p-4 space-y-3">
      <div className="flex items-center gap-3 mb-1">
        {bundle.image_url ? (
          <img
            src={bundle.image_url}
            alt={bundle.name}
            className="w-14 h-14 rounded-lg object-cover border border-border/30 shrink-0 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <Package className="h-5 w-5 text-primary shrink-0" />
        )}
        <h3 className="font-display font-bold text-foreground text-sm flex-1">{bundle.name}</h3>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary shrink-0">
          SAVE {savePct}%
        </span>
      </div>

      {(() => {
        const daysLeft = getDaysLeft(bundle.created_at);
        const urgent = daysLeft <= 3;
        return (
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold w-fit ${urgent ? "bg-destructive/15 text-destructive" : "bg-muted/50 text-muted-foreground"}`}>
            <Clock className="h-3 w-3" />
            {daysLeft === 0 ? "Ends today" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`}
          </div>
        );
      })()}

      {bundle.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{bundle.description}</p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {bundle.products.map((p) => (
          <div key={p.id} className="shrink-0 w-20">
            <img
              src={p.image_url || "/placeholder.svg"}
              alt={p.title}
              className="w-20 h-28 object-cover rounded-lg border border-border/30"
            />
            <p className="text-[10px] text-muted-foreground mt-1 truncate">{p.title}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="text-xs text-muted-foreground line-through mr-2">€{totalOriginal.toFixed(2)}</span>
          <span className="text-lg font-display font-bold text-primary">€{bundlePrice.toFixed(2)}</span>
        </div>
        <Button size="sm" onClick={(e) => { e.stopPropagation(); addBundleToCart(); }} className="text-xs gap-1">
          <ShoppingCart className="h-3.5 w-3.5" />
          Add to Cart
        </Button>
      </div>
      </div>
    </div>
  );
};

export const BundlesSection = () => {
  const navigate = useNavigate();
  const { data: bundles = [] } = useQuery({ queryKey: ["bundles-home"], queryFn: fetchBundles });

  if (bundles.length === 0) return null;

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Bundle Deals
          </h2>
          <button
            onClick={() => navigate("/bundles")}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundles.slice(0, 3).map((b) => (
            <BundleCard key={b.id} bundle={b} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default BundlesSection;
