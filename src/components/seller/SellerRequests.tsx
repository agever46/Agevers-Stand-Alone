import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Send, Clock, CheckCircle, XCircle, Plus } from "lucide-react";
import { ALL_REGIONS } from "@/lib/regions";

const stores = ["Steam", "Microsoft Store", "GOG", "Epic Games", "Blizzard", "EA Games", "Rockstar"];
const platforms = ["PC", "PSN", "Xbox", "Nintendo"];

interface ProductRequest {
  id: string;
  title: string;
  platform: string;
  store: string;
  region: string;
  description: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
}

interface SellerRequestsProps {
  productRequests: ProductRequest[];
  onRefresh: () => void;
}

const SellerRequests = ({ productRequests, onRefresh }: SellerRequestsProps) => {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("PC");
  const [store, setStore] = useState("Steam");
  const [region, setRegion] = useState("Global");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) { toast({ title: "שגיאה", description: "נא למלא שם מוצר", variant: "destructive" }); return; }
    setSubmitting(true);
    const { error } = await supabase.from("product_requests").insert({
      requested_by: user!.id, title: title.trim().toUpperCase(),
      platform, store, region, description: description.trim() || null,
    } as any);
    if (error) { toast({ title: "שגיאה", description: error.message, variant: "destructive" }); }
    else {
      toast({ title: "הבקשה נשלחה בהצלחה", description: "האדמין יבדוק את הבקשה שלך" });
      setDialogOpen(false); setTitle(""); setPlatform("PC"); setStore("Steam"); setRegion("Global"); setDescription("");
      onRefresh();
    }
    setSubmitting(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-black tracking-wider text-foreground">PRODUCT REQUESTS</h2>
          <p className="text-muted-foreground text-sm mt-1">Request products to be added to the catalog</p>
        </div>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />Request Product
        </Button>
      </div>

      {productRequests.length === 0 ? (
        <div className="text-center py-16 glass rounded-xl">
          <Send className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-body text-sm">No product requests yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {productRequests.map((r) => (
            <div key={r.id} className="glass rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{r.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.platform}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground">{r.store}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground">{r.region}</span>
                </div>
                {r.admin_note && <p className="text-xs text-muted-foreground mt-1">Admin: {r.admin_note}</p>}
              </div>
              <div className="flex items-center gap-2">
                {r.status === "pending" && <Clock className="h-4 w-4 text-yellow-400" />}
                {r.status === "approved" && <CheckCircle className="h-4 w-4 text-green-400" />}
                {r.status === "rejected" && <XCircle className="h-4 w-4 text-destructive" />}
                <span className={`text-xs font-medium capitalize ${r.status === "pending" ? "text-yellow-400" : r.status === "approved" ? "text-green-400" : "text-destructive"}`}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-background border-border">
          <DialogHeader><DialogTitle className="font-display">Request New Product</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Submit a request for a product not in the catalog.</p>
          <div className="grid gap-4 mt-2">
            <div><Label>Product Name *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cyberpunk 2077" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Platform *</Label><Select value={platform} onValueChange={setPlatform}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{platforms.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Store *</Label><Select value={store} onValueChange={setStore}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{stores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Region</Label><Select value={region} onValueChange={setRegion}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ALL_REGIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why should this product be added?" rows={3} /></div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2"><Send className="h-4 w-4" />{submitting ? "Sending..." : "Submit Request"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellerRequests;
