import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Package, DollarSign, PackageSearch, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface Product {
  id: string;
  title: string;
  platform: string;
  store: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  game_code: string | null;
  category: string;
  status: string;
  created_at: string;
}

interface SellerProductsProps {
  products: Product[];
  allowedProductsData: { id: string; title: string; platform: string; store: string; region: string; image_url: string | null; description: string | null }[];
  kinguinLinkedIds: Record<string, { kinguin_stock: number | null; sell_price: number }>;
  isAdmin: boolean;
  onRefresh: () => void;
}

const SellerProducts = ({ products, allowedProductsData, kinguinLinkedIds, isAdmin, onRefresh }: SellerProductsProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [inlinePrice, setInlinePrice] = useState("");
  const [activeKeyCounts, setActiveKeyCounts] = useState<Record<string, number>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedAllowedProduct, setSelectedAllowedProduct] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const fetchKeyCounts = async () => {
      if (products.length === 0) return;
      const { data } = await supabase
        .from("product_keys")
        .select("product_id, id")
        .in("product_id", products.map(p => p.id))
        .eq("status", "active");
      if (data) {
        const counts: Record<string, number> = {};
        (data as any[]).forEach((k: any) => {
          counts[k.product_id] = (counts[k.product_id] || 0) + 1;
        });
        setActiveKeyCounts(counts);
      }
    };
    fetchKeyCounts();
  }, [products]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(products.map(p => p.id)));
  };

  const getLowestPrice = (product: Product) => {
    const same = products.filter(p => p.title === product.title && p.platform === product.platform && p.store === product.store);
    const lowest = Math.min(...same.map(p => p.price));
    return lowest;
  };

  const handleInlinePriceSave = async (productId: string) => {
    const val = parseFloat(inlinePrice);
    if (isNaN(val) || val <= 0) { toast({ title: "Invalid price", variant: "destructive" }); return; }
    const { error } = await supabase.from("products").update({ price: val } as any).eq("id", productId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Price updated" });
    setEditingPriceId(null);
    onRefresh();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) { await handleDelete(id); }
    setSelectedIds(new Set());
  };

  const handleDelete = async (id: string) => {
    const product = products.find((p) => p.id === id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    if (product) {
      const { data: remaining } = await supabase.from("products").select("id")
        .eq("title", product.title).eq("platform", product.platform).eq("store", product.store).eq("status", "active");
      if (!remaining || remaining.length === 0) {
        const { data: matchedAp } = await supabase.from("allowed_products").select("id")
          .eq("title", product.title).eq("platform", product.platform).eq("store", product.store);
        if (matchedAp) {
          for (const ap of matchedAp) {
            await supabase.from("kinguin_products").update({ is_active: false }).eq("allowed_product_id", ap.id);
          }
        }
      }
    }
    toast({ title: "Product deleted" }); onRefresh();
  };

  const togglePriceAlert = async (product: Product) => {
    const current = (product as any).price_change_alert || false;
    const { error } = await supabase.from("products").update({ price_change_alert: !current } as any).eq("id", product.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: !current ? "Price alert enabled" : "Price alert disabled" }); onRefresh();
  };

  const toggleStockAlert = async (product: Product) => {
    const current = (product as any).low_stock_alert || false;
    const { error } = await supabase.from("products").update({ low_stock_alert: !current } as any).eq("id", product.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: !current ? "Stock alert enabled" : "Stock alert disabled" }); onRefresh();
  };

  const handleAddProduct = async () => {
    if (!selectedAllowedProduct || !user) return;
    const match = allowedProductsData.find(p => p.title === selectedAllowedProduct);
    if (!match) return;
    setAdding(true);

    const kinguinInfo = kinguinLinkedIds[match.id];
    const defaultPrice = (isAdmin && kinguinInfo) ? kinguinInfo.sell_price : 0;
    const consolePlatforms = ["Xbox", "PlayStation", "Nintendo"];
    let category = "games";
    if (consolePlatforms.includes(match.platform)) {
      const storeToCategory: Record<string, string> = { "Games": "games", "Subscriptions": "subscriptions", "Top Ups": "topups" };
      category = storeToCategory[match.store] || "games";
    }

    const { data, error } = await supabase.from("products").insert({
      title: match.title,
      platform: match.platform,
      store: match.store,
      price: defaultPrice,
      image_url: match.image_url || null,
      category,
      seller_id: user.id,
    }).select("id").single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setAdding(false);
      return;
    }

    setAdding(false);
    setAddDialogOpen(false);
    setSelectedAllowedProduct("");
    onRefresh();
    if (data) navigate(`/product/${data.id}/keys`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-black tracking-wider text-foreground">MY PRODUCTS</h2>
          <p className="text-muted-foreground text-sm mt-1">{products.length} product(s){selectedIds.size > 0 && <span className="text-primary ml-2">• {selectedIds.size} selected</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" className="gap-2" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4" /> Delete ({selectedIds.size})
            </Button>
          )}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Add Product</Button>
            </DialogTrigger>
            <DialogContent className="bg-background border-border">
              <DialogHeader>
                <DialogTitle className="font-display">Add New Product</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 mt-4">
                <Select value={selectedAllowedProduct} onValueChange={setSelectedAllowedProduct}>
                  <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                  <SelectContent>
                    {allowedProductsData.map((p) => (
                      <SelectItem key={p.id} value={p.title}>
                        {p.title} — {p.platform} / {p.store} ({p.region})
                        {isAdmin && kinguinLinkedIds[p.id] && " ⚡"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAllowedProduct && (() => {
                  const match = allowedProductsData.find(p => p.title === selectedAllowedProduct);
                  return match?.image_url ? (
                    <div className="w-full h-32 rounded-md overflow-hidden border border-border">
                      <img src={match.image_url} alt="Product" className="w-full h-full object-cover" />
                    </div>
                  ) : null;
                })()}
                <Button onClick={handleAddProduct} disabled={adding || !selectedAllowedProduct} className="w-full">
                  {adding ? "Creating..." : "Add & Manage Keys"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 glass rounded-xl">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-display">No products yet. Add your first product!</p>
        </div>
      ) : (
        <div className="overflow-x-auto glass rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="p-4 w-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.size === products.length && products.length > 0} onCheckedChange={toggleSelectAll} />
                </th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase w-12">Image</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Title</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Price</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Lowest Price</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Codes</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Status</th>
                <th className="text-right p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const lowestPrice = getLowestPrice(p);
                return (
                  <tr key={p.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => navigate(`/product/${p.id}`)}>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                    </td>
                    <td className="p-4">
                      <div className="h-10 w-10 rounded-md overflow-hidden bg-secondary/50 shrink-0">
                        {(() => {
                          const imgUrl = p.image_url || allowedProductsData.find(
                            ap => ap.title === p.title && ap.platform === p.platform && ap.store === p.store
                          )?.image_url;
                          return imgUrl ? (
                            <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="p-4 text-foreground font-medium hover:text-primary transition-colors">{p.title}</td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      {editingPriceId === p.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={inlinePrice}
                            onChange={(e) => setInlinePrice(e.target.value)}
                            className="h-7 w-20 text-sm font-semibold bg-white text-black border-border"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") handleInlinePriceSave(p.id); if (e.key === "Escape") setEditingPriceId(null); }}
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleInlinePriceSave(p.id)}><Check className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : (
                        <div
                          className="inline-flex items-center border border-border rounded px-2.5 py-1 cursor-pointer hover:border-primary transition-colors bg-white"
                          onClick={() => { setEditingPriceId(p.id); setInlinePrice(String(p.price)); }}
                        >
                          <span className="text-black font-semibold">€{p.price}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`font-semibold ${lowestPrice < p.price ? 'text-neon-green' : 'text-primary'}`}>€{lowestPrice}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-foreground">{activeKeyCounts[p.id] || 0}</span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded ${p.status === "active" ? "bg-neon-green/20 text-neon-green" : "bg-muted text-muted-foreground"}`}>{p.status}</span>
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className={`h-8 w-8 ${(p as any).price_change_alert ? 'text-primary' : 'text-muted-foreground/40 hover:text-primary'}`} onClick={() => togglePriceAlert(p)}><DollarSign className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className={`h-8 w-8 ${(p as any).low_stock_alert ? 'text-primary' : 'text-muted-foreground/40 hover:text-primary'}`} onClick={() => toggleStockAlert(p)}><PackageSearch className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => navigate(`/product/${p.id}/keys`)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SellerProducts;
