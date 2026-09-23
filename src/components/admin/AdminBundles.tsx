import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Package, Search, Percent, Upload, Loader2, X, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logAuditEvent } from "@/lib/auditLog";

interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  display_order: number;
  bundle_products?: { id: string; allowed_product_id: string; allowed_products: { id: string; title: string; image_url: string | null } }[];
}

interface QuantityDiscount {
  id: string;
  min_quantity: number;
  discount_pct: number;
  label: string | null;
  is_active: boolean;
}

const AdminBundles = () => {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editBundle, setEditBundle] = useState<Bundle | null>(null);
  const [addProductSearch, setAddProductSearch] = useState("");
  const [addingToBundle, setAddingToBundle] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("10");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please select an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");

    setUploadingImage(true);
    const ext = file.name.split(".").pop();
    const path = `bundles/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("section-banners").upload(path, file, { upsert: false });
    if (upErr) {
      setUploadingImage(false);
      return toast.error("Upload failed: " + upErr.message);
    }
    const { data } = supabase.storage.from("section-banners").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploadingImage(false);
    toast.success("Image uploaded");
  };

  // Quantity discount form
  const [qdMinQty, setQdMinQty] = useState("2");
  const [qdPct, setQdPct] = useState("10");
  const [qdLabel, setQdLabel] = useState("");

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ["admin-bundles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bundles")
        .select("*, bundle_products(id, allowed_product_id, display_order, allowed_products:allowed_product_id(id, title, image_url))")
        .order("display_order");
      return (data || []) as unknown as Bundle[];
    },
  });

  const { data: qtyDiscounts = [] } = useQuery({
    queryKey: ["admin-qty-discounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("quantity_discounts")
        .select("*")
        .order("min_quantity");
      return (data || []) as QuantityDiscount[];
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["bundle-product-search", addProductSearch],
    queryFn: async () => {
      if (addProductSearch.length < 2) return [];
      const { data } = await supabase
        .from("allowed_products")
        .select("id, title, image_url")
        .ilike("title", `%${addProductSearch}%`)
        .limit(10);
      return data || [];
    },
    enabled: addProductSearch.length >= 2,
  });

  const generateSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const createBundle = async () => {
    if (!name.trim()) return toast.error("Bundle name required");
    const slug = generateSlug(name);
    const { error } = await supabase.from("bundles").insert({
      name: name.trim(),
      slug,
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      discount_type: discountType,
      discount_value: parseFloat(discountValue) || 10,
    });
    if (error) return toast.error(error.message);
    logAuditEvent({ action_type: "create", entity_type: "bundle", entity_id: slug, entity_title: name });
    toast.success("Bundle created!");
    setShowCreate(false);
    setName(""); setDescription(""); setDiscountValue("10"); setImageUrl("");
    qc.invalidateQueries({ queryKey: ["admin-bundles"] });
  };

  const toggleActive = async (b: Bundle) => {
    await supabase.from("bundles").update({ is_active: !b.is_active }).eq("id", b.id);
    qc.invalidateQueries({ queryKey: ["admin-bundles"] });
  };

  const deleteBundle = async (b: Bundle) => {
    if (!confirm(`Delete "${b.name}"?`)) return;
    await supabase.from("bundles").delete().eq("id", b.id);
    logAuditEvent({ action_type: "delete", entity_type: "bundle", entity_id: b.id, entity_title: b.name });
    toast.success("Bundle deleted");
    qc.invalidateQueries({ queryKey: ["admin-bundles"] });
  };

  const openEdit = (b: Bundle) => {
    setEditBundle(b);
    setName(b.name);
    setDescription(b.description || "");
    setDiscountType(b.discount_type);
    setDiscountValue(String(b.discount_value));
    setImageUrl(b.image_url || "");
  };

  const saveEdit = async () => {
    if (!editBundle) return;
    if (!name.trim()) return toast.error("Bundle name required");
    const { error } = await supabase.from("bundles").update({
      name: name.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      discount_type: discountType,
      discount_value: parseFloat(discountValue) || 10,
    }).eq("id", editBundle.id);
    if (error) return toast.error(error.message);
    logAuditEvent({ action_type: "update", entity_type: "bundle", entity_id: editBundle.id, entity_title: name });
    toast.success("Bundle updated");
    setEditBundle(null);
    setName(""); setDescription(""); setDiscountValue("10"); setImageUrl("");
    qc.invalidateQueries({ queryKey: ["admin-bundles"] });
  };

  const addProductToBundle = async (bundleId: string, productId: string) => {
    const { error } = await supabase.from("bundle_products").insert({
      bundle_id: bundleId,
      allowed_product_id: productId,
    });
    if (error) {
      if (error.code === "23505") toast.info("Product already in bundle");
      else toast.error(error.message);
      return;
    }
    toast.success("Product added to bundle");
    qc.invalidateQueries({ queryKey: ["admin-bundles"] });
  };

  const removeProductFromBundle = async (bpId: string) => {
    await supabase.from("bundle_products").delete().eq("id", bpId);
    qc.invalidateQueries({ queryKey: ["admin-bundles"] });
  };

  const createQtyDiscount = async () => {
    const qty = parseInt(qdMinQty);
    const pct = parseFloat(qdPct) / 100;
    if (!qty || qty < 2 || !pct) return toast.error("Invalid values");
    const { error } = await supabase.from("quantity_discounts").insert({
      min_quantity: qty,
      discount_pct: pct,
      label: qdLabel.trim() || `Buy ${qty}, Save ${qdPct}%`,
    });
    if (error) return toast.error(error.message);
    toast.success("Quantity discount created");
    setQdMinQty("2"); setQdPct("10"); setQdLabel("");
    qc.invalidateQueries({ queryKey: ["admin-qty-discounts"] });
  };

  const deleteQtyDiscount = async (id: string) => {
    await supabase.from("quantity_discounts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-qty-discounts"] });
    toast.success("Discount deleted");
  };

  const toggleQtyActive = async (d: QuantityDiscount) => {
    await supabase.from("quantity_discounts").update({ is_active: !d.is_active }).eq("id", d.id);
    qc.invalidateQueries({ queryKey: ["admin-qty-discounts"] });
  };

  return (
    <div className="space-y-8">
      {/* Manual Bundles Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Product Bundles
          </h2>
          <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> New Bundle
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : bundles.length === 0 ? (
          <p className="text-muted-foreground text-sm">No bundles yet. Create your first bundle!</p>
        ) : (
          <div className="space-y-3">
            {bundles.map((b) => (
              <div key={b.id} className="glass rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {b.image_url && <img src={b.image_url} alt="" className="h-10 w-10 rounded object-cover" />}
                    <div>
                      <h3 className="font-display font-bold text-foreground">{b.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {b.discount_type === "percentage" ? `${b.discount_value}% off` : `€${b.discount_value} off`}
                        {" · "}{b.bundle_products?.length || 0} products
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                    <Button variant="ghost" size="icon" onClick={() => setAddingToBundle(b.id)} title="Add product">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)} title="Edit bundle">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteBundle(b)} title="Delete bundle">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Products in bundle */}
                {b.bundle_products && b.bundle_products.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {b.bundle_products.map((bp) => (
                      <div key={bp.id} className="flex items-center gap-2 bg-secondary/50 rounded-md px-2 py-1 text-xs">
                        {bp.allowed_products?.image_url && (
                          <img src={bp.allowed_products.image_url} alt="" className="h-6 w-6 rounded object-cover" />
                        )}
                        <span className="text-foreground max-w-[150px] truncate">{bp.allowed_products?.title}</span>
                        <button onClick={() => removeProductFromBundle(bp.id)} className="text-destructive hover:text-destructive/80">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quantity Discounts Section */}
      <div>
        <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2 mb-4">
          <Percent className="h-5 w-5 text-primary" />
          Quantity Discounts (Automatic)
        </h2>

        <div className="glass rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Min Qty</label>
              <Input value={qdMinQty} onChange={(e) => setQdMinQty(e.target.value)} className="w-20" type="number" min={2} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Discount %</label>
              <Input value={qdPct} onChange={(e) => setQdPct(e.target.value)} className="w-20" type="number" min={1} max={50} />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs text-muted-foreground">Label (optional)</label>
              <Input value={qdLabel} onChange={(e) => setQdLabel(e.target.value)} placeholder="e.g. Buy 2, Save 10%" />
            </div>
            <Button onClick={createQtyDiscount} size="sm">Add</Button>
          </div>

          {qtyDiscounts.length > 0 && (
            <div className="space-y-2">
              {qtyDiscounts.map((d) => (
                <div key={d.id} className="flex items-center justify-between bg-secondary/30 rounded px-3 py-2 text-sm">
                  <span className="text-foreground font-medium">
                    {d.label || `Buy ${d.min_quantity}+, get ${Math.round(d.discount_pct * 100)}% off`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Switch checked={d.is_active} onCheckedChange={() => toggleQtyActive(d)} />
                    <Button variant="ghost" size="icon" onClick={() => deleteQtyDiscount(d.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Bundle Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Bundle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bundle name" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Bundle Image</label>
              {imageUrl && (
                <div className="relative inline-block">
                  <img src={imageUrl} alt="Preview" className="h-20 w-20 rounded object-cover border border-border" />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:opacity-80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  <div className="flex items-center justify-center gap-2 h-10 rounded-md border-2 border-dashed border-border bg-secondary/50 hover:border-primary/40 transition-colors text-sm text-muted-foreground">
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadingImage ? "Uploading..." : "Upload image"}
                  </div>
                </label>
              </div>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="...or paste image URL" className="text-xs" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Discount Type</label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground">Value</label>
                <Input value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} type="number" />
              </div>
            </div>
            <Button onClick={createBundle} className="w-full">Create Bundle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Product to Bundle Dialog */}
      <Dialog open={!!addingToBundle} onOpenChange={() => { setAddingToBundle(null); setAddProductSearch(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product to Bundle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={addProductSearch}
                onChange={(e) => setAddProductSearch(e.target.value)}
                placeholder="Search products..."
                className="pl-9"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {searchResults.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => { if (addingToBundle) addProductToBundle(addingToBundle, p.id); }}
                  className="w-full flex items-center gap-2 p-2 rounded hover:bg-secondary/50 text-left text-sm"
                >
                  {p.image_url && <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover" />}
                  <span className="text-foreground truncate">{p.title}</span>
                </button>
              ))}
              {addProductSearch.length >= 2 && searchResults.length === 0 && (
                <p className="text-muted-foreground text-xs text-center py-4">No products found</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Bundle Dialog */}
      <Dialog open={!!editBundle} onOpenChange={(o) => { if (!o) { setEditBundle(null); setName(""); setDescription(""); setDiscountValue("10"); setImageUrl(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bundle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bundle name" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Bundle Image</label>
              {imageUrl && (
                <div className="relative inline-block">
                  <img src={imageUrl} alt="Preview" className="h-20 w-20 rounded object-cover border border-border" />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:opacity-80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  <div className="flex items-center justify-center gap-2 h-10 rounded-md border-2 border-dashed border-border bg-secondary/50 hover:border-primary/40 transition-colors text-sm text-muted-foreground">
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadingImage ? "Uploading..." : "Upload image"}
                  </div>
                </label>
              </div>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="...or paste image URL" className="text-xs" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Discount Type</label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground">Value</label>
                <Input value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} type="number" />
              </div>
            </div>
            <Button onClick={saveEdit} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBundles;
