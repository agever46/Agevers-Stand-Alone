import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Mail, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface DiscountCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  min_order_amount: number;
  max_order_amount: number;
  emailed_at: string | null;
  created_at: string;
}

const generateRandomCode = (length = 8) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const AdminDiscountCodes = () => {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [codeType, setCodeType] = useState<"random" | "custom">("random");
  const [customCode, setCustomCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresIn, setExpiresIn] = useState("never");
  const [minOrder, setMinOrder] = useState("");
  const [maxOrder, setMaxOrder] = useState("");
  const [creating, setCreating] = useState(false);
  const [emailing, setEmailing] = useState<string | null>(null);

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    const { data, error } = await supabase
      .from("discount_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCodes(data as any);
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleCreate = async () => {
    const value = parseFloat(discountValue);
    if (!value || value <= 0) {
      toast.error("Enter a valid discount value");
      return;
    }
    if (discountType === "percentage" && value > 100) {
      toast.error("Percentage cannot exceed 100%");
      return;
    }

    const code = codeType === "random" ? generateRandomCode() : customCode.trim().toUpperCase();
    if (!code) {
      toast.error("Enter a code name");
      return;
    }

    let expiresAt: string | null = null;
    if (expiresIn !== "never") {
      const now = new Date();
      const hours = parseInt(expiresIn);
      now.setHours(now.getHours() + hours);
      expiresAt = now.toISOString();
    }

    setCreating(true);
    const { error } = await supabase.from("discount_codes").insert({
      code,
      discount_type: discountType,
      discount_value: value,
      max_uses: maxUses ? parseInt(maxUses) : null,
      min_order_amount: minOrder ? parseFloat(minOrder) : 0,
      max_order_amount: maxOrder ? parseFloat(maxOrder) : 0,
      expires_at: expiresAt,
    } as any);

    if (error) {
      toast.error(error.code === "23505" ? "Code already exists" : error.message);
    } else {
      toast.success(`Code ${code} created!`);
      setCustomCode("");
      setDiscountValue("");
      setMaxUses("");
      setMinOrder("");
      setMaxOrder("");
      fetchCodes();
    }
    setCreating(false);
  };

  const handleToggle = async (id: string, current: boolean) => {
    await supabase.from("discount_codes").update({ is_active: !current } as any).eq("id", id);
    fetchCodes();
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Delete code "${code}"?`)) return;
    await supabase.from("discount_codes").delete().eq("id", id);
    toast.success("Deleted");
    fetchCodes();
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };

  const handleEmailNewsletter = async (discountCode: DiscountCode) => {
    if (!confirm(`Send "${discountCode.code}" to all newsletter subscribers?`)) return;
    setEmailing(discountCode.id);

    const { data: subscribers, error: subErr } = await supabase
      .from("newsletter_subscribers")
      .select("email");
    
    if (subErr || !subscribers?.length) {
      toast.error(subscribers?.length === 0 ? "No newsletter subscribers" : subErr?.message || "Error");
      setEmailing(null);
      return;
    }

    await supabase.from("discount_codes").update({ emailed_at: new Date().toISOString() } as any).eq("id", discountCode.id);
    toast.success(`Code ready to send to ${subscribers.length} subscribers. Email campaign feature coming soon!`);
    setEmailing(null);
    fetchCodes();
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return "Never";
    const d = new Date(expiresAt);
    const now = new Date();
    if (d < now) return "Expired";
    const diff = d.getTime() - now.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h left`;
    return `${hours}h left`;
  };

  return (
    <div className="space-y-6">
      <div className="border border-border rounded-lg p-4 bg-secondary/30 space-y-4">
        <h3 className="font-display text-sm font-semibold text-primary">Create Discount Code</h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Code Type</label>
            <select
              value={codeType}
              onChange={(e) => setCodeType(e.target.value as any)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="random">Random</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {codeType === "custom" && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Code Name</label>
              <Input
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                placeholder="e.g. SUMMER25"
                maxLength={20}
              />
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Discount Type</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as any)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (€)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Value {discountType === "percentage" ? "(%)" : "(€)"}
            </label>
            <Input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "percentage" ? "e.g. 15" : "e.g. 5.00"}
              min="0"
              max={discountType === "percentage" ? "100" : undefined}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Max Uses (empty = unlimited)</label>
            <Input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited"
              min="1"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Expires After</label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="never">Never</option>
              <option value="1">1 hour</option>
              <option value="6">6 hours</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
              <option value="720">30 days</option>
              <option value="2160">90 days</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Min Order (€, 0 = none)</label>
            <Input
              type="number"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              placeholder="0"
              min="0"
            />
          </div>

          {/* Max order */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Max Order (€, 0 = none)</label>
            <Input
              type="number"
              value={maxOrder}
              onChange={(e) => setMaxOrder(e.target.value)}
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        <Button onClick={handleCreate} disabled={creating} className="gap-2">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create Code
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : codes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No discount codes yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 px-3 text-xs text-muted-foreground font-display">Code</th>
                <th className="py-2 px-3 text-xs text-muted-foreground font-display">Discount</th>
                <th className="py-2 px-3 text-xs text-muted-foreground font-display">Uses</th>
                <th className="py-2 px-3 text-xs text-muted-foreground font-display">Expires</th>
                <th className="py-2 px-3 text-xs text-muted-foreground font-display">Min Order</th>
                <th className="py-2 px-3 text-xs text-muted-foreground font-display">Max Order</th>
                <th className="py-2 px-3 text-xs text-muted-foreground font-display">Emailed</th>
                <th className="py-2 px-3 text-xs text-muted-foreground font-display">Active</th>
                <th className="py-2 px-3 text-xs text-muted-foreground font-display">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const expired = c.expires_at && new Date(c.expires_at) < new Date();
                const maxReached = c.max_uses && c.used_count >= c.max_uses;
                return (
                  <tr key={c.id} className={`border-b border-border/50 ${expired || maxReached ? "opacity-50" : ""}`}>
                    <td className="py-2 px-3">
                      <span className="font-mono font-bold text-primary">{c.code}</span>
                    </td>
                    <td className="py-2 px-3">
                      {c.discount_type === "percentage" ? `${c.discount_value}%` : `€${c.discount_value}`}
                    </td>
                    <td className="py-2 px-3">
                      {c.used_count}{c.max_uses ? `/${c.max_uses}` : " / ∞"}
                    </td>
                    <td className="py-2 px-3">
                      <span className={expired ? "text-destructive" : ""}>{formatExpiry(c.expires_at)}</span>
                    </td>
                    <td className="py-2 px-3">
                      {c.min_order_amount > 0 ? `€${c.min_order_amount}` : "—"}
                    </td>
                    <td className="py-2 px-3">
                      {c.max_order_amount > 0 ? `€${c.max_order_amount}` : "—"}
                    </td>
                    <td className="py-2 px-3">
                      {c.emailed_at ? (
                        <span className="text-xs text-green-400">✓ Sent</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={() => handleToggle(c.id, c.is_active)}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopy(c.code)}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy code"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleEmailNewsletter(c)}
                          disabled={!!emailing}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          title="Send to newsletter subscribers"
                        >
                          {emailing === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Mail className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.code)}
                          className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDiscountCodes;
