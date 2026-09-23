import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, CheckSquare, X } from "lucide-react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import AdminProductEditModal from "@/components/admin/AdminProductEditModal";

const TARGET_PLATFORMS: { label: string; platform: string; store: string; tab: string }[] = [
  { label: "Games", platform: "PC", store: "Steam", tab: "games" },
  { label: "Gift Cards", platform: "Gift Cards", store: "Gift Cards", tab: "gift-cards" },
  { label: "In-Game Items", platform: "In-Game Items", store: "In-Game Items", tab: "in-game-items" },
  { label: "Mobile", platform: "Mobile", store: "Mobile", tab: "mobile" },
  { label: "Software", platform: "Software", store: "Software", tab: "software" },
  { label: "Media & Streaming", platform: "Media & Streaming", store: "Media & Streaming", tab: "subscriptions" },
  { label: "PlayStation", platform: "PlayStation", store: "PlayStation", tab: "games" },
  { label: "Xbox", platform: "Xbox", store: "Xbox", tab: "games" },
  { label: "Nintendo", platform: "Nintendo", store: "Nintendo", tab: "games" },
];

interface Props {
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  visibleIds: string[];
  onComplete?: () => void;
}

/**
 * Reusable admin toolbar for custom category pages (GiftCards, MediaStreaming, PreOrder).
 * Lets admins bulk-reclassify selected products by moving them to a different platform/store.
 */
export const AdminBulkPlatformBar = ({
  selectMode,
  setSelectMode,
  selectedIds,
  setSelectedIds,
  visibleIds,
  onComplete,
}: Props) => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [working, setWorking] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editProducts, setEditProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc("check_my_role" as any, { _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  if (!isAdmin) return null;

  const openEdit = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one product");
      return;
    }
    const ids = Array.from(selectedIds);
    const { data, error } = await supabase
      .from("allowed_products")
      .select("id, title, description, platform, store, region, image_url, badges")
      .in("id", ids);
    if (error) {
      toast.error(`Load failed: ${error.message}`);
      return;
    }
    setEditProducts(
      (data || []).map((ap: any) => ({
        allowed_product_id: ap.id,
        title: ap.title || "",
        description: ap.description,
        platform: ap.platform || "PC",
        store: ap.store || "Steam",
        region: ap.region || "Global",
        image_url: ap.image_url,
        badges: ap.badges || [],
      }))
    );
    setEditOpen(true);
  };

  const moveTo = async (target: typeof TARGET_PLATFORMS[number]) => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one product");
      return;
    }
    setWorking(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("allowed_products")
      .update({ platform: target.platform, store: target.store, tab_category: target.tab } as any)
      .in("id", ids);
    setWorking(false);
    if (error) {
      toast.error(`Move failed: ${error.message}`);
      return;
    }
    toast.success(`Moved ${ids.length} product${ids.length === 1 ? "" : "s"} to ${target.label}`);
    setSelectedIds(new Set());
    setSelectMode(false);
    onComplete?.();
  };

  return (
    <div className="flex flex-wrap items-center justify-start gap-2 mb-4">
      <Button
        variant={selectMode ? "default" : "outline"}
        size="sm"
        onClick={() => {
          setSelectMode(!selectMode);
          setSelectedIds(new Set());
        }}
      >
        <CheckSquare className="h-4 w-4 mr-1" />
        {selectMode ? "Cancel" : "Select"}
      </Button>
      {selectMode && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set(visibleIds))}
          >
            Select All ({visibleIds.length})
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-4 w-4 mr-1" /> Clear ({selectedIds.size})
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={selectedIds.size === 0 || working}>
                Move to <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background border border-border z-50">
              <DropdownMenuLabel>Move {selectedIds.size} to...</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {TARGET_PLATFORMS.map((t) => (
                <DropdownMenuItem key={t.label} onClick={() => moveTo(t)}>
                  {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={openEdit}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit ({selectedIds.size})
          </Button>
        </>
      )}
      <AdminProductEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        products={editProducts}
        onSaved={() => {
          setEditOpen(false);
          setSelectedIds(new Set());
          setSelectMode(false);
          onComplete?.();
        }}
      />
    </div>
  );
};

export default AdminBulkPlatformBar;