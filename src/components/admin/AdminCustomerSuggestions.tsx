import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Inbox, Package, Bug, Lightbulb, Sparkles, Trash2, Mail } from "lucide-react";

interface Suggestion {
  id: string;
  user_id: string | null;
  email: string | null;
  type: "product_request" | "bug_report" | "feature_request" | "other";
  subject: string;
  message: string;
  status: "new" | "reviewing" | "accepted" | "rejected" | "done";
  admin_note: string | null;
  created_at: string;
}

const typeMeta: Record<string, { label: string; icon: typeof Inbox; className: string }> = {
  product_request: { label: "Product Request", icon: Package, className: "bg-primary/15 text-primary border-primary/30" },
  bug_report: { label: "Bug Report", icon: Bug, className: "bg-red-500/15 text-red-400 border-red-500/30" },
  feature_request: { label: "Feature", icon: Lightbulb, className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  other: { label: "Other", icon: Sparkles, className: "bg-muted text-muted-foreground border-border" },
};

const statuses = ["new", "reviewing", "accepted", "rejected", "done"] as const;

const AdminCustomerSuggestions = () => {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from("customer_suggestions" as any)
      .select("*")
      .order("created_at", { ascending: false }) as any);
    if (error) toast.error("Failed to load suggestions");
    setItems((data || []) as Suggestion[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await (supabase.from("customer_suggestions" as any).update({ status }).eq("id", id) as any);
    if (error) return toast.error("Update failed");
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: status as any } : i)));
  };

  const updateNote = async (id: string, admin_note: string) => {
    const { error } = await (supabase.from("customer_suggestions" as any).update({ admin_note }).eq("id", id) as any);
    if (error) return toast.error("Failed to save note");
    toast.success("Note saved");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this suggestion?")) return;
    const { error } = await (supabase.from("customer_suggestions" as any).delete().eq("id", id) as any);
    if (error) return toast.error("Delete failed");
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.type === filter || i.status === filter);

  const counts = {
    all: items.length,
    new: items.filter((i) => i.status === "new").length,
    product_request: items.filter((i) => i.type === "product_request").length,
    bug_report: items.filter((i) => i.type === "bug_report").length,
    feature_request: items.filter((i) => i.type === "feature_request").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Suggestion Mailbox
          </h2>
          <p className="text-sm text-muted-foreground">Product requests, bug reports and feature ideas submitted from the homepage mailbox.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "all", label: `All (${counts.all})` },
            { id: "new", label: `New (${counts.new})` },
            { id: "product_request", label: `Products (${counts.product_request})` },
            { id: "bug_report", label: `Bugs (${counts.bug_report})` },
            { id: "feature_request", label: `Features (${counts.feature_request})` },
          ].map((b) => (
            <Button key={b.id} size="sm" variant={filter === b.id ? "default" : "outline"} onClick={() => setFilter(b.id)}>
              {b.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
          No suggestions yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const meta = typeMeta[s.type] || typeMeta.other;
            const Icon = meta.icon;
            return (
              <Card key={s.id} className="p-5 space-y-3 border-2 border-primary/30 hover:border-primary/60 transition-colors shadow-lg shadow-primary/5 rounded-xl bg-card/60 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-[260px]">
                    <div className={`h-10 w-10 rounded-lg border flex items-center justify-center ${meta.className}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                        <Badge variant="outline">{s.status}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                      </div>
                      <div className="font-bold mt-1">{s.subject}</div>
                      <div className="text-xs text-muted-foreground">
                        from <a href={`mailto:${s.email}`} className="underline">{s.email || "—"}</a>
                        {s.user_id && <span className="ml-2 opacity-70">(account)</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={s.status} onValueChange={(v) => updateStatus(s.id, v)}>
                      <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 border">{s.message}</div>
                <details>
                  <summary className="text-xs text-muted-foreground cursor-pointer">Internal note</summary>
                  <Textarea
                    defaultValue={s.admin_note || ""}
                    placeholder="Add an internal note…"
                    className="mt-2"
                    onBlur={(e) => {
                      if (e.target.value !== (s.admin_note || "")) updateNote(s.id, e.target.value);
                    }}
                  />
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminCustomerSuggestions;