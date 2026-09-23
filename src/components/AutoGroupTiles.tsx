import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Package, Pencil, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AutoGroupTilesProps {
  targetPage: string;
  items: { id: string; title: string; image: string; price: number }[];
  onFilterChange?: (keyword: string | null) => void;
  activeGroup?: string | null;
  onTilesStateChange?: (hasTiles: boolean) => void;
  onGroupedKeywordsChange?: (keywords: string[]) => void;
}

interface GroupTile {
  keyword: string;
  displayName: string;
  image: string | null;
  count: number;
  minPrice: number;
  slug: string;
  collectionId: string;
}

interface CollectionRow {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  auto_group_keyword: string;
}

const AutoGroupTiles = ({ targetPage, items, onTilesStateChange, onGroupedKeywordsChange }: AutoGroupTilesProps) => {
  const [autoGroups, setAutoGroups] = useState<CollectionRow[]>([]);
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingTile, setEditingTile] = useState<GroupTile | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refreshGroups = () => {
    supabase
      .from("collections")
      .select("id, slug, name, image_url, auto_group_keyword")
      .eq("is_active", true)
      .eq("target_page", targetPage)
      .not("auto_group_keyword", "is", null)
      .then(({ data }) => {
        if (data) setAutoGroups(data.filter((c: any) => c.auto_group_keyword?.trim()) as any);
      });
  };

  useEffect(() => {
    const check = async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.rpc("check_my_role" as any, { _role: "admin" });
      setIsAdmin(!!data);
    };
    check();
  }, [user]);

  useEffect(() => {
    refreshGroups();
  }, [targetPage]);

  const tiles = useMemo(() => {
    if (autoGroups.length === 0) return [];
    const sortedGroups = [...autoGroups].sort((a, b) => b.auto_group_keyword.length - a.auto_group_keyword.length);
    const tileMap: Record<string, GroupTile> = {};

    items.forEach((item) => {
      const upper = item.title.toUpperCase();
      for (const g of sortedGroups) {
        const kw = g.auto_group_keyword.toUpperCase();
        if (upper.includes(kw)) {
          const key = kw;
          if (!tileMap[key]) {
            tileMap[key] = {
              // Only use an explicitly-set collection image. A group tile
              // represents many products at many price points, so falling
              // back to an arbitrary member product's photo is wrong when
              // that photo has its own price/denomination printed on it
              // (e.g. gift card artwork) — show the placeholder instead.
              keyword: g.auto_group_keyword,
              displayName: g.name,
              image: g.image_url || null,
              count: 0,
              minPrice: item.price,
              slug: g.slug,
              collectionId: g.id,
            };
          }
          tileMap[key].count += 1;
          if (item.price < tileMap[key].minPrice) tileMap[key].minPrice = item.price;
          break;
        }
      }
    });

    return Object.values(tileMap)
      .filter((t) => t.count >= 1)
      .sort((a, b) => b.count - a.count);
  }, [autoGroups, items]);

  useEffect(() => {
    onTilesStateChange?.(tiles.length > 0);
  }, [onTilesStateChange, tiles.length]);

  useEffect(() => {
    onGroupedKeywordsChange?.(tiles.map((t) => t.keyword));
  }, [onGroupedKeywordsChange, tiles]);

  if (tiles.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="font-display text-lg font-bold tracking-wider text-foreground mb-4 uppercase">
        Browse by Category
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {tiles.map((tile, i) => (
          <motion.div
            key={tile.slug}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="relative"
          >
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingTile(tile);
                  setEditName(tile.displayName);
                  setEditImageUrl(tile.image || "");
                }}
                className="absolute top-1.5 right-1.5 z-10 p-1.5 rounded-md bg-background/80 backdrop-blur border border-border/50 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                title="Edit collection"
                aria-label="Edit collection"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <Link
              to={`/collection/${tile.slug}`}
              className="group relative glass rounded-xl overflow-hidden border border-border/30 hover:border-primary/50 transition-all hover:shadow-lg block"
            >
              <div className="aspect-square overflow-hidden bg-background/50 p-2">
                {tile.image ? (
                  <img
                    src={tile.image}
                    alt={tile.displayName}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="p-2.5 text-center">
                <p className="font-display text-xs font-bold tracking-wider text-foreground truncate">
                  {tile.displayName}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {tile.count} {tile.count === 1 ? "product" : "products"}
                </p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!editingTile} onOpenChange={(open) => !open && setEditingTile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Collection Tile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-display">Display Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Collection name"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-display">Image URL</Label>
              <Input
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
              <div className="mt-2">
                <Label className="text-sm font-display">Or upload from device</Label>
                <div className="mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => document.getElementById("auto-group-tile-upload")?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Uploading..." : "Choose File"}
                  </Button>
                  <input
                    id="auto-group-tile-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !editingTile) return;
                      setUploading(true);
                      try {
                        const ext = file.name.split(".").pop() || "webp";
                        const path = `collections/${editingTile.slug}-${Date.now()}.${ext}`;
                        const { error: upErr } = await supabase.storage
                          .from("product-images")
                          .upload(path, file, { upsert: true });
                        if (upErr) throw upErr;
                        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
                        setEditImageUrl(urlData.publicUrl);
                        toast.success("Image uploaded");
                      } catch (err: any) {
                        toast.error(err.message || "Upload failed");
                      } finally {
                        setUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            {editImageUrl && (
              <div>
                <Label className="text-sm font-display mb-2 block">Preview</Label>
                <div className="rounded-lg overflow-hidden border border-border/50 aspect-square max-w-[150px] bg-background/50 p-2">
                  <img src={editImageUrl} alt="Preview" className="w-full h-full object-contain" />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditingTile(null)}>Cancel</Button>
              <Button
                disabled={saving}
                onClick={async () => {
                  if (!editingTile) return;
                  setSaving(true);
                  try {
                    const { error } = await supabase
                      .from("collections")
                      .update({
                        name: editName || editingTile.displayName,
                        image_url: editImageUrl || null,
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", editingTile.collectionId);
                    if (error) throw error;
                    toast.success("Collection updated");
                    refreshGroups();
                    setEditingTile(null);
                  } catch (err: any) {
                    toast.error(err.message || "Failed to save");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutoGroupTiles;
