import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Search, Package } from "lucide-react";

export default function AdminFreeGiftSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [newProductId, setNewProductId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [productDetails, setProductDetails] = useState<Record<string, any>>({});
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [togglingBanner, setTogglingBanner] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // 1. Fetch banner visibility from settings
      const { data: settingsRow, error: settingsError } = await (supabase
        .from('free_gift_settings' as any)
        .select('banner_enabled')
        .eq('id', 1)
        .maybeSingle() as any);

      if (settingsError) throw settingsError;
      
      // If row exists, use its value; otherwise default to true
      if (settingsRow) {
        setBannerEnabled(settingsRow.banner_enabled);
      } else {
        // Initialize the settings row if it doesn't exist (should be handled by migration, but for safety)
        setBannerEnabled(true);
      }

      // 2. Fetch configured gift products
      const { data, error } = await (supabase
        .from('free_gift_products' as any)
        .select('allowed_product_id')
        .order('created_at', { ascending: true }) as any);

      if (error) throw error;

      const ids: string[] = (data || []).map((r: any) => r.allowed_product_id);
      setProductIds(ids);

      if (ids.length > 0) {
        const { data: products } = await supabase
          .from('allowed_products')
          .select('id, title, platform, image_url')
          .in('id', ids);

        const details: Record<string, any> = {};
        products?.forEach(p => {
          details[p.id] = p;
        });
        setProductDetails(details);
      }
    } catch (err: any) {
      toast.error("Failed to load free gift settings: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleBanner = async (next: boolean) => {
    setTogglingBanner(true);
    try {
      // UPSERT the setting for id=1
      const { error } = await (supabase
        .from('free_gift_settings' as any)
        .upsert({ 
          id: 1, 
          banner_enabled: next, 
          updated_at: new Date().toISOString() 
        } as any) as any);

      if (error) throw error;
      
      setBannerEnabled(next);
      toast.success(next ? "Free Gift banner is now VISIBLE site-wide" : "Free Gift banner is now HIDDEN site-wide");
    } catch (error: any) {
      toast.error("Failed to update banner visibility: " + error.message);
    } finally {
      setTogglingBanner(false);
    }
  };

  const addProduct = async () => {
    const idToUse = newProductId || searchQuery.trim();
    if (!idToUse) return;
    
    // Verify product exists
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idToUse);
    
    let query = supabase.from('allowed_products').select('id, title, platform, image_url');
    
    if (isUuid) {
      query = query.eq('id', idToUse);
    } else {
      query = query.eq('title', idToUse);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      toast.error("Product ID not found. Make sure it's a valid UUID from Managed Products.");
      return;
    }

    if (productIds.includes(data.id)) {
      toast.error("Product is already in the list.");
      return;
    }

    setSaving(true);
    const { error: insErr } = await (supabase
      .from('free_gift_products' as any)
      .insert({ allowed_product_id: data.id } as any) as any);
    setSaving(false);

    if (insErr) {
      toast.error("Failed to add product: " + insErr.message);
      return;
    }

    setProductDetails(prev => ({ ...prev, [data.id]: data }));
    setProductIds(prev => [...prev, data.id]);
    setNewProductId("");
    setSearchQuery("");
    setSearchResults([]);
    toast.success("Product added to the free gift program");
  };

  const searchProducts = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('allowed_products')
        .select('id, title, platform, image_url')
        .ilike('title', `%${query}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  };

  const selectProduct = (product: any) => {
    setNewProductId(product.id);
    setSearchResults([]);
    setSearchQuery(product.title);
  };

  const removeProduct = async (id: string) => {
    setSaving(true);
    const { error } = await (supabase
      .from('free_gift_products' as any)
      .delete()
      .eq('allowed_product_id', id) as any);
    setSaving(false);

    if (error) {
      toast.error("Failed to remove product: " + error.message);
      return;
    }
    setProductIds(prev => prev.filter(pid => pid !== id));
    toast.success("Product removed");
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-2">
        <div className="space-y-1">
          <Label htmlFor="free-gift-banner-toggle" className="text-base font-bold text-foreground flex items-center gap-2">
            Free Gift Banner Visibility
            {!bannerEnabled && <span className="text-[10px] px-2 py-0.5 bg-destructive/20 text-destructive rounded-full uppercase tracking-wider">Hidden</span>}
          </Label>
          <p className="text-xs text-muted-foreground">
            This switch instantly hides or shows the "Free Gift" banner on the homepage for all users.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {togglingBanner && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          <Switch
            id="free-gift-banner-toggle"
            checked={bannerEnabled}
            disabled={togglingBanner}
            onCheckedChange={toggleBanner}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-sm font-bold text-foreground uppercase tracking-widest border-b border-border pb-2">
          Manage Free Products
        </h3>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or paste UUID..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => searchProducts(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addProduct()}
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-50 overflow-hidden">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    className="w-full flex items-center gap-2 p-2 hover:bg-accent text-left transition-colors"
                    onClick={() => selectProduct(p)}
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.title}</p>
                      <p className="text-[10px] text-muted-foreground">{p.platform}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <Button onClick={addProduct} disabled={saving || (!newProductId && !searchQuery.trim())}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Add
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {productIds.map(id => {
            const product = productDetails[id];
            return (
              <div key={id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/30 group hover:border-primary/30 transition-colors">
                {product?.image_url ? (
                  <img src={product.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product?.title || 'Unknown Product'}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-tight">{product?.platform || 'N/A'}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                  onClick={() => removeProduct(id)}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {productIds.length === 0 && (
            <div className="col-span-full py-8 text-center text-muted-foreground border border-dashed rounded-lg bg-secondary/10">
              No products configured for the free gift program.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
