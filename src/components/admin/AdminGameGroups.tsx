import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Search, Sparkles, X, ExternalLink, Save, Upload,
  Package, Loader2, Layers,
} from "lucide-react";
import {
  classifyGameItem, ITEM_TYPE_LABELS, ITEM_TYPE_COLORS, type GameItemType,
} from "@/lib/gameItemClassifier";
import AdminGameGroupSuggestions from "@/components/admin/AdminGameGroupSuggestions";

interface GameGroup {
  id: string;
  slug: string;
  title: string;
  image_url: string | null;
  base_product_id: string | null;
  is_active: boolean;
  display_order: number;
}

interface GroupItem {
  id: string;
  group_id: string;
  allowed_product_id: string;
  item_type: GameItemType;
  display_order: number;
  product?: { id: string; title: string; image_url: string | null; slug: string };
}

interface ProductLite {
  id: string;
  title: string;
  image_url: string | null;
  slug: string;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const AdminGameGroups = () => {
  const [view, setView] = useState<"groups" | "suggestions">("groups");
  const [groups, setGroups] = useState<GameGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit/create modal
  const [editGroup, setEditGroup] = useState<GameGroup | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Items panel (per-group)
  const [openGroupItems, setOpenGroupItems] = useState<GameGroup | null>(null);
  const [items, setItems] = useState<GroupItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Suggest items
  const [suggestQuery, setSuggestQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ProductLite[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestSelected, setSuggestSelected] = useState<Set<string>>(new Set());

  // -------- Load groups --------
  const loadGroups = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("game_groups")
      .select("*")
      .order("display_order")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setGroups((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { loadGroups(); }, []);

  // -------- Group create/edit --------
  const openCreate = () => {
    setCreatingNew(true);
    setEditGroup(null);
    setEditTitle("");
    setEditSlug("");
    setEditImage("");
    setEditActive(true);
  };

  const openEdit = (g: GameGroup) => {
    setCreatingNew(false);
    setEditGroup(g);
    setEditTitle(g.title);
    setEditSlug(g.slug);
    setEditImage(g.image_url || "");
    setEditActive(g.is_active);
  };

  const closeEditModal = () => {
    setEditGroup(null);
    setCreatingNew(false);
  };

  const saveGroup = async () => {
    if (!editTitle.trim() || !editSlug.trim()) {
      toast.error("Title and slug are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: editTitle.trim(),
        slug: slugify(editSlug),
        image_url: editImage.trim() || null,
        is_active: editActive,
      };
      if (creatingNew) {
        const { error } = await supabase.from("game_groups").insert(payload as any);
        if (error) throw error;
        toast.success("Group created");
      } else if (editGroup) {
        const { error } = await supabase.from("game_groups").update(payload as any).eq("id", editGroup.id);
        if (error) throw error;
        toast.success("Group updated");
      }
      closeEditModal();
      loadGroups();
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (g: GameGroup) => {
    if (!confirm(`Delete group "${g.title}"? Items will be unlinked.`)) return;
    await supabase.from("game_group_items").delete().eq("group_id", g.id);
    const { error } = await supabase.from("game_groups").delete().eq("id", g.id);
    if (error) toast.error(error.message);
    else { toast.success("Group deleted"); loadGroups(); }
  };

  // -------- Items panel --------
  const loadItems = async (groupId: string) => {
    setItemsLoading(true);
    const { data: itemRows } = await supabase
      .from("game_group_items")
      .select("*")
      .eq("group_id", groupId)
      .order("display_order");
    const ids = (itemRows || []).map((r: any) => r.allowed_product_id);
    let prodMap = new Map<string, ProductLite>();
    if (ids.length > 0) {
      const { data: prods } = await supabase
        .from("allowed_products")
        .select("id, title, image_url, slug")
        .in("id", ids);
      (prods || []).forEach((p: any) => prodMap.set(p.id, p));
    }
    const merged: GroupItem[] = (itemRows || []).map((r: any) => ({
      ...r,
      product: prodMap.get(r.allowed_product_id),
    }));
    setItems(merged);
    setItemsLoading(false);
  };

  const openItems = (g: GameGroup) => {
    setOpenGroupItems(g);
    setSuggestQuery(g.title);
    setSuggestions([]);
    setSuggestSelected(new Set());
    loadItems(g.id);
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("game_group_items").delete().eq("id", itemId);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed");
      if (openGroupItems) loadItems(openGroupItems.id);
    }
  };

  const updateItemType = async (itemId: string, type: GameItemType) => {
    const { error } = await supabase
      .from("game_group_items")
      .update({ item_type: type } as any)
      .eq("id", itemId);
    if (error) toast.error(error.message);
    else if (openGroupItems) loadItems(openGroupItems.id);
  };

  // -------- Suggestions (auto-search by keyword) --------
  const searchSuggestions = async () => {
    if (!openGroupItems || !suggestQuery.trim()) return;
    setSuggestLoading(true);
    setSuggestSelected(new Set());
    const words = suggestQuery.trim().split(/\s+/).filter(Boolean);
    let q = supabase
      .from("allowed_products")
      .select("id, title, image_url, slug")
      .order("title")
      .limit(200);
    for (const w of words) q = q.ilike("title", `%${w}%`);
    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setSuggestLoading(false);
      return;
    }
    const existingIds = new Set(items.map((i) => i.allowed_product_id));
    const filtered = (data || []).filter((p: any) => !existingIds.has(p.id));
    setSuggestions(filtered as ProductLite[]);
    setSuggestLoading(false);
  };

  const toggleSuggestion = (id: string) => {
    setSuggestSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addSelectedSuggestions = async () => {
    if (!openGroupItems || suggestSelected.size === 0) return;
    const baseOrder = items.length;
    const rows = Array.from(suggestSelected).map((pid, idx) => {
      const prod = suggestions.find((s) => s.id === pid);
      return {
        group_id: openGroupItems.id,
        allowed_product_id: pid,
        item_type: classifyGameItem(prod?.title || ""),
        display_order: baseOrder + idx,
      };
    });
    const { error } = await supabase.from("game_group_items").insert(rows as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Added ${rows.length} items`);
    setSuggestSelected(new Set());
    setSuggestions((prev) => prev.filter((s) => !suggestSelected.has(s.id)));
    loadItems(openGroupItems.id);
  };

  // -------- Image upload --------
  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "webp";
      const path = `game-groups/${slugify(editSlug || editTitle || "group")}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setEditImage(data.publicUrl);
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // -------- Render --------
  const filteredGroups = useMemo(() => groups, [groups]);

  const tabSwitcher = (
    <div className="flex items-center gap-1 mb-1">
      <Button
        size="sm"
        variant={view === "groups" ? "secondary" : "ghost"}
        className="h-7 text-xs gap-1.5"
        onClick={() => setView("groups")}
      >
        <Package className="h-3.5 w-3.5" /> Groups
      </Button>
      <Button
        size="sm"
        variant={view === "suggestions" ? "secondary" : "ghost"}
        className="h-7 text-xs gap-1.5"
        onClick={() => setView("suggestions")}
      >
        <Layers className="h-3.5 w-3.5" /> Suggestions
      </Button>
    </div>
  );

  if (view === "suggestions") {
    return (
      <div className="space-y-4">
        {tabSwitcher}
        <AdminGameGroupSuggestions />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tabSwitcher}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">Game Groups</h2>
          <p className="text-xs text-muted-foreground">Group multiple variants/DLCs of the same game under a single tile</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New Group
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-lg">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No game groups yet. Click "New Group" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredGroups.map((g) => (
            <div key={g.id} className="border border-border/50 rounded-lg p-3 bg-card hover:border-primary/40 transition-colors">
              <div className="flex items-start gap-3">
                {g.image_url ? (
                  <img src={g.image_url} alt={g.title} className="w-16 h-16 rounded-md object-cover border border-border/50 shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-sm text-foreground truncate">{g.title}</h3>
                    {!g.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Hidden</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">/game/{g.slug}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => openItems(g)}>
                      <Package className="h-3 w-3" /> Items
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => openEdit(g)}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                      <a href={`/game/${g.slug}`} target="_blank" rel="noreferrer" title="View page">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteGroup(g)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -------- Edit / Create dialog -------- */}
      <Dialog open={!!editGroup || creatingNew} onOpenChange={(o) => !o && closeEditModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">
              {creatingNew ? "Create Game Group" : "Edit Game Group"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  if (creatingNew && !editSlug) setEditSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Resident Evil Village"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug (URL)</Label>
              <Input value={editSlug} onChange={(e) => setEditSlug(slugify(e.target.value))} placeholder="resident-evil-village" />
              <p className="text-[10px] text-muted-foreground">Page will be at /game/{editSlug || "..."}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Image URL</Label>
              <Input value={editImage} onChange={(e) => setEditImage(e.target.value)} placeholder="https://..." />
              <div>
                <Button
                  variant="outline" size="sm" disabled={uploading}
                  onClick={() => document.getElementById("game-group-img-upload")?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  {uploading ? "Uploading..." : "Upload Image"}
                </Button>
                <input
                  id="game-group-img-upload" type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = "";
                  }}
                />
              </div>
              {editImage && (
                <img src={editImage} alt="Preview" className="w-20 h-20 object-cover rounded border border-border mt-1" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <Label>Active (visible to public)</Label>
              <Switch checked={editActive} onCheckedChange={setEditActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditModal}>Cancel</Button>
            <Button onClick={saveGroup} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------- Items management dialog -------- */}
      <Dialog open={!!openGroupItems} onOpenChange={(o) => !o && setOpenGroupItems(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">
              {openGroupItems?.title} — Items ({items.length})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Existing items */}
            <div>
              <h4 className="text-xs font-display font-bold text-muted-foreground mb-2 uppercase tracking-wider">In Group</h4>
              {itemsLoading ? (
                <div className="text-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Loading items...</div>
              ) : items.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs border border-dashed border-border/50 rounded">
                  No items yet. Use the search below to add some.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 p-2 rounded border border-border/40 bg-card/50">
                      {it.product?.image_url ? (
                        <img src={it.product.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{it.product?.title || "Unknown"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{it.product?.slug}</p>
                      </div>
                      <Select value={it.item_type} onValueChange={(v) => updateItemType(it.id, v as GameItemType)}>
                        <SelectTrigger className={`h-7 w-28 text-[11px] border ${ITEM_TYPE_COLORS[it.item_type]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ITEM_TYPE_LABELS) as GameItemType[]).map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">{ITEM_TYPE_LABELS[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeItem(it.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Suggest items */}
            <div className="border-t border-border/50 pt-3">
              <h4 className="text-xs font-display font-bold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Suggest Items
              </h4>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={suggestQuery}
                    onChange={(e) => setSuggestQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchSuggestions()}
                    placeholder="Search products by keyword (space-separated AND)"
                    className="h-8 pl-7 text-xs"
                  />
                </div>
                <Button size="sm" onClick={searchSuggestions} disabled={suggestLoading} className="h-8 text-xs">
                  {suggestLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Search"}
                </Button>
              </div>

              {suggestions.length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-3 mb-1.5">
                    <p className="text-[11px] text-muted-foreground">{suggestions.length} matches • {suggestSelected.size} selected</p>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setSuggestSelected(new Set(suggestions.map((s) => s.id)))}>
                        Select all
                      </Button>
                      <Button size="sm" className="h-6 text-[10px]" disabled={suggestSelected.size === 0} onClick={addSelectedSuggestions}>
                        <Plus className="h-3 w-3 mr-0.5" /> Add {suggestSelected.size}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {suggestions.map((s) => {
                      const selected = suggestSelected.has(s.id);
                      const autoType = classifyGameItem(s.title);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleSuggestion(s.id)}
                          className={`w-full flex items-center gap-2 p-2 rounded border text-left transition-colors ${
                            selected ? "bg-primary/10 border-primary" : "border-border/40 hover:bg-secondary/40"
                          }`}
                        >
                          {s.image_url ? (
                            <img src={s.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-muted shrink-0" />
                          )}
                          <span className="flex-1 min-w-0 text-xs font-medium text-foreground truncate">{s.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ITEM_TYPE_COLORS[autoType]}`}>
                            {ITEM_TYPE_LABELS[autoType]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenGroupItems(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGameGroups;