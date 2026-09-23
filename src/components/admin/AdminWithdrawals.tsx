import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Wallet, Loader2, DollarSign, Zap } from "lucide-react";

interface Withdrawal {
  id: string;
  seller_id: string;
  amount: number;
  method: string;
  paypal_email: string | null;
  payoneer_email: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  seller_name?: string;
  seller_email?: string;
}

const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("pending");

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    const { data, error } = await supabase
      .from("withdrawal_requests" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      const sellerIds = [...new Set((data as any[]).map((w: any) => w.seller_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", sellerIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p.display_name || p.username || "Unknown"])
      );

      setWithdrawals(
        (data as any[]).map((w: any) => ({
          ...w,
          seller_name: profileMap.get(w.seller_id) || "Unknown",
        }))
      );
    }
    setLoading(false);
  };

  const handleAction = async (id: string, status: "approved" | "completed" | "rejected") => {
    const note = status === "rejected" ? prompt("Rejection reason:") : null;
    if (status === "rejected" && note === null) return;

    setProcessingId(id);
    const { error } = await supabase
      .from("withdrawal_requests" as any)
      .update({
        status,
        admin_note: note || (status === "completed" ? "Payment sent" : status === "approved" ? "Approved" : null),
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Withdrawal ${status}`);
      fetchWithdrawals();
    }
    setProcessingId(null);
  };

  const handleApproveAndPay = async (withdrawal: Withdrawal) => {
    setProcessingId(withdrawal.id);

    // First approve
    const { error: approveError } = await supabase
      .from("withdrawal_requests" as any)
      .update({
        status: "approved",
        admin_note: "Approved - Processing PayPal payout...",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", withdrawal.id);

    if (approveError) {
      toast.error(approveError.message);
      setProcessingId(null);
      return;
    }

    // Then trigger auto-payout
    try {
      const { data, error } = await supabase.functions.invoke("paypal-payout", {
        body: { withdrawal_id: withdrawal.id },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      toast.success(`PayPal payout sent! Batch: ${data?.batch_id || "processing"}`);
      fetchWithdrawals();
    } catch (err: any) {
      toast.error(`Payout failed: ${err.message}. Withdrawal is approved - you can retry or mark paid manually.`);
      fetchWithdrawals();
    }
    setProcessingId(null);
  };

  const handleRetryPayout = async (withdrawal: Withdrawal) => {
    setProcessingId(withdrawal.id);
    try {
      const { data, error } = await supabase.functions.invoke("paypal-payout", {
        body: { withdrawal_id: withdrawal.id },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      toast.success(`PayPal payout sent! Batch: ${data?.batch_id || "processing"}`);
      fetchWithdrawals();
    } catch (err: any) {
      toast.error(`Payout failed: ${err.message}`);
    }
    setProcessingId(null);
  };

  const filtered = withdrawals.filter((w) => filter === "all" || w.status === filter);

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: "Pending", color: "text-yellow-500" },
    approved: { label: "Approved", color: "text-blue-500" },
    completed: { label: "Completed", color: "text-neon-green" },
    rejected: { label: "Rejected", color: "text-destructive" },
  };

  const pendingCount = withdrawals.filter((w) => w.status === "pending").length;
  const totalPending = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((sum, w) => sum + Number(w.amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <p className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase">Pending Requests</p>
          </div>
          <p className="font-display text-2xl font-black text-foreground">{pendingCount}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <p className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase">Total Pending Amount</p>
          </div>
          <p className="font-display text-2xl font-black text-primary">€{totalPending.toFixed(2)}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-neon-green/20 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-neon-green" />
            </div>
            <p className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase">Total Completed</p>
          </div>
          <p className="font-display text-2xl font-black text-neon-green">
            €{withdrawals.filter((w) => w.status === "completed").reduce((s, w) => s + Number(w.amount), 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["pending", "approved", "completed", "rejected", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wide transition-all capitalize ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/60 text-muted-foreground hover:bg-primary/20"
            }`}
          >
            {f} {f === "pending" && pendingCount > 0 && `(${pendingCount})`}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 glass rounded-xl">
          <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-display">No {filter !== "all" ? filter : ""} withdrawal requests</p>
        </div>
      ) : (
        <div className="overflow-x-auto glass rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Date</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Seller</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Method</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Email</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Amount</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Status</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => {
                const cfg = statusConfig[w.status] || statusConfig.pending;
                const isPaypal = w.method === "paypal";
                return (
                  <tr key={w.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                    <td className="p-4 text-muted-foreground text-xs">
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-foreground font-medium">{w.seller_name}</td>
                    <td className="p-4 text-foreground capitalize">{w.method}</td>
                    <td className="p-4 text-muted-foreground text-xs">{w.paypal_email || w.payoneer_email}</td>
                    <td className="p-4 text-foreground font-bold">€{Number(w.amount).toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="p-4">
                      {processingId === w.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : w.status === "pending" ? (
                        <div className="flex gap-2 flex-wrap">
                          {isPaypal && (
                            <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-[#0070ba] text-[#003087] hover:bg-[#0070ba]/10" onClick={() => handleApproveAndPay(w)}>
                              <Zap className="h-3 w-3" /> Approve & Pay
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleAction(w.id, "approved")}>
                            <CheckCircle className="h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1 text-destructive" onClick={() => handleAction(w.id, "rejected")}>
                            <XCircle className="h-3 w-3" /> Reject
                          </Button>
                        </div>
                      ) : w.status === "approved" ? (
                        <div className="flex gap-2">
                          {isPaypal && (
                            <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-[#0070ba] text-[#003087] hover:bg-[#0070ba]/10" onClick={() => handleRetryPayout(w)}>
                              <Zap className="h-3 w-3" /> Send PayPal
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleAction(w.id, "completed")}>
                            <DollarSign className="h-3 w-3" /> Mark Paid
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{w.admin_note || "—"}</span>
                      )}
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

export default AdminWithdrawals;