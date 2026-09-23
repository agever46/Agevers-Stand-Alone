import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload, Trash2, Download, Key } from "lucide-react";
import AgeversLoader from "@/components/AgeversLoader";

interface ManualKey {
  id: string;
  key_code: string;
  status: string;
  added_at: string;
  sold_at: string | null;
  order_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowedProductId: string;
  productTitle: string;
  userId: string;
  onKeysChanged?: () => void;
}

const AdminManualKeys = ({ open, onOpenChange, allowedProductId, productTitle, userId, onKeysChanged }: Props) => {
  const [keys, setKeys] = useState<ManualKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadText, setUploadText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (open) fetchKeys();
  }, [open, allowedProductId]);

  const fetchKeys = async () => {
    setLoading(true);
    const { data } = await (supabase
      .from("product_keys")
      .select("id, key_code, status, added_at, sold_at, order_id") as any)
      .eq("allowed_product_id", allowedProductId)
      .order("added_at", { ascending: true });
    if (data) setKeys(data as any);
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!uploadText.trim()) return;
    setUploading(true);
    const newKeys = uploadText.split("\n").map(k => k.trim()).filter(Boolean);
    const rows = newKeys.map(k => ({
      allowed_product_id: allowedProductId,
      seller_id: userId,
      key_code: k,
      status: "active",
    }));
    const { error } = await supabase.from("product_keys").insert(rows as any);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${newKeys.length} key(s) uploaded`);
      setUploadText("");
      setShowUpload(false);
      onKeysChanged?.();
      onOpenChange(false);
    }
    setUploading(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await supabase.from("product_keys").delete().eq("id", id);
    }
    toast.success(`${selectedIds.size} key(s) deleted`);
    setSelectedIds(new Set());
    fetchKeys();
    onKeysChanged?.();
  };

  const handleExport = () => {
    const csv = ["Key,Status,Added,Sold"]
      .concat(keys.map(k =>
        `${k.key_code},${k.status},${new Date(k.added_at).toLocaleDateString()},${k.sold_at ? new Date(k.sold_at).toLocaleDateString() : ""}`
      )).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manual-keys-${productTitle}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeKeys = keys.filter(k => k.status === "active");
  const soldKeys = keys.filter(k => k.status === "sold");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Manual Keys — {productTitle}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Manual keys are sent <span className="text-primary font-semibold">first</span> before Kinguin stock. When manual keys run out, the system falls back to Kinguin automatically.
        </p>

        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">Total: <span className="text-foreground font-semibold">{keys.length}</span></span>
          <span className="text-muted-foreground">Active: <span className="text-green-400 font-semibold">{activeKeys.length}</span></span>
          <span className="text-muted-foreground">Sold: <span className="text-muted-foreground font-semibold">{soldKeys.length}</span></span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-2" onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-3.5 w-3.5" /> Upload Keys
          </Button>
          {selectedIds.size > 0 && (
            <Button size="sm" variant="destructive" className="gap-2" onClick={handleDeleteSelected}>
              <Trash2 className="h-3.5 w-3.5" /> Delete ({selectedIds.size})
            </Button>
          )}
          {keys.length > 0 && (
            <Button size="sm" variant="outline" className="gap-2" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          )}
        </div>

        {/* Upload area */}
        {showUpload && (
          <div className="space-y-3 border border-border rounded-lg p-3 bg-secondary/30">
            <p className="text-xs text-muted-foreground">Paste key codes, one per line:</p>
            <Textarea
              value={uploadText}
              onChange={(e) => setUploadText(e.target.value)}
              placeholder={"XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY"}
              rows={5}
            />
            {uploadText && (
              <p className="text-xs text-muted-foreground">
                {uploadText.split("\n").filter(k => k.trim()).length} key(s)
              </p>
            )}
            <Button size="sm" onClick={handleUpload} disabled={uploading || !uploadText.trim()}>
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        )}

        {/* Keys table */}
        {loading ? (
          <div className="flex justify-center py-8">
            <AgeversLoader />
          </div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No manual keys yet. Upload key codes to get started.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="p-2 w-8">
                    <Checkbox
                      checked={selectedIds.size === keys.length && keys.length > 0}
                      onCheckedChange={() => {
                        if (selectedIds.size === keys.length) setSelectedIds(new Set());
                        else setSelectedIds(new Set(keys.map(k => k.id)));
                      }}
                    />
                  </th>
                  <th className="text-left p-2 text-xs text-muted-foreground uppercase">Key</th>
                  <th className="text-left p-2 text-xs text-muted-foreground uppercase">Status</th>
                  <th className="text-left p-2 text-xs text-muted-foreground uppercase">Added</th>
                  <th className="text-left p-2 text-xs text-muted-foreground uppercase">Sold</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id} className="border-b border-border/30 hover:bg-secondary/20">
                    <td className="p-2">
                      <Checkbox
                        checked={selectedIds.has(k.id)}
                        onCheckedChange={() => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(k.id)) next.delete(k.id); else next.add(k.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="p-2 font-mono text-xs text-foreground">{k.key_code}</td>
                    <td className="p-2">
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                        k.status === "sold" ? "bg-muted text-muted-foreground" :
                        k.status === "active" ? "bg-green-500/20 text-green-400" :
                        "bg-primary/10 text-primary"
                      }`}>
                        {k.status}
                      </span>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{new Date(k.added_at).toLocaleDateString()}</td>
                    <td className="p-2 text-xs text-muted-foreground">{k.sold_at ? new Date(k.sold_at).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminManualKeys;
