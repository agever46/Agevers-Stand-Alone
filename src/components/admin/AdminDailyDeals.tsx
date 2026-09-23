import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DailyDeal {
  id: string;
  allowed_product_id: string;
  sale_price: number;
  display_order: number;
  is_active: boolean;
  product_title?: string;
  product_image?: string | null;
  original_price?: number;
  live_kinguin_price?: number;
}

interface ProductCandidate {
  id: string;
  title: string;
  image_url: string | null;
  sell_price?: number;
  stock?: number;
}

const AdminDailyDeals = () => {
  const [deals, setDeals] = useState<DailyDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<ProductCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchDeals = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("daily_deals")
      .select("*, allowed_products(title, image_url)")
      .order("display_order", { ascending: true });

    if (data) {
      const ids = data.map((d: any) => d.allowed_product_id);
      const { data: kpData } = ids.length
        ? await supabase
            .from("kinguin_products")
            .select("allowed_product_id, sell_price")
            .in("allowed_product_id", ids)
        : { data: [] as any[] };
      const priceMap = new Map<string, number>();
      kpData?.forEach((kp: any) => priceMap.set(kp.allowed_product_id, kp.sell_price));

      setDeals(
        data.map((d: any) => ({
          id: d.id,
          allowed_product_id: d.allowed_product_id,
          sale_price: d.sale_price,
          display_order: d.display_order,
          is_active: d.is_active,
          product_title: d.allowed_products?.title,
          product_image: d.allowed_products?.image_url,
          original_price: d.original_price ?? undefined,
          live_kinguin_price: priceMap.get(d.allowed_product_id),
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const searchProducts = async (query: string) => {
    if (query.length < 2) { setCandidates([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("allowed_products")
      .select("id, title, image_url")
      .ilike("title", `%${query}%`)
      .not("image_url", "is", null)
      .limit(30);

    const ids = (data || []).map((p: any) => p.id);
    // Fetch live prices + sellable stock so we can exclude OOS products from the picker.
    const [kpRes, keyRes, variationRes] = ids.length > 0
      ? await Promise.all([
          supabase
            .from("kinguin_products")
            .select("allowed_product_id, sell_price, kinguin_stock")
            .in("allowed_product_id", ids)
            .eq("is_active", true)
            .gt("kinguin_stock", 0),
          (supabase as any)
            .from("product_keys")
            .select("allowed_product_id")
            .in("allowed_product_id", ids)
            .eq("status", "active"),
          (supabase as any)
            .from("product_variations")
            .select("allowed_product_id, stock")
            .in("allowed_product_id", ids)
            .gt("stock", 0),
        ])
      : [{ data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }];
    const kpData = (kpRes as any)?.data as any[] | null;
    const keyData = (keyRes as any)?.data as any[] | null;
    const variationData = (variationRes as any)?.data as any[] | null;
    const priceMap = new Map<string, number>();
    const kStockMap = new Map<string, number>();
    kpData?.forEach((kp: any) => {
      priceMap.set(kp.allowed_product_id, kp.sell_price);
      kStockMap.set(kp.allowed_product_id, (kStockMap.get(kp.allowed_product_id) || 0) + (kp.kinguin_stock ?? 0));
    });
    const manualStockMap = new Map<string, number>();
    (keyData as any[] | null)?.forEach((k: any) => {
      manualStockMap.set(k.allowed_product_id, (manualStockMap.get(k.allowed_product_id) || 0) + 1);
    });
    const variationStockMap = new Map<string, number>();
    (variationData as any[] | null)?.forEach((v: any) => {
      variationStockMap.set(v.allowed_product_id, (variationStockMap.get(v.allowed_product_id) || 0) + (v.stock ?? 0));
    });

    setCandidates(
      (data || [])
        .map((p: any) => ({
          ...p,
          sell_price: priceMap.get(p.id),
          stock: (kStockMap.get(p.id) || 0) + (manualStockMap.get(p.id) || 0) + (variationStockMap.get(p.id) || 0),
        }))
        // Hide out-of-stock products so admin can't accidentally pick them.
        .filter((p: any) => (p.stock || 0) > 0)
    );
    setSearching(false);
  };

  const addDeal = async (product: ProductCandidate) => {
    // Always fetch the live site price right now, instead of relying on
    // a possibly-stale value from the search dropdown cache.
    const { data: kp } = await supabase
      .from("kinguin_products")
      .select("sell_price")
      .eq("allowed_product_id", product.id)
      .order("sell_price", { ascending: false })
      .limit(1)
      .maybeSingle();
    const snapshotPrice = kp?.sell_price ?? product.sell_price ?? null;
    const { error } = await supabase.from("daily_deals").insert({
      allowed_product_id: product.id,
      sale_price: 0,
      original_price: snapshotPrice,
      display_order: deals.length,
    });
    if (error) {
      if (error.code === "23505") toast.error("Product already in daily deals");
      else toast.error(error.message);
      return;
    }
    toast.success("Product added to daily deals");
    setPickerOpen(false);
    fetchDeals();
  };

  const updatePrice = async (id: string, price: number) => {
    const { error } = await supabase
      .from("daily_deals")
      .update({ sale_price: price })
      .eq("id", id);
    if (error) toast.error(error.message);
  };

  const updateOriginalPrice = async (id: string, price: number) => {
    const { error } = await supabase
      .from("daily_deals")
      .update({ original_price: price > 0 ? price : null })
      .eq("id", id);
    if (error) toast.error(error.message);
    else fetchDeals();
  };

  const removeDeal = async (id: string) => {
    await supabase.from("daily_deals").delete().eq("id", id);
    toast.success("Deal removed");
    fetchDeals();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("daily_deals").update({ is_active: !current }).eq("id", id);
    fetchDeals();
  };

  if (loading) return <p className="text-muted-foreground text-sm">Loading deals...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-foreground">Daily Deals</h3>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Product
        </Button>
      </div>

      {deals.length === 0 ? (
        <p className="text-muted-foreground text-sm">No daily deals configured. Add products to display on the homepage.</p>
      ) : (
        <div className="space-y-2">
          {deals.map((deal) => (
            <div key={deal.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
              {deal.product_image && (
                <img src={deal.product_image} alt="" className="w-12 h-12 rounded object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display text-foreground truncate">{deal.product_title}</p>
                {deal.live_kinguin_price != null && deal.sale_price > 0 && deal.live_kinguin_price > deal.sale_price && (
                  <p className="text-xs text-destructive font-bold">
                    -{Math.round((1 - deal.sale_price / deal.live_kinguin_price) * 100)}% off
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Original (live)</span>
                  <span className="text-sm font-mono text-foreground">
                    {deal.live_kinguin_price != null ? `€${deal.live_kinguin_price.toFixed(2)}` : "—"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">Sale €</span>
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={deal.sale_price}
                  onBlur={(e) => updatePrice(deal.id, parseFloat(e.target.value) || 0)}
                  className="w-24 h-8 text-sm"
                />
                <Button
                  variant={deal.is_active ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => toggleActive(deal.id, deal.is_active)}
                >
                  {deal.is_active ? "Active" : "Off"}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeDeal(deal.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl max-h-[70vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Add Product to Daily Deals</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); searchProducts(e.target.value); }}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
            {searching && <p className="text-sm text-muted-foreground py-2">Searching...</p>}
            {candidates.map((p) => (
              <div
                key={p.id}
                onClick={() => addDeal(p)}
                className="flex items-center gap-3 p-2 rounded hover:bg-accent cursor-pointer"
              >
                {p.image_url && <img src={p.image_url} alt="" className="w-10 h-10 rounded object-cover" />}
                <span className="text-sm text-foreground flex-1">{p.title}</span>
                {p.sell_price != null && (
                  <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">€{p.sell_price.toFixed(2)}</span>
                )}
                <span className="text-xs text-muted-foreground whitespace-nowrap">Stock: {p.stock}</span>
              </div>
            ))}
            {!searching && candidates.length === 0 && search.length >= 2 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No products found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDailyDeals;