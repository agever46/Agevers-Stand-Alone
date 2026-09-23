import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { Heart, Trash2, ShoppingCart, TrendingDown, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AgeversLoader from "@/components/AgeversLoader";
import { useCurrency } from "@/hooks/useCurrency";
import { useWishlist } from "@/hooks/useWishlist";

interface WishlistItem {
  id: string;
  game_title: string;
  platform: string;
  image_url: string | null;
  price: number | null;
  created_at: string;
  price_at_add: number | null;
  allowed_product_id: string | null;
  current_price?: number | null;
  in_stock?: boolean;
  slug?: string | null;
}

const SellerFavorites = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();
  const { refresh: refreshWishlistGlobal } = useWishlist();
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchWishlist();
  }, [user]);

  const fetchWishlist = async () => {
    setLoading(true);
    const { data: items } = await supabase
      .from("wishlist")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    if (!items) { setWishlist([]); setLoading(false); return; }

    // Pull current prices + slug from allowed_products + kinguin_products
    const productIds = items.map((i: any) => i.allowed_product_id).filter(Boolean);
    let priceMap = new Map<string, { price: number; stock: number; slug: string | null }>();
    if (productIds.length > 0) {
      const { data: kp } = await supabase.rpc("get_public_kinguin_by_ids" as any, { _ids: productIds });
      const { data: ap } = await supabase
        .from("allowed_products")
        .select("id, slug")
        .in("id", productIds);
      const slugMap = new Map((ap || []).map((p: any) => [p.id, p.slug]));
      ((kp as any[]) || []).forEach((k: any) => {
        if (!k.is_active) return;
        priceMap.set(k.allowed_product_id, {
          price: Number(k.sell_price),
          stock: k.kinguin_stock ?? 0,
          slug: slugMap.get(k.allowed_product_id) || null,
        });
      });
      // For products without a kinguin row, still fill slug
      (ap || []).forEach((p: any) => {
        if (!priceMap.has(p.id)) {
          priceMap.set(p.id, { price: 0, stock: 0, slug: p.slug });
        }
      });
    }

    const enriched = items.map((i: any) => {
      const cur = i.allowed_product_id ? priceMap.get(i.allowed_product_id) : null;
      return {
        ...i,
        current_price: cur?.price ?? i.price,
        in_stock: (cur?.stock ?? 0) > 0 || !i.allowed_product_id,
        slug: cur?.slug ?? null,
      } as WishlistItem;
    });
    setWishlist(enriched);
    setLoading(false);
  };

  const removeFromWishlist = async (id: string) => {
    const { error } = await supabase.from("wishlist").delete().eq("id", id);
    if (error) {
      toast.error("Failed to remove item");
    } else {
      setWishlist(wishlist.filter((item) => item.id !== id));
      refreshWishlistGlobal();
      toast.success("Removed from wishlist");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <AgeversLoader />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-black tracking-wider text-foreground">FAVORITES</h2>
        <p className="text-muted-foreground text-sm mt-1">Your saved games and products</p>
      </div>

      <div className="space-y-4">
        {wishlist.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-body">Your wishlist is empty</p>
            <p className="text-sm text-muted-foreground/60 font-body mt-1">
              Games you save will appear here
            </p>
          </div>
        ) : (
          wishlist.map((item) => {
            const cur = item.current_price ?? item.price ?? 0;
            const baseline = item.price_at_add ?? item.price ?? cur;
            const dropPct = baseline > 0 && cur < baseline
              ? Math.round(((baseline - cur) / baseline) * 100)
              : 0;
            return (
            <div
              key={item.id}
              className="glass rounded-xl p-5 flex items-center gap-4 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
              onClick={() => {
                if (item.slug) navigate(`/product/${item.slug}`);
                else if (item.allowed_product_id) navigate(`/product/${item.allowed_product_id}`);
              }}
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.game_title}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h3 className="font-display text-sm font-semibold text-foreground">{item.game_title}</h3>
                <p className="text-xs text-muted-foreground font-body mt-1">
                  {item.platform} • Added {new Date(item.created_at).toLocaleDateString()}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {dropPct > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neon-green/15 text-neon-green border border-neon-green/30">
                      <TrendingDown className="h-3 w-3" />
                      Price dropped {dropPct}%
                    </span>
                  )}
                  {!item.in_stock && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
                      <AlertCircle className="h-3 w-3" />
                      Out of stock
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {cur > 0 && (
                  <div className="text-right">
                    <p className="font-display text-sm font-bold text-primary">{formatPrice(cur)}</p>
                    {dropPct > 0 && (
                      <p className="text-[10px] text-muted-foreground line-through">{formatPrice(baseline)}</p>
                    )}
                  </div>
                )}
                <Button
                  size="sm"
                  disabled={!item.in_stock}
                  className="font-display text-xs tracking-wider uppercase h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    addItem({
                      offerId: item.allowed_product_id || item.id,
                      title: item.game_title,
                      platform: item.platform,
                      price: cur,
                      sellerName: "Official Store",
                      image_url: item.image_url,
                    });
                    navigate("/checkout");
                  }}
                >
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Buy Now
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); removeFromWishlist(item.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SellerFavorites;
