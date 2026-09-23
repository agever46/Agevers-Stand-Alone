import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Search, Download, Trash2, Check, Bell, DollarSign, PackageSearch, Save, Eye } from "lucide-react";
import { Label } from "@/components/ui/label";
import AgeversLoader from "@/components/AgeversLoader";

interface ProductKey {
  id: string;
  key_code: string;
  status: string;
  order_id: string | null;
  added_at: string;
  sold_at: string | null;
}

interface Product {
  id: string;
  title: string;
  platform: string;
  store: string;
  price: number;
  image_url: string | null;
  price_change_alert: boolean;
  low_stock_alert: boolean;
  low_stock_threshold: number;
}

type FilterTab = "all" | "sold" | "pending" | "active" | "preorder" | "reported";

const ProductKeys = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [keys, setKeys] = useState<ProductKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadText, setUploadText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [bulkAction, setBulkAction] = useState("");
  const [showCount, setShowCount] = useState(20);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceValue, setPriceValue] = useState("");
  const [localPriceAlert, setLocalPriceAlert] = useState(false);
  const [localStockAlert, setLocalStockAlert] = useState(false);
  const [localThreshold, setLocalThreshold] = useState(3);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading || !user || !id) return;
    fetchProduct();
    fetchKeys();
  }, [user, authLoading, id]);

  const fetchProduct = async () => {
    const { data } = await supabase.from("products")
      .select("id, title, platform, store, price, image_url, price_change_alert, low_stock_alert, low_stock_threshold")
      .eq("id", id!).single();
    if (data) {
      setProduct(data as any);
      setPriceValue(String((data as any).price));
      setLocalPriceAlert((data as any).price_change_alert);
      setLocalStockAlert((data as any).low_stock_alert);
      setLocalThreshold((data as any).low_stock_threshold);
      // New product (price=0) is considered unsaved
      if ((data as any).price === 0) setHasUnsavedChanges(true);
    }
  };

  const fetchKeys = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("product_keys")
      .select("id, key_code, status, order_id, added_at, sold_at")
      .eq("product_id", id!)
      .order("added_at", { ascending: true });
    if (data) setKeys(data as any);
    setLoading(false);
  };

  const handleUploadKeys = async () => {
    if (!uploadText.trim() || !user || !id) return;
    setUploading(true);
    const newKeys = uploadText.split("\n").map(k => k.trim()).filter(Boolean);
    const rows = newKeys.map(k => ({
      product_id: id!,
      seller_id: user.id,
      key_code: k,
      status: "active",
    }));
    const { error } = await supabase.from("product_keys").insert(rows as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${newKeys.length} key(s) uploaded` });
      setUploadOpen(false);
      setUploadText("");
      fetchKeys();
    }
    setUploading(false);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    for (const keyId of selectedIds) {
      await supabase.from("product_keys").delete().eq("id", keyId);
    }
    toast({ title: `${selectedIds.size} key(s) deleted` });
    setSelectedIds(new Set());
    fetchKeys();
  };

  const handleBulkDownload = () => {
    if (selectedIds.size === 0) return;
    const selectedKeys = keys.filter(k => selectedIds.has(k.id));
    const csv = ["Key,Status,Added,Sold,Order ID"]
      .concat(selectedKeys.map(k =>
        `${k.key_code},${k.status},${new Date(k.added_at).toLocaleDateString()},${k.sold_at ? new Date(k.sold_at).toLocaleDateString() : ""},${k.order_id || ""}`
      )).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `selected-keys-${product?.title || "product"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApplyBulkAction = () => {
    if (bulkAction === "delete") handleBulkDelete();
    if (bulkAction === "download") handleBulkDownload();
    setBulkAction("");
  };

  const handlePriceSave = async () => {
    if (!product) return;
    const val = parseFloat(priceValue);
    if (isNaN(val) || val <= 0) { toast({ title: "Invalid price", variant: "destructive" }); return; }
    setProduct({ ...product, price: val });
    setEditingPrice(false);
    setHasUnsavedChanges(true);
  };

  const handleSaveAll = async () => {
    if (!product) return;
    const val = parseFloat(priceValue);
    if (isNaN(val) || val <= 0) { toast({ title: "Invalid price", variant: "destructive" }); return; }
    if (keys.length === 0) { toast({ title: "Please upload at least one key code before saving", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("products").update({
      price: val,
      price_change_alert: localPriceAlert,
      low_stock_alert: localStockAlert,
      low_stock_threshold: localThreshold,
    } as any).eq("id", product.id);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setProduct({ ...product, price: val, price_change_alert: localPriceAlert, low_stock_alert: localStockAlert, low_stock_threshold: localThreshold });
    setHasUnsavedChanges(false);
    toast({ title: "Product added!" });
    navigate("/seller", { state: { section: "products" } });
  };

  const exportCSV = () => {
    const filtered = getFilteredKeys();
    const csv = ["Key,Status,Added,Sold,Order ID"]
      .concat(filtered.map(k =>
        `${k.key_code},${k.status},${new Date(k.added_at).toLocaleDateString()},${k.sold_at ? new Date(k.sold_at).toLocaleDateString() : ""},${k.order_id || ""}`
      )).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keys-${product?.title || "product"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (keyId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(keyId)) next.delete(keyId); else next.add(keyId);
      return next;
    });
  };

  const getFilteredKeys = () => {
    let filtered = keys;
    if (activeTab !== "all") filtered = filtered.filter(k => k.status === activeTab);
    if (search) filtered = filtered.filter(k => k.key_code.toLowerCase().includes(search.toLowerCase()));
    return filtered;
  };

  const filteredKeys = getFilteredKeys();
  const displayedKeys = filteredKeys.slice(0, showCount);

  const countByStatus = (status: string) => keys.filter(k => k.status === status).length;

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: keys.length },
    { id: "sold", label: "Sold", count: countByStatus("sold") },
    { id: "pending", label: "Pending", count: countByStatus("pending") },
    { id: "active", label: "Active", count: countByStatus("active") },
    { id: "preorder", label: "Preorder", count: countByStatus("preorder") },
    { id: "reported", label: "Reported", count: countByStatus("reported") },
  ];

  const toggleSelectAll = () => {
    if (selectedIds.size === displayedKeys.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayedKeys.map(k => k.id)));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AgeversLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <Button variant="ghost" className="mb-4 gap-2 text-muted-foreground" onClick={async () => {
        if (hasUnsavedChanges && product) {
          await supabase.from("products").delete().eq("id", product.id);
          toast({ title: "Product discarded" });
        }
        navigate("/seller", { state: { section: "products" } });
      }}>
        <ArrowLeft className="h-4 w-4" /> Back to Products
      </Button>

      {/* Title with image */}
      <div className="flex items-center gap-4 mb-6">
        {product?.image_url && (
          <div className="flex flex-col items-center gap-2 shrink-0">
            <img src={product.image_url} alt={product.title} className="w-28 h-20 object-cover rounded-lg border border-border" />
            <Button className="gap-2 text-xs h-9 px-5 bg-primary hover:bg-primary/90" onClick={() => navigate(`/product/${id}`)}>
              <Eye className="h-4 w-4" /> Show Product
            </Button>
          </div>
        )}
        <h1 className="font-display text-xl font-black tracking-wider text-foreground uppercase">
          Keys for {product?.title} ({product?.platform}) {product?.store}
        </h1>
      </div>

      {/* Price & Alerts */}
      <div className="glass rounded-xl p-4 mb-6 flex flex-wrap items-center gap-6">
        {/* Price */}
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Price:</Label>
          {editingPrice ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.01"
                value={priceValue}
                onChange={(e) => setPriceValue(e.target.value)}
                className="h-8 w-24 text-sm font-semibold bg-white text-black"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handlePriceSave(); if (e.key === "Escape") { setEditingPrice(false); setPriceValue(String(product?.price || 0)); } }}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={handlePriceSave}><Check className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div
              className="inline-flex items-center border border-border rounded px-3 py-1 cursor-pointer hover:border-primary transition-colors bg-white"
              onClick={() => setEditingPrice(true)}
            >
              <span className="text-black font-semibold">€{product?.price}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Price Change Alert */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLocalPriceAlert(!localPriceAlert); setHasUnsavedChanges(true); }}
            title="Get notified by email when a competitor changes their price for this product"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              localPriceAlert
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Price Alert {localPriceAlert ? "ON" : "OFF"}
          </button>
        </div>

        {/* Low Stock Alert */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLocalStockAlert(!localStockAlert); setHasUnsavedChanges(true); }}
            title="Get notified by email when your stock drops below the selected threshold"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              localStockAlert
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            <PackageSearch className="h-3.5 w-3.5" />
            Stock Alert {localStockAlert ? "ON" : "OFF"}
          </button>
          {localStockAlert && (
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => { setLocalThreshold(n); setHasUnsavedChanges(true); }}
                  className={`h-7 w-7 rounded text-xs font-medium border transition-colors ${
                    localThreshold === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 text-foreground border-border hover:bg-secondary"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Save Button */}
        <Button onClick={handleSaveAll} disabled={saving} className="gap-2 h-10 px-6 text-sm bg-green-600 hover:bg-green-700 text-white">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save & Add Product"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedIds(new Set()); }}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Search + Show + Upload */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by key or file name (case sensitive)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          <Select value={String(showCount)} onValueChange={(v) => setShowCount(Number(v))}>
            <SelectTrigger className="w-20 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="gap-2 bg-primary hover:bg-primary/90" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" /> Upload key codes
        </Button>
      </div>

      {/* Bulk actions + Export */}
      <div className="flex flex-wrap items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Selected: <span className="text-foreground font-semibold">{selectedIds.size}</span></span>
          <Select value={bulkAction} onValueChange={setBulkAction}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Bulk actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="delete">Delete selected</SelectItem>
              <SelectItem value="download">Download selected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleApplyBulkAction} disabled={!bulkAction || selectedIds.size === 0}>
            Apply
          </Button>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCSV}>
          <Download className="h-4 w-4" /> Export to .CSV
        </Button>
      </div>

      {/* Table */}
      <div className="glass rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-primary/5">
              <th className="p-3 w-10">
                <Checkbox checked={selectedIds.size === displayedKeys.length && displayedKeys.length > 0} onCheckedChange={toggleSelectAll} />
              </th>
              <th className="text-left p-3 font-display text-xs tracking-wider text-muted-foreground uppercase">Key</th>
              <th className="text-left p-3 font-display text-xs tracking-wider text-muted-foreground uppercase">Status</th>
              <th className="text-left p-3 font-display text-xs tracking-wider text-muted-foreground uppercase">Added</th>
              <th className="text-left p-3 font-display text-xs tracking-wider text-muted-foreground uppercase">Sold</th>
              <th className="text-left p-3 font-display text-xs tracking-wider text-muted-foreground uppercase">Order ID</th>
            </tr>
          </thead>
          <tbody>
            {displayedKeys.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No keys found. Upload key codes to get started.
                </td>
              </tr>
            ) : (
              displayedKeys.map((k) => (
                <tr key={k.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                  <td className="p-3">
                    <Checkbox checked={selectedIds.has(k.id)} onCheckedChange={() => toggleSelect(k.id)} />
                  </td>
                  <td className="p-3 text-foreground font-mono text-xs">{k.key_code}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded capitalize ${
                      k.status === "sold" ? "bg-muted text-muted-foreground" :
                      k.status === "active" ? "bg-neon-green/20 text-neon-green" :
                      k.status === "reported" ? "bg-destructive/20 text-destructive" :
                      "bg-primary/10 text-primary"
                    }`}>
                      {k.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{new Date(k.added_at).toLocaleDateString()}</td>
                  <td className="p-3 text-muted-foreground">{k.sold_at ? new Date(k.sold_at).toLocaleDateString() : "-"}</td>
                  <td className="p-3 text-muted-foreground font-mono text-xs">{k.order_id ? k.order_id.slice(0, 12) : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredKeys.length > showCount && (
        <p className="text-sm text-muted-foreground mt-3 text-center">
          Showing {showCount} of {filteredKeys.length} keys
        </p>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Upload Key Codes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">Paste key codes, one per line:</p>
            <Textarea
              value={uploadText}
              onChange={(e) => setUploadText(e.target.value)}
              placeholder={"XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY\nZZZZ-ZZZZ-ZZZZ"}
              rows={8}
            />
            {uploadText && (
              <p className="text-xs text-muted-foreground">
                {uploadText.split("\n").filter(k => k.trim()).length} key(s) to upload
              </p>
            )}
            <Button onClick={handleUploadKeys} disabled={uploading || !uploadText.trim()} className="w-full">
              {uploading ? "Uploading..." : "Upload Keys"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductKeys;
