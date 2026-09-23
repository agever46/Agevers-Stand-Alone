import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Wallet, ArrowDownToLine, Clock, CheckCircle, XCircle, Loader2, ChevronDown, Link2 } from "lucide-react";
import paypalLogo from "@/assets/paypal-logo.png";
import payoneerLogo from "@/assets/payoneer-logo.png";
import AgeversLoader from "@/components/AgeversLoader";

interface WithdrawalRequest {
  id: string;
  amount: number;
  method: string;
  paypal_email: string | null;
  payoneer_email: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
}

const SellerWithdrawals = () => {
  const { user } = useAuth();
  const [availableBalance, setAvailableBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [method, setMethod] = useState<"paypal" | "payoneer" | null>(null);
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Linked payment accounts
  const [linkedPaypal, setLinkedPaypal] = useState<string | null>(null);
  const [linkedPayoneer, setLinkedPayoneer] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
    fetchLinkedAccounts();
  }, [user]);

  const fetchLinkedAccounts = async () => {
    const { data } = await supabase
      .from("seller_payment_accounts" as any)
      .select("paypal_email, payoneer_email")
      .eq("seller_id", user!.id)
      .single();
    if (data) {
      const d = data as any;
      setLinkedPaypal(d.paypal_email);
      setLinkedPayoneer(d.payoneer_email);
    }
  };

  const fetchData = async () => {
    const [salesRes, withdrawalsRes] = await Promise.all([
      supabase.from("seller_sales").select("net_earnings, available_at").eq("seller_id", user!.id),
      supabase.from("withdrawal_requests" as any).select("*").eq("seller_id", user!.id).order("created_at", { ascending: false }),
    ]);

    if (salesRes.data) {
      const now = new Date();
      const available = salesRes.data
        .filter((s: any) => new Date(s.available_at) <= now)
        .reduce((sum: number, s: any) => sum + Number(s.net_earnings), 0);
      
      const pendingWithdrawn = (withdrawalsRes.data || [])
        .filter((w: any) => w.status === "pending" || w.status === "approved" || w.status === "completed")
        .reduce((sum: number, w: any) => sum + Number(w.amount), 0);
      
      setAvailableBalance(Math.max(0, available - pendingWithdrawn));
    }

    if (withdrawalsRes.data) setWithdrawals(withdrawalsRes.data as any);
    setLoading(false);
  };

  // Auto-fill email when method changes
  const handleMethodChange = (newMethod: "paypal" | "payoneer") => {
    if (method === newMethod) {
      setMethod(null);
      setEmail("");
      return;
    }
    setMethod(newMethod);
    if (newMethod === "paypal" && linkedPaypal) {
      setEmail(linkedPaypal);
    } else if (newMethod === "payoneer" && linkedPayoneer) {
      setEmail(linkedPayoneer);
    } else {
      setEmail("");
    }
  };

  const handleSubmit = async () => {
    if (!method) { toast.error("Select a payment method"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > availableBalance) { toast.error("Amount exceeds available balance"); return; }
    if (!email.trim() || !email.includes("@")) { toast.error("Enter a valid email"); return; }
    const minAmount = method === "payoneer" ? 100 : 60;
    if (amt < minAmount) { toast.error(`Minimum withdrawal via ${method === "payoneer" ? "Payoneer" : "PayPal"} is $${minAmount}.00`); return; }

    setSubmitting(true);
    // The server recalculates the available balance and re-checks the minimum,
    // so the amount typed in the browser can never exceed real earnings.
    const { error } = await supabase.rpc("request_withdrawal" as any, {
      _amount: amt,
      _method: method,
      _email: email.trim(),
    } as any);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Withdrawal request submitted! You'll be notified when it's processed.");
      setShowForm(false);
      setAmount("");
      setEmail("");
      fetchData();
    }
    setSubmitting(false);
  };

  const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    pending: { icon: <Clock className="h-4 w-4" />, label: "Processing", color: "text-yellow-500" },
    approved: { icon: <CheckCircle className="h-4 w-4" />, label: "Approved", color: "text-blue-500" },
    completed: { icon: <CheckCircle className="h-4 w-4" />, label: "Completed", color: "text-neon-green" },
    rejected: { icon: <XCircle className="h-4 w-4" />, label: "Rejected", color: "text-destructive" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <AgeversLoader />
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-black tracking-wider text-foreground mb-6">WITHDRAWALS</h2>

      {/* Balance card */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1">Available for Withdrawal</p>
            <p className="font-display text-3xl font-black text-primary">€{availableBalance.toFixed(2)}</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            disabled={availableBalance < 60}
            className="gap-2"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Withdraw Funds
          </Button>
        </div>
        {availableBalance < 60 && (
          <p className="text-xs text-muted-foreground mt-2">Minimum withdrawal: $60 (PayPal) / $100 (Payoneer)</p>
        )}
      </div>

      {/* Withdrawal form */}
      {showForm && (
        <div className="glass rounded-xl p-6 mb-6 space-y-3 max-w-lg">
          <h3 className="font-display text-sm font-bold tracking-widest text-foreground uppercase">Request Withdrawal</h3>
          <label className="text-xs text-muted-foreground font-display block uppercase tracking-wider">Choose Payment Method</label>

          {/* PayPal */}
          <div>
            <button
              onClick={() => handleMethodChange("paypal")}
              className={`w-full p-4 rounded-xl border-2 transition-all font-display text-sm font-bold tracking-wide flex items-center gap-3 ${
                method === "paypal"
                  ? "border-[#0070ba] bg-white text-[#003087] shadow-[0_0_14px_rgba(0,112,186,0.2)]"
                  : "border-border bg-white text-[#003087] hover:border-[#0070ba]/50"
              }`}
            >
              <img src={paypalLogo} alt="PayPal" className="h-12 w-12 object-contain" />
              PayPal
              {linkedPaypal && (
                <span className="inline-flex items-center gap-1 text-[10px] text-neon-green font-medium ml-1">
                  <Link2 className="h-3 w-3" /> Linked
                </span>
              )}
              {method === "paypal" && <ChevronDown className="h-4 w-4 ml-auto" />}
            </button>
            {method === "paypal" && (
              <div className="mt-2 ml-4 mr-2 p-4 rounded-lg border border-[#0070ba]/30 bg-[#0070ba]/5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="text-xs text-muted-foreground font-display mb-1 block uppercase tracking-wider">PayPal Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your PayPal email" />
                  {linkedPaypal && email === linkedPaypal && (
                    <p className="text-[10px] text-neon-green mt-1 flex items-center gap-1"><Link2 className="h-3 w-3" /> Using linked account</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-display mb-1 block uppercase tracking-wider">Amount (EUR)</label>
                  <div className="flex gap-2">
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="60" max={availableBalance} step="0.01" />
                    <Button variant="outline" onClick={() => setAmount(availableBalance.toFixed(2))} className="shrink-0 text-xs">Max</Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Minimum withdrawal: $60.00</p>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                    Submit Request
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          {/* Payoneer */}
          <div>
            <button
              onClick={() => handleMethodChange("payoneer")}
              className={`w-full p-4 rounded-xl border-2 transition-all font-display text-sm font-bold tracking-wide flex items-center gap-3 ${
                method === "payoneer"
                  ? "border-[#FF6C00] bg-white shadow-[0_0_16px_rgba(255,108,0,0.25)]"
                  : "border-border bg-white hover:border-[#FF6C00]/50"
              }`}
            >
              <img src={payoneerLogo} alt="Payoneer" className="h-12 w-12 object-contain mix-blend-multiply dark:mix-blend-normal" />
              <span className="bg-gradient-to-r from-[#FF4500] via-[#FF6C00] to-[#00C9A7] bg-clip-text text-transparent">Payoneer</span>
              {linkedPayoneer && (
                <span className="inline-flex items-center gap-1 text-[10px] text-neon-green font-medium ml-1">
                  <Link2 className="h-3 w-3" /> Linked
                </span>
              )}
              {method === "payoneer" && <ChevronDown className="h-4 w-4 ml-auto text-[#FF6C00]" />}
            </button>
            {method === "payoneer" && (
              <div className="mt-2 ml-4 mr-2 p-4 rounded-lg border border-[#FF6C00]/30 bg-[#FF6C00]/5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="text-xs text-muted-foreground font-display mb-1 block uppercase tracking-wider">Payoneer Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your Payoneer email" />
                  {linkedPayoneer && email === linkedPayoneer && (
                    <p className="text-[10px] text-neon-green mt-1 flex items-center gap-1"><Link2 className="h-3 w-3" /> Using linked account</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-display mb-1 block uppercase tracking-wider">Amount (EUR)</label>
                  <div className="flex gap-2">
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="100" max={availableBalance} step="0.01" />
                    <Button variant="outline" onClick={() => setAmount(availableBalance.toFixed(2))} className="shrink-0 text-xs">Max</Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Minimum withdrawal: $100.00</p>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                    Submit Request
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Withdrawal history */}
      {withdrawals.length === 0 ? (
        <div className="text-center py-16 glass rounded-xl">
          <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-display">No withdrawal requests yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto glass rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Date</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Method</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Email</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Amount</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Status</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Note</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => {
                const cfg = statusConfig[w.status] || statusConfig.pending;
                return (
                  <tr key={w.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                    <td className="p-4 text-muted-foreground text-xs">
                      {new Date(w.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-foreground font-medium capitalize">{w.method}</td>
                    <td className="p-4 text-muted-foreground text-xs">{w.paypal_email || w.payoneer_email}</td>
                    <td className="p-4 text-foreground font-semibold">€{Number(w.amount).toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 ${cfg.color} font-medium`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs max-w-[200px] truncate">{w.admin_note || "—"}</td>
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

export default SellerWithdrawals;