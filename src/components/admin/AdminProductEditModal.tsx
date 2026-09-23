import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Plus, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePlatformCategories } from "@/hooks/usePlatformCategories";
import { ALL_REGIONS } from "@/lib/regions";
import { isNoTypeProduct } from "@/lib/gameItemClassifier";

const COMMON_BADGES = ["DLC", "Deluxe", "Ultimate", "Gold", "Premium", "Collector", "Limited", "Legacy", "Complete", "GOTY", "Legendary", "Champion", "Digital Deluxe", "Super Deluxe", "Enhanced", "Pre-Order", "Bundle", "Season Pass", "Expansion", "Remastered", "Definitive"];

const PRODUCT_TYPES = ["Game", "Subscription", "Top Up", "Edition", "Season Pass", "Expansion", "DLC", "Skin", "Currency", "Bundle", "Game + Bonus", "PRE ORDER BONUS"];

interface ProductToEdit {
  id?: string;
  allowed_product_id: string;
  title: string;
  description?: string | null;
  platform: string;
  store: string;
  region?: string;
  image_url?: string | null;
  sell_price?: number;
  badges?: string[];
  product_type?: string | null;
  nav_menu_includes?: string[];
  nav_menu_excludes?: string[];
}

interface AdminProductEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductToEdit[];
  onSaved: () => void;
  forceBulk?: boolean;
}

const AdminProductEditModal = ({ open, onOpenChange, products, onSaved, forceBulk = false }: AdminProductEditModalProps) => {
  const { categories: PLATFORM_CATEGORIES, getSubPlatforms } = usePlatformCategories();
  const isBulk = forceBulk || products.length > 1;
  const single = products[0];

  const getProductId = (product?: ProductToEdit | null) =>
    product?.allowed_product_id || product?.id || "";

  const handlePlatformChange = (nextPlatform: string) => {
    setPlatform(nextPlatform);
    const firstStore = getSubPlatforms(nextPlatform)[0];
    if (firstStore) setStore(firstStore);
  };

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState("");
  const [store, setStore] = useState("");
  const [region, setRegion] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [price, setPrice] = useState("");
  const [badges, setBadges] = useState<string[]>([]);
  const [newBadge, setNewBadge] = useState("");
  const [saving, setSaving] = useState(false);
  const [tabCategory, setTabCategory] = useState("");
  const [productType, setProductType] = useState<string>("Game");
  const [uploading, setUploading] = useState(false);

  // Nav menu manual assignment
  const [navMenuItems, setNavMenuItems] = useState<{ id: string; name: string; href: string; parent_id: string | null }[]>([]);
  const [navIncludes, setNavIncludes] = useState<string[]>([]);
  const [navExcludes, setNavExcludes] = useState<string[]>([]);

  // For bulk
  const [applyPlatform, setApplyPlatform] = useState(false);
  const [applyStore, setApplyStore] = useState(false);
  const [applyRegion, setApplyRegion] = useState(false);
  const [applyBadges, setApplyBadges] = useState(false);
  const [applyTabCategory, setApplyTabCategory] = useState(false);
  const [applyProductType, setApplyProductType] = useState(false);

  useEffect(() => {
    if (!open || products.length === 0) return;
    // Load nav menu items once when dialog opens
    supabase.from("nav_menu_items").select("id, name, href, parent_id").order("display_order").then(({ data }) => {
      if (data) setNavMenuItems(data as any);
    });
    if (!isBulk && single) {
      setTitle(single.title);
      setDescription(single.description || "");
      setPlatform(single.platform);
      setStore(single.store);
      setRegion(single.region || "Global");
      setImageUrl(single.image_url || "");
      setPrice(single.sell_price ? String(single.sell_price) : "");
      setBadges(single.badges || []);
      setNewBadge("");
      setProductType(single.product_type || (isNoTypeProduct({ store: single.store }) ? "" : "Game"));
      setNavIncludes(single.nav_menu_includes || []);
      setNavExcludes(single.nav_menu_excludes || []);
    } else {
      setTitle(""); setDescription(""); setPlatform(single?.platform || "PC");
      setStore(single?.store || "Steam"); setRegion(single?.region || "Global");
      setImageUrl(""); setPrice(""); setBadges([]); setNewBadge(""); setTabCategory("");
      setProductType("Game");
      setApplyPlatform(false); setApplyStore(false); setApplyRegion(false); setApplyBadges(false); setApplyTabCategory(false); setApplyProductType(false);
      setNavIncludes([]); setNavExcludes([]);
    }
  }, [open, products]);

  const addBadge = (badge: string) => {
    const trimmed = badge.trim();
    if (trimmed && !badges.includes(trimmed)) {
      setBadges([...badges, trimmed]);
    }
    setNewBadge("");
  };

  const removeBadge = (badge: string) => {
    setBadges(badges.filter((b) => b !== badge));
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 10MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `product-edits/${getProductId(single) || crypto.randomUUID()}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast({ title: "Image uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isBulk) {
        const updatePayload: Record<string, any> = {};
        if (applyPlatform) updatePayload.platform = platform;
        if (applyStore) updatePayload.store = store;
        if (applyRegion) updatePayload.region = region;
        if (applyBadges) updatePayload.badges = badges;
        if (applyTabCategory) updatePayload.tab_category = tabCategory || null;
        if (applyProductType) updatePayload.product_type = productType;

        if (Object.keys(updatePayload).length === 0) {
          toast({ title: "No fields selected", description: "Toggle at least one field to update.", variant: "destructive" });
          setSaving(false);
          return;
        }

        const ids = products.map(getProductId).filter(Boolean);
        if (ids.length === 0) {
          throw new Error("No valid products selected");
        }
        const { error } = await supabase.from("allowed_products").update(updatePayload as any).in("id", ids);
        if (error) throw error;
        toast({ title: `${ids.length} products updated` });
      } else {
        const { error: apError } = await supabase
          .from("allowed_products")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            platform, store, region,
            image_url: imageUrl.trim() || null,
            badges,
            product_type: isNoTypeProduct({ store }) ? null : productType,
            nav_menu_includes: navIncludes,
            nav_menu_excludes: navExcludes,
          } as any)
          .eq("id", getProductId(single));
        if (apError) throw apError;

        const newPrice = parseFloat(price);
        if (!isNaN(newPrice) && newPrice > 0) {
          // Try to update an existing kinguin link first
          const { data: existing } = await supabase
            .from("kinguin_products")
            .select("id")
            .eq("allowed_product_id", getProductId(single))
            .maybeSingle();

          if (existing?.id) {
            await supabase
              .from("kinguin_products")
              .update({ sell_price: newPrice, is_active: true })
              .eq("id", existing.id);
          } else {
            // No Kinguin link — create a synthetic row so manual-only products carry a price
            await supabase.from("kinguin_products").insert({
              allowed_product_id: getProductId(single),
              kinguin_product_id: `manual:${getProductId(single)}`,
              sell_price: newPrice,
              kinguin_price: 0,
              kinguin_stock: 0,
              is_active: true,
            } as any);
          }
        }
        toast({ title: "Product updated" });
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const BadgesEditor = () => (
    <div className="space-y-2">
      <Label>Badges / Tags</Label>
      <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 border border-input rounded-md bg-background">
        {badges.map((b) => (
          <span key={b} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30">
            {b}
            <button onClick={() => removeBadge(b)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
          </span>
        ))}
        {badges.length === 0 && <span className="text-xs text-muted-foreground">No badges</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={newBadge}
          onChange={(e) => setNewBadge(e.target.value)}
          placeholder="Add custom badge..."
          className="flex-1 h-8 text-xs"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBadge(newBadge); } }}
        />
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => addBadge(newBadge)} disabled={!newBadge.trim()}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {COMMON_BADGES.filter((b) => !badges.includes(b)).slice(0, 12).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => addBadge(b)}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
          >
            + {b}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">
            {isBulk ? `Edit ${products.length} Products` : "Edit Product"}
          </DialogTitle>
        </DialogHeader>

        {isBulk ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Toggle the fields you want to update for all selected products.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={applyPlatform} onChange={(e) => setApplyPlatform(e.target.checked)} className="accent-primary h-4 w-4" />
                <Label className="w-20">Platform</Label>
                <Select value={platform} onValueChange={handlePlatformChange} disabled={!applyPlatform}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORM_CATEGORIES.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={applyStore} onChange={(e) => setApplyStore(e.target.checked)} className="accent-primary h-4 w-4" />
                <Label className="w-20">Store</Label>
                <Select value={store} onValueChange={setStore} disabled={!applyStore}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{getSubPlatforms(platform).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={applyRegion} onChange={(e) => setApplyRegion(e.target.checked)} className="accent-primary h-4 w-4" />
                <Label className="w-20">Region</Label>
                <Select value={region} onValueChange={setRegion} disabled={!applyRegion}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{ALL_REGIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={applyTabCategory} onChange={(e) => setApplyTabCategory(e.target.checked)} className="accent-primary h-4 w-4" />
                <Label className="w-20">Tab</Label>
                <Select value={tabCategory} onValueChange={setTabCategory} disabled={!applyTabCategory}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select tab..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="games">Games</SelectItem>
                    <SelectItem value="topups">Top Ups</SelectItem>
                    <SelectItem value="subscriptions">Subscriptions</SelectItem>
                    <SelectItem value="dlc">DLC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={applyProductType} onChange={(e) => setApplyProductType(e.target.checked)} className="accent-primary h-4 w-4" />
                <Label className="w-20">Type</Label>
                <Select value={productType} onValueChange={setProductType} disabled={!applyProductType}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={applyBadges} onChange={(e) => setApplyBadges(e.target.checked)} className="accent-primary h-4 w-4 mt-1" />
                <div className="flex-1">
                  {applyBadges ? <BadgesEditor /> : <Label className="text-muted-foreground">Badges</Label>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={handlePlatformChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORM_CATEGORIES.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Store</Label>
              <Select value={store} onValueChange={setStore}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{getSubPlatforms(platform).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!isNoTypeProduct({ store }) && (
              <div className="space-y-2">
                <Label>Product Type</Label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_REGIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Price ($)</Label>
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Image URL</Label>
              <div className="flex gap-2">
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://... or upload below" className="flex-1" />
                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-1" />
                    {uploading ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
              </div>
              {imageUrl && (
                <img src={imageUrl} alt="Preview" className="mt-2 max-h-32 rounded border border-border object-contain bg-muted" />
              )}
            </div>
            <div className="sm:col-span-2">
              <BadgesEditor />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Navigation Menu Tabs</Label>
              <p className="text-[11px] text-muted-foreground">
                Manually include / exclude this product from menu tabs. Auto-matches via filter keywords still apply unless excluded.
              </p>
              <div className="border border-input rounded-md p-2 max-h-48 overflow-y-auto space-y-1 bg-background">
                {navMenuItems.filter((n) => n.parent_id).map((n) => {
                  const inc = navIncludes.includes(n.id);
                  const exc = navExcludes.includes(n.id);
                  return (
                    <div key={n.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate flex-1">
                        <span className="font-semibold">{n.name}</span>
                        <span className="ml-2 text-muted-foreground text-[10px]">{n.href}</span>
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setNavExcludes((p) => p.filter((x) => x !== n.id));
                            setNavIncludes((p) => inc ? p.filter((x) => x !== n.id) : [...p, n.id]);
                          }}
                          className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${inc ? "bg-green-500/20 border-green-500 text-green-600" : "border-border text-muted-foreground hover:border-green-500/50"}`}
                        >
                          {inc ? "✓ Include" : "+ Include"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNavIncludes((p) => p.filter((x) => x !== n.id));
                            setNavExcludes((p) => exc ? p.filter((x) => x !== n.id) : [...p, n.id]);
                          }}
                          className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${exc ? "bg-destructive/20 border-destructive text-destructive" : "border-border text-muted-foreground hover:border-destructive/50"}`}
                        >
                          {exc ? "✕ Exclude" : "− Exclude"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving} onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminProductEditModal;
