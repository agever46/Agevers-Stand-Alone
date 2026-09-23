import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Eye, EyeOff, Pencil, Check, X, ArrowRightToLine,
  Filter,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface MenuItem {
  id: string;
  name: string;
  href: string;
  parent_id: string | null;
  display_order: number;
  is_visible: boolean;
  filter_keywords?: string[] | null;
}

const AdminNavMenu = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editHref, setEditHref] = useState("");
  // Advanced edit dialog (with filter keywords)
  const [advancedEditItem, setAdvancedEditItem] = useState<MenuItem | null>(null);
  const [advName, setAdvName] = useState("");
  const [advHref, setAdvHref] = useState("");
  const [advKeywords, setAdvKeywords] = useState<string[]>([]);
  const [advNewKeyword, setAdvNewKeyword] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemHref, setNewItemHref] = useState("");
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [newSubHref, setNewSubHref] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragParentId, setDragParentId] = useState<string | null>(null);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("nav_menu_items")
      .select("*")
      .order("display_order", { ascending: true });
    if (data) setItems(data as MenuItem[]);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const topLevel = items.filter((i) => !i.parent_id).sort((a, b) => a.display_order - b.display_order);
  const getChildren = (parentId: string) =>
    items.filter((i) => i.parent_id === parentId).sort((a, b) => a.display_order - b.display_order);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleVisibility = async (item: MenuItem) => {
    await supabase.from("nav_menu_items").update({ is_visible: !item.is_visible }).eq("id", item.id);
    fetchItems();
  };

  const startEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditHref(item.href);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await supabase.from("nav_menu_items").update({ name: editName.trim(), href: editHref.trim() }).eq("id", editingId);
    setEditingId(null);
    fetchItems();
    toast({ title: "Item updated" });
  };

  const openAdvancedEdit = (item: MenuItem) => {
    setAdvancedEditItem(item);
    setAdvName(item.name);
    setAdvHref(item.href);
    setAdvKeywords(item.filter_keywords || []);
    setAdvNewKeyword("");
  };

  const addAdvKeyword = () => {
    const v = advNewKeyword.trim();
    if (!v) return;
    if (advKeywords.includes(v)) { setAdvNewKeyword(""); return; }
    setAdvKeywords((p) => [...p, v]);
    setAdvNewKeyword("");
  };

  const saveAdvancedEdit = async () => {
    if (!advancedEditItem || !advName.trim()) return;
    await supabase.from("nav_menu_items").update({
      name: advName.trim(),
      href: advHref.trim(),
      filter_keywords: advKeywords,
    } as any).eq("id", advancedEditItem.id);
    setAdvancedEditItem(null);
    fetchItems();
    toast({ title: "Menu item saved" });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    await supabase.from("nav_menu_items").delete().eq("id", deleteConfirm.id);
    setDeleteConfirm(null);
    fetchItems();
    toast({ title: "Item deleted" });
  };

  // Drag & drop reorder
  const handleDragStart = (e: React.DragEvent, item: MenuItem) => {
    setDragId(item.id);
    setDragParentId(item.parent_id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetItem: MenuItem) => {
    e.preventDefault();
    setDragOverId(targetItem.id);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
    setDragParentId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetItem: MenuItem) => {
    e.preventDefault();
    if (!dragId || dragId === targetItem.id) {
      handleDragEnd();
      return;
    }

    const draggedItem = items.find((i) => i.id === dragId);
    if (!draggedItem) { handleDragEnd(); return; }

    // Case 1: Same parent → reorder
    if (dragParentId === targetItem.parent_id) {
      const siblings = targetItem.parent_id
        ? getChildren(targetItem.parent_id)
        : topLevel;

      const dragIdx = siblings.findIndex((s) => s.id === dragId);
      const targetIdx = siblings.findIndex((s) => s.id === targetItem.id);
      if (dragIdx === -1 || targetIdx === -1) { handleDragEnd(); return; }

      const reordered = [...siblings];
      const [moved] = reordered.splice(dragIdx, 1);
      reordered.splice(targetIdx, 0, moved);

      await Promise.all(
        reordered.map((item, idx) =>
          supabase.from("nav_menu_items").update({ display_order: idx }).eq("id", item.id)
        )
      );
    } else {
      // Case 2: Different parent → reparent: make dragged item a child of targetItem
      // Only allow nesting up to level 2 (target must be level 0 or 1)
      const targetLevel = !targetItem.parent_id ? 0 : !items.find((i) => i.id === targetItem.parent_id)?.parent_id ? 1 : 2;
      if (targetLevel >= 2) {
        toast({ title: "Cannot nest deeper than 3 levels", variant: "destructive" });
        handleDragEnd();
        return;
      }

      const newSiblings = getChildren(targetItem.id);
      const maxOrder = newSiblings.length > 0 ? Math.max(...newSiblings.map((i) => i.display_order)) + 1 : 0;

      await supabase.from("nav_menu_items").update({
        parent_id: targetItem.id,
        display_order: maxOrder,
      }).eq("id", dragId);

      toast({ title: `"${draggedItem.name}" moved under "${targetItem.name}"` });
    }

    handleDragEnd();
    fetchItems();
  };
  const moveUnder = async (itemId: string, itemName: string, newParentId: string | null, newParentName: string) => {
    const newSiblings = newParentId ? getChildren(newParentId) : topLevel;
    const maxOrder = newSiblings.length > 0 ? Math.max(...newSiblings.map((i) => i.display_order)) + 1 : 0;
    await supabase.from("nav_menu_items").update({
      parent_id: newParentId,
      display_order: maxOrder,
    }).eq("id", itemId);
    fetchItems();
    toast({ title: `"${itemName}" moved ${newParentId ? `under "${newParentName}"` : "to top level"}` });
  };

  const addTopLevel = async () => {
    if (!newItemName.trim()) return;
    const maxOrder = topLevel.length > 0 ? Math.max(...topLevel.map((i) => i.display_order)) + 1 : 0;
    await supabase.from("nav_menu_items").insert({
      name: newItemName.trim(),
      href: newItemHref.trim() || `/${newItemName.trim().toLowerCase().replace(/\s+/g, "-")}`,
      display_order: maxOrder,
    });
    setNewItemName("");
    setNewItemHref("");
    fetchItems();
    toast({ title: "Category added" });
  };

  const addSubItem = async (parentId: string) => {
    if (!newSubName.trim()) return;
    const children = getChildren(parentId);
    const maxOrder = children.length > 0 ? Math.max(...children.map((i) => i.display_order)) + 1 : 0;
    await supabase.from("nav_menu_items").insert({
      name: newSubName.trim(),
      href: newSubHref.trim() || `/${newSubName.trim().toLowerCase().replace(/\s+/g, "-")}`,
      parent_id: parentId,
      display_order: maxOrder,
    });
    setAddingSubTo(null);
    setNewSubName("");
    setNewSubHref("");
    fetchItems();
    toast({ title: "Subcategory added" });
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading menu...</div>;

  const renderRow = (
    item: MenuItem,
    level: 0 | 1 | 2,
    _idx: number,
    _siblings: MenuItem[],
  ) => {
    const isEditing = editingId === item.id;
    const isDragging = dragId === item.id;
    const isDragOver = dragOverId === item.id && dragId !== item.id;
    const isReparentDrop = isDragOver && dragParentId !== item.parent_id;

    const colorClasses = {
      0: item.is_visible ? "bg-blue-500/15 border-l-blue-500" : "bg-blue-500/5 border-l-blue-500/30 opacity-60",
      1: item.is_visible ? "bg-emerald-500/10 border-l-emerald-500" : "bg-emerald-500/5 border-l-emerald-500/30 opacity-60",
      2: item.is_visible ? "bg-amber-500/10 border-l-amber-500" : "bg-amber-500/5 border-l-amber-500/30 opacity-60",
    }[level];

    const pl = { 0: "pl-3", 1: "pl-10", 2: "pl-16" }[level];
    const py = level === 2 ? "py-1.5" : "py-2";
    const gripSize = level === 2 ? "h-3 w-3" : level === 1 ? "h-3.5 w-3.5" : "h-4 w-4";
    const textSize = level === 2 ? "text-[11px]" : level === 1 ? "text-xs" : "text-sm";
    const hrefSize = level === 2 ? "text-[9px]" : "text-[10px]";
    const iconSize = level === 2 ? "h-2.5 w-2.5" : level === 1 ? "h-3 w-3" : "h-3.5 w-3.5";
    const inputH = level === 2 ? "h-6 text-[10px]" : "h-7 text-xs";

    const children = level < 2 ? getChildren(item.id) : [];
    const isExpanded = expandedItems.has(item.id);
    const showExpander = level < 2 && (children.length > 0 || addingSubTo === item.id);

    return (
      <div key={item.id}>
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, item)}
          onDragOver={(e) => handleDragOver(e, item)}
          onDrop={(e) => handleDrop(e, item)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-2 px-3 ${py} ${pl} border-l-4 ${colorClasses} border-b border-border/20 transition-all hover:bg-primary/20 hover:ring-2 hover:ring-primary/50 hover:shadow-md cursor-pointer ${
            isDragging ? "opacity-40" : ""
          } ${isReparentDrop ? "ring-2 ring-accent ring-inset bg-accent/20" : isDragOver ? "ring-2 ring-primary ring-inset" : ""}`}
        >
          <GripVertical className={`${gripSize} text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing`} />

          {showExpander && (
            <button onClick={() => toggleExpand(item.id)} className="shrink-0">
              {isExpanded ? <ChevronDown className={iconSize} /> : <ChevronRight className={iconSize} />}
            </button>
          )}

          {isEditing ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputH} placeholder="Name" />
              <Input value={editHref} onChange={(e) => setEditHref(e.target.value)} className={inputH} placeholder="Link" />
              <button onClick={saveEdit} className="text-green-500 hover:text-green-400"><Check className={iconSize} /></button>
              <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className={iconSize} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className={`${textSize} font-display font-semibold truncate`}>{item.name}</span>
              <span className={`${hrefSize} text-muted-foreground truncate`}>{item.href}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => toggleVisibility(item)} className="p-0.5 hover:text-primary" title={item.is_visible ? "Hide" : "Show"}>
              {item.is_visible ? <Eye className={`${iconSize} text-green-500`} /> : <EyeOff className={`${iconSize} text-muted-foreground`} />}
            </button>
            {!isEditing && (
              <button onClick={() => startEdit(item)} className="p-0.5 hover:text-primary"><Pencil className={iconSize} /></button>
            )}
            <button onClick={() => openAdvancedEdit(item)} className="p-0.5 hover:text-primary" title="Filter keywords">
              <Filter className={iconSize} />
              {item.filter_keywords && item.filter_keywords.length > 0 && (
                <span className="ml-0.5 text-[8px] text-primary font-bold">{item.filter_keywords.length}</span>
              )}
            </button>
            {level < 2 && (
              <button onClick={() => { setAddingSubTo(addingSubTo === item.id ? null : item.id); setExpandedItems((p) => new Set(p).add(item.id)); }} className="p-0.5 hover:text-primary" title="Add sub-item">
                <Plus className={iconSize} />
              </button>
            )}
            {/* Move under... dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-0.5 hover:text-primary" title="Move under...">
                  <ArrowRightToLine className={iconSize} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto">
                {item.parent_id && (
                  <DropdownMenuItem onClick={() => moveUnder(item.id, item.name, null, "Top Level")}>
                    ↑ Move to top level
                  </DropdownMenuItem>
                )}
                {topLevel
                  .filter((t) => t.id !== item.id && t.id !== item.parent_id)
                  .map((t) => (
                    <DropdownMenuItem key={t.id} onClick={() => moveUnder(item.id, item.name, t.id, t.name)}>
                      → {t.name}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button onClick={() => setDeleteConfirm({ id: item.id, name: item.name })} className="p-0.5 hover:text-destructive" title="Delete"><Trash2 className={iconSize} /></button>
          </div>
        </div>

        {/* Children */}
        {showExpander && isExpanded && (
          <div className="border-t border-border/20">
            {children.map((child, childIdx) =>
              renderRow(child, (level + 1) as 1 | 2, childIdx, children)
            )}
            {addingSubTo === item.id && (
              <div className={`flex items-center gap-2 px-3 ${level === 0 ? "py-2 pl-10" : "py-1.5 pl-16"} bg-primary/5 border-t border-border/20`}>
                <Input value={newSubName} onChange={(e) => setNewSubName(e.target.value)} className={`${level === 0 ? "h-7 text-xs" : "h-6 text-[10px]"} flex-1`} placeholder={level === 0 ? "Subcategory name" : "Tab name (e.g. Top Ups)"} />
                <Input value={newSubHref} onChange={(e) => setNewSubHref(e.target.value)} className={`${level === 0 ? "h-7 text-xs" : "h-6 text-[10px]"} flex-1`} placeholder={level === 0 ? "Link (e.g. /steam)" : "Link (e.g. /epic-games?tab=topups)"} />
                <Button size="sm" className={`${level === 0 ? "h-7 text-xs" : "h-6 text-[10px] px-2"}`} onClick={() => addSubItem(item.id)}>Add</Button>
                <button onClick={() => setAddingSubTo(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-foreground">Navigation Menu Editor</h2>
        <div className="flex items-center gap-3 text-[10px] font-display">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500/30 border border-blue-500" /> Category</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500" /> Sub</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500/30 border border-amber-500" /> Tab</span>
        </div>
      </div>

      <div className="space-y-1">
        {topLevel.map((item, idx) => (
          <div key={item.id} className="border border-border/50 rounded-lg overflow-hidden">
            {renderRow(item, 0, idx, topLevel)}
          </div>
        ))}
      </div>

      {/* Add new top-level category */}
      <div className="border border-dashed border-border/50 rounded-lg p-3">
        <p className="text-xs font-display font-bold text-muted-foreground mb-2">Add New Category</p>
        <div className="flex items-center gap-2">
          <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="h-8 text-xs" placeholder="Category name" />
          <Input value={newItemHref} onChange={(e) => setNewItemHref(e.target.value)} className="h-8 text-xs" placeholder="Link (auto-generated if empty)" />
          <Button size="sm" className="h-8 text-xs shrink-0" onClick={addTopLevel} disabled={!newItemName.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "<span className="font-semibold text-foreground">{deleteConfirm?.name}</span>"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Advanced Edit Dialog: name + href + filter keywords */}
      <Dialog open={!!advancedEditItem} onOpenChange={(o) => !o && setAdvancedEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>
              Configure name, link, and auto-filter keywords. Products matching any keyword (in title, description or badges) will appear under this tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={advName} onChange={(e) => setAdvName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Link</Label>
              <Input value={advHref} onChange={(e) => setAdvHref(e.target.value)} placeholder="/steam?tab=dlc" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Filter Keywords
                <span className="ml-2 text-muted-foreground font-normal">
                  Auto-includes products matching any of these in title / description / badges
                </span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={advNewKeyword}
                  onChange={(e) => setAdvNewKeyword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAdvKeyword(); } }}
                  placeholder="e.g. DLC, Season Pass, Top Up"
                />
                <Button type="button" size="sm" onClick={addAdvKeyword} disabled={!advNewKeyword.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1 min-h-[28px]">
                {advKeywords.length === 0 && (
                  <span className="text-[11px] text-muted-foreground italic">No keywords — only manually-assigned products will appear.</span>
                )}
                {advKeywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="gap-1 pr-1">
                    {kw}
                    <button
                      type="button"
                      onClick={() => setAdvKeywords((p) => p.filter((k) => k !== kw))}
                      className="hover:text-destructive"
                      aria-label={`Remove ${kw}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvancedEditItem(null)}>Cancel</Button>
            <Button onClick={saveAdvancedEdit} disabled={!advName.trim()}>
              <Check className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminNavMenu;
