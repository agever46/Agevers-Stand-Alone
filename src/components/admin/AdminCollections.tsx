import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usePlatformCategories } from "@/hooks/usePlatformCategories";
import {
  Plus,
  Trash2,
  X,
  Search,
  Loader2,
  FolderPlus,
  Layers,
  Package,
  ExternalLink,
  CheckSquare,
  ImageIcon,
  Check,
  Upload,
  Pencil,
  RefreshCw,
} from "lucide-react";

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  category_filter: string | null;
  auto_group_keyword: string | null;
  target_page: string | null;
  is_active: boolean;
  display_order: number;
}

interface CollectionProduct {
  id: string;
  allowed_product_id: string;
  collection_id: string;
}

interface AllowedProduct {
  id: string;
  title: string;
  platform: string;
  store: string;
  image_url: string | null;
  tab_category?: string | null;
}

const AdminCollections = () => {
  const { categories: PLATFORM_CATEGORIES } = usePlatformCategories();
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionProducts, setCollectionProducts] = useState<CollectionProduct[]>([]);
  const [allowedProducts, setAllowedProducts] = useState<AllowedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Create collection
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategoryFilter, setNewCategoryFilter] = useState("");
  const [newAutoKeyword, setNewAutoKeyword] = useState("");
  const [newTargetPage, setNewTargetPage] = useState("");
  const [creating, setCreating] = useState(false);

  // Manage products in collection — multi-select collections
  const [activeCollectionIds, setActiveCollectionIds] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [addingProducts, setAddingProducts] = useState(false);

  // Edit collection image
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Edit collection
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", description: "", category_filter: "", auto_group_keyword: "", target_page: "", display_order: 0 });
  const [savingEdit, setSavingEdit] = useState(false);

  // Derived: category options from platformConfig
  const categoryOptions = useMemo(() => {
    const cats: string[] = [];
    PLATFORM_CATEGORIES.forEach((cat) => {
      cats.push(cat.name);
      cat.subcategories?.forEach((sub) => cats.push(sub.name));
    });
    return [...new Set(cats)];
  }, [PLATFORM_CATEGORIES]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [colRes, apRes] = await Promise.all([
      supabase.from("collections").select("*").order("display_order"),
      fetchAllProducts(),
    ]);
    // Fetch collection_products with pagination
    let allCp: any[] = [];
    let cpOffset = 0;
    const cpBatch = 1000;
    while (true) {
      const { data: cpChunk } = await supabase
        .from("collection_products")
        .select("id, allowed_product_id, collection_id")
        .range(cpOffset, cpOffset + cpBatch - 1);
      if (!cpChunk || cpChunk.length === 0) break;
      allCp = allCp.concat(cpChunk);
      if (cpChunk.length < cpBatch) break;
      cpOffset += cpBatch;
    }
    if (colRes.data) setCollections(colRes.data as any);
    setCollectionProducts(allCp as any);
    setAllowedProducts(apRes);
    setLoading(false);
  };

  const fetchAllProducts = async (): Promise<AllowedProduct[]> => {
    let all: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data } = await supabase
        .from("allowed_products")
        .select("id, title, platform, store, image_url, tab_category")
        .order("title")
        .range(from, from + batchSize - 1);
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return all;
  };

  const syncAutoGroupProducts = async (collectionId: string, keyword: string) => {
    if (!keyword.trim()) return 0;
    const kwParts = keyword.trim().toLowerCase().split(/[\s\-_]+/).filter(Boolean);
    // Find all matching products (ALL keyword parts must appear in title)
    const matching = allowedProducts.filter((p) => {
      const titleLower = p.title.toLowerCase();
      return kwParts.every((part) => titleLower.includes(part));
    });
    if (matching.length === 0) return 0;

    // Get existing links for this collection
    const existing = new Set(
      collectionProducts.filter((cp) => cp.collection_id === collectionId).map((cp) => cp.allowed_product_id)
    );
    const toAdd = matching.filter((p) => !existing.has(p.id));
    if (toAdd.length === 0) return 0;

    // Insert in batches of 500
    let added = 0;
    for (let i = 0; i < toAdd.length; i += 500) {
      const batch = toAdd.slice(i, i + 500).map((p) => ({
        collection_id: collectionId,
        allowed_product_id: p.id,
      }));
      const { error } = await supabase.from("collection_products").insert(batch as any);
      if (error) {
        toast.error(error.message);
        break;
      }
      added += batch.length;
    }
    return added;
  };

  const handleSyncCollection = async (col: Collection) => {
    if (!col.auto_group_keyword) {
      toast.error("No auto-group keyword set for this collection");
      return;
    }
    toast.loading("Syncing products...", { id: "sync-" + col.id });
    const added = await syncAutoGroupProducts(col.id, col.auto_group_keyword);
    await fetchAll();
    toast.dismiss("sync-" + col.id);
    if (added > 0) {
      toast.success(`Added ${added} products to "${col.name}"`);
    } else {
      toast.info("All matching products are already in the collection");
    }
  };

  const handleCreateCollection = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const slug = newSlug.trim() || newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { data: newCol, error } = await supabase.from("collections").insert({
      name: newName.trim(),
      slug,
      description: newDescription.trim() || null,
      category_filter: newCategoryFilter.trim() || null,
      auto_group_keyword: newAutoKeyword.trim() || null,
      target_page: newTargetPage.trim() || null,
    } as any).select("id").single();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Collection created");
      // Auto-sync if keyword is set
      if (newAutoKeyword.trim() && newCol) {
        const added = await syncAutoGroupProducts((newCol as any).id, newAutoKeyword.trim());
        if (added > 0) toast.success(`Auto-added ${added} matching products`);
      }
      setNewName("");
      setNewSlug("");
      setNewDescription("");
      setNewCategoryFilter("");
      setNewAutoKeyword("");
      setNewTargetPage("");
      setShowCreate(false);
      fetchAll();
    }
    setCreating(false);
  };

  const handleDeleteCollection = async (col: Collection) => {
    if (!confirm(`Delete collection "${col.name}" and all its product links?`)) return;
    await supabase.from("collection_products").delete().eq("collection_id", col.id);
    const { error } = await supabase.from("collections").delete().eq("id", col.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Collection deleted");
      setActiveCollectionIds((prev) => {
        const next = new Set(prev);
        next.delete(col.id);
        return next;
      });
      fetchAll();
    }
  };

  const handleToggleActive = async (col: Collection) => {
    await supabase.from("collections").update({ is_active: !col.is_active } as any).eq("id", col.id);
    fetchAll();
  };

  const handleSaveImage = async (col: Collection) => {
    const url = editImageUrl.trim() || null;
    const { error } = await supabase.from("collections").update({ image_url: url } as any).eq("id", col.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Image updated");
      setEditingImageId(null);
      setEditImageUrl("");
      fetchAll();
    }
  };

  const handleFileUpload = async (col: Collection, file: File) => {
    setUploadingImage(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `collections/${col.id}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setUploadingImage(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    const publicUrl = urlData.publicUrl + "?t=" + Date.now();
    const { error } = await supabase.from("collections").update({ image_url: publicUrl } as any).eq("id", col.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Image uploaded");
      setEditingImageId(null);
      setEditImageUrl("");
      fetchAll();
    }
    setUploadingImage(false);
  };

  const startEditCollection = (col: Collection) => {
    setEditingCollectionId(col.id);
    setEditForm({
      name: col.name,
      slug: col.slug,
      description: col.description || "",
      category_filter: col.category_filter || "",
      auto_group_keyword: col.auto_group_keyword || "",
      target_page: col.target_page || "",
      display_order: col.display_order,
    });
  };

  const handleSaveEditCollection = async () => {
    if (!editingCollectionId || !editForm.name.trim()) return;
    setSavingEdit(true);
    const { error } = await supabase.from("collections").update({
      name: editForm.name.trim(),
      slug: editForm.slug.trim(),
      description: editForm.description.trim() || null,
      category_filter: editForm.category_filter.trim() || null,
      auto_group_keyword: editForm.auto_group_keyword.trim() || null,
      target_page: editForm.target_page.trim() || null,
      display_order: editForm.display_order,
    } as any).eq("id", editingCollectionId);
    if (error) toast.error(error.message);
    else {
      toast.success("Collection updated");
      setEditingCollectionId(null);
      fetchAll();
    }
    setSavingEdit(false);
  };

  // Products in active collections (union of all selected)
  const activeCollections = collections.filter((c) => activeCollectionIds.has(c.id));
  const productsInCollection = useMemo(
    () => new Set(collectionProducts.filter((cp) => activeCollectionIds.has(cp.collection_id)).map((cp) => cp.allowed_product_id)),
    [collectionProducts, activeCollectionIds]
  );

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return allowedProducts;
    const words = productSearch.toLowerCase().split(/\s+/);
    return allowedProducts.filter((p) => {
      const text = `${p.title} ${p.platform} ${p.store}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [allowedProducts, productSearch]);

  const handleAddSelectedProducts = async () => {
    if (selectedProductIds.size === 0 || activeCollectionIds.size === 0) return;
    setAddingProducts(true);
    let totalAdded = 0;
    for (const colId of activeCollectionIds) {
      const existingInCol = new Set(
        collectionProducts.filter((cp) => cp.collection_id === colId).map((cp) => cp.allowed_product_id)
      );
      const toAdd = Array.from(selectedProductIds).filter((id) => !existingInCol.has(id));
      if (toAdd.length === 0) continue;
      const rows = toAdd.map((id) => ({
        collection_id: colId,
        allowed_product_id: id,
      }));
      const { error } = await supabase.from("collection_products").insert(rows as any);
      if (error) toast.error(error.message);
      else totalAdded += toAdd.length;
    }
    if (totalAdded > 0) {
      toast.success(`Added ${totalAdded} product links across ${activeCollectionIds.size} collection(s)`);
      setSelectedProductIds(new Set());
      fetchAll();
    } else {
      toast.info("All selected products are already in the selected collections");
    }
    setAddingProducts(false);
  };

  const handleRemoveFromCollection = async (allowedProductId: string) => {
    if (activeCollectionIds.size === 0) return;
    const cps = collectionProducts.filter(
      (c) => activeCollectionIds.has(c.collection_id) && c.allowed_product_id === allowedProductId
    );
    for (const cp of cps) {
      await supabase.from("collection_products").delete().eq("id", cp.id);
    }
    toast.success("Removed from collection(s)");
    fetchAll();
  };

  const handleBulkRemoveFromCollection = async () => {
    if (activeCollectionIds.size === 0 || selectedProductIds.size === 0) return;
    const toRemove = collectionProducts.filter(
      (cp) => activeCollectionIds.has(cp.collection_id) && selectedProductIds.has(cp.allowed_product_id)
    );
    if (toRemove.length === 0) return;
    for (const cp of toRemove) {
      await supabase.from("collection_products").delete().eq("id", cp.id);
    }
    toast.success(`Removed ${toRemove.length} product links`);
    setSelectedProductIds(new Set());
    fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">Collections Manager</h2>
          <span className="text-xs text-muted-foreground">({collections.length})</span>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <FolderPlus className="h-4 w-4" /> New Collection
        </Button>
      </div>

      {/* Create Collection Form */}
      {showCreate && (
        <div className="border border-border rounded-lg p-4 bg-secondary/30 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-foreground">Create Collection</h3>
            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-body mb-1 block">Name *</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Fortnite" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-body mb-1 block">Slug</label>
              <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="auto-generated if empty" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-body mb-1 block">Category Filter</label>
              <Select value={newCategoryFilter || "__none__"} onValueChange={(v) => {
                const val = v === "__none__" ? "" : v;
                setNewCategoryFilter(val);
                // Auto-sync Target Page if empty so the collection actually shows up
                if (val && !newTargetPage.trim()) setNewTargetPage(val);
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No filter</SelectItem>
                  {categoryOptions.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Internal grouping label (used inside Collections page).</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-body mb-1 block">Auto-Group Keyword</label>
              <Input value={newAutoKeyword} onChange={(e) => setNewAutoKeyword(e.target.value)} placeholder="e.g. fortnite" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-body mb-1 block">Target Page <span className="text-destructive">*</span></label>
              <Select value={newTargetPage || "__none__"} onValueChange={(v) => setNewTargetPage(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (hidden)</SelectItem>
                  {categoryOptions.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Which site page shows this group as a tile. Leave empty to hide.</p>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground font-body mb-1 block">Description</label>
              <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Optional description" />
            </div>
          </div>
          <Button onClick={handleCreateCollection} disabled={creating} className="gap-2">
            <Plus className="h-4 w-4" /> {creating ? "Creating..." : "Create"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collections List */}
        <div className="space-y-2">
          <h3 className="font-display text-sm font-semibold text-foreground">Collections</h3>
          {collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No collections yet.</p>
          ) : (
            <div className="space-y-1">
              {collections.map((col) => {
                const isAuto = !!col.auto_group_keyword?.trim();
                const count = isAuto
                  ? allowedProducts.filter((p) => {
                      if (!p.title?.toUpperCase().includes(col.auto_group_keyword!.trim().toUpperCase())) return false;
                      if (col.category_filter) {
                        return p.platform === col.category_filter || (p as any).tab_category === col.category_filter;
                      }
                      return true;
                    }).length
                  : collectionProducts.filter((cp) => cp.collection_id === col.id).length;
                const isActive = activeCollectionIds.has(col.id);
                return (
                  <div key={col.id} className="space-y-0">
                    <div
                      className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition-colors border ${
                        isActive ? "bg-primary/10 border-primary/30" : "bg-secondary/50 border-border/50 hover:border-primary/30"
                      }`}
                      onClick={() => {
                        setActiveCollectionIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(col.id)) next.delete(col.id);
                          else next.add(col.id);
                          return next;
                        });
                        setSelectedProductIds(new Set());
                        setProductSearch("");
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {col.image_url && (
                            <img src={col.image_url} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                          )}
                          <span className="text-sm font-medium text-foreground truncate">{col.name}</span>
                          {!col.is_active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Hidden</span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/collection/${col.slug}`); }}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Open collection page"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">{count} products</span>
                          {col.category_filter && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                              📂 {col.category_filter}
                            </span>
                          )}
                          {col.auto_group_keyword && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
                              🔗 {col.auto_group_keyword}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            if (editingCollectionId === col.id) {
                              setEditingCollectionId(null);
                            } else {
                              startEditCollection(col);
                            }
                          }}
                          className={`p-1 transition-colors ${editingCollectionId === col.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                          title="Edit collection"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {col.auto_group_keyword && (
                          <button
                            onClick={() => handleSyncCollection(col)}
                            className="p-1 text-muted-foreground hover:text-primary transition-colors"
                            title={`Sync products matching "${col.auto_group_keyword}"`}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (editingImageId === col.id) {
                              setEditingImageId(null);
                            } else {
                              setEditingImageId(col.id);
                              setEditImageUrl(col.image_url || "");
                            }
                          }}
                          className={`p-1 transition-colors ${col.image_url ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"}`}
                          title="Change image"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(col)}
                          className={`p-1 transition-colors ${col.is_active ? "text-emerald-400 hover:text-emerald-300" : "text-muted-foreground hover:text-foreground"}`}
                          title={col.is_active ? "Hide" : "Show"}
                        >
                          <Package className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCollection(col)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {editingImageId === col.id && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-b-lg border border-t-0 border-border/50 flex-wrap">
                        {editImageUrl && (
                          <img src={editImageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0 border border-border" />
                        )}
                        <Input
                          value={editImageUrl}
                          onChange={(e) => setEditImageUrl(e.target.value)}
                          placeholder="Image URL..."
                          className="h-8 text-xs flex-1 min-w-[120px]"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleSaveImage(col); }} title="Save URL">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <label
                          className="inline-flex items-center justify-center h-8 px-2 rounded-md bg-primary text-primary-foreground text-xs font-medium cursor-pointer hover:bg-primary/90 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingImage}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(col, file);
                            }}
                          />
                        </label>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); setEditingImageId(null); }}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    {editingCollectionId === col.id && (
                      <div className="px-3 py-3 bg-secondary/30 rounded-b-lg border border-t-0 border-border/50 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-0.5 block">Name</label>
                            <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-7 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-0.5 block">Slug</label>
                            <Input value={editForm.slug} onChange={(e) => setEditForm(f => ({ ...f, slug: e.target.value }))} className="h-7 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-0.5 block">Category Filter</label>
                            <Select value={editForm.category_filter || "__none__"} onValueChange={(v) => setEditForm(f => ({ ...f, category_filter: v === "__none__" ? "" : v }))}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">No filter</SelectItem>
                                {categoryOptions.map((cat) => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-0.5 block">Auto-Group Keyword</label>
                            <Input value={editForm.auto_group_keyword} onChange={(e) => setEditForm(f => ({ ...f, auto_group_keyword: e.target.value }))} className="h-7 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-0.5 block">Target Page</label>
                            <Select value={editForm.target_page || "__none__"} onValueChange={(v) => setEditForm(f => ({ ...f, target_page: v === "__none__" ? "" : v }))}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">None (hidden)</SelectItem>
                                {categoryOptions.map((cat) => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-0.5 block">Display Order</label>
                            <Input type="number" value={editForm.display_order} onChange={(e) => setEditForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} className="h-7 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-0.5 block">Description</label>
                            <Input value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} className="h-7 text-xs" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSaveEditCollection} disabled={savingEdit}>
                            {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingCollectionId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Collection Products Manager */}
        <div className="lg:col-span-2 space-y-3">
          {activeCollections.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Products in {activeCollections.length === 1 ? `"${activeCollections[0].name}"` : `${activeCollections.length} collections`} ({productsInCollection.size})
                </h3>
              </div>

              {/* Search & Add */}
              <div className="space-y-3 border border-border rounded-lg p-4 bg-secondary/30">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products to add..."
                    className="pl-9 h-9"
                  />
                </div>

                {/* Bulk actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      const visibleIds = filteredProducts.slice(0, 100).map((p) => p.id);
                      const allSelected = visibleIds.every((id) => selectedProductIds.has(id));
                      if (allSelected) {
                        setSelectedProductIds(new Set());
                      } else {
                        setSelectedProductIds(new Set(visibleIds));
                      }
                    }}
                  >
                    <CheckSquare className="h-3 w-3" />
                    {filteredProducts.slice(0, 100).every((p) => selectedProductIds.has(p.id)) ? "Deselect All" : "Select All"}
                  </Button>
                  {selectedProductIds.size > 0 && (
                    <>
                      <span className="text-xs font-medium text-foreground">{selectedProductIds.size} selected</span>
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={handleAddSelectedProducts} disabled={addingProducts}>
                        {addingProducts ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Add to Collection
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={handleBulkRemoveFromCollection}>
                        <Trash2 className="h-3 w-3" /> Remove from Collection
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedProductIds(new Set())}>
                        <X className="h-3 w-3" /> Clear
                      </Button>
                    </>
                  )}
                </div>

                {/* Product list */}
                <div className="max-h-[500px] overflow-y-auto space-y-1">
                  {filteredProducts.slice(0, 100).map((p) => {
                    const inCollection = productsInCollection.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                          inCollection ? "bg-primary/5 border border-primary/20" : "bg-background border border-border/30 hover:border-border"
                        }`}
                      >
                        <Checkbox
                          checked={selectedProductIds.has(p.id)}
                          onCheckedChange={() => {
                            setSelectedProductIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              return next;
                            });
                          }}
                        />
                        {p.image_url && (
                          <img src={p.image_url} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-foreground line-clamp-1">{p.title}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{p.platform}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-foreground">{p.store}</span>
                          </div>
                        </div>
                        {inCollection ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-emerald-400 font-medium">Added</span>
                            <button
                              onClick={() => handleRemoveFromCollection(p.id)}
                              className="text-destructive hover:text-destructive/80 p-1"
                              title="Remove from collection"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={async () => {
                              for (const colId of activeCollectionIds) {
                                const { error } = await supabase.from("collection_products").insert({
                                  collection_id: colId,
                                  allowed_product_id: p.id,
                                } as any);
                                if (error) toast.error(error.message);
                              }
                              toast.success("Added");
                              fetchAll();
                            }}
                            className="text-primary hover:text-primary/80 p-1"
                            title="Add to collection(s)"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {filteredProducts.length > 100 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Showing first 100 of {filteredProducts.length} results. Refine your search.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">Select a collection to manage its products</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCollections;
