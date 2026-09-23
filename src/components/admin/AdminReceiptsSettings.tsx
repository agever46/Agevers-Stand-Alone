import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Receipt, AlertTriangle, FlaskConical, Search, FileText, ExternalLink, Download, KeyRound } from "lucide-react";
import { toast } from "sonner";

const AdminReceiptsSettings = () => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderIdInput, setOrderIdInput] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [whoami, setWhoami] = useState<any>(null);
  const [checkingAccount, setCheckingAccount] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase
        .from("site_settings" as any)
        .select("receipts_enabled")
        .eq("id", 1)
        .single() as any);
      setEnabled(data?.receipts_enabled ?? false);
    })();
    loadRecentOrders();
  }, []);

  const loadRecentOrders = async () => {
    setLoadingOrders(true);
    const { data } = await supabase
      .from("orders")
      .select("id, game_title, price, quantity, status, created_at")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(10);
    setRecentOrders(data ?? []);
    setLoadingOrders(false);
  };

  const runSandboxTest = async (orderId: string) => {
    if (!orderId) {
      toast.error("Order ID is required");
      return;
    }
    setTesting(orderId);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-receipt", {
        body: { order_id: orderId, test: true },
      });
      if (error) throw error;
      setLastResult({ ok: true, data });
      toast.success("Sandbox receipt generated (test=1, NOT saved in Invoice Maven)");
    } catch (err: any) {
      setLastResult({ ok: false, error: err?.message || String(err) });
      toast.error(`Test failed: ${err?.message || err}`);
    } finally {
      setTesting(null);
    }
  };

  const checkAccount = async () => {
    setCheckingAccount(true);
    setWhoami(null);
    try {
      const { data, error } = await supabase.functions.invoke("invoice-maven-whoami", {
        body: {},
      });
      if (error) throw error;
      setWhoami(data);
      toast.success("Account check completed");
    } catch (err: any) {
      setWhoami({ error: err?.message || String(err) });
      toast.error(`Account check failed: ${err?.message || err}`);
    } finally {
      setCheckingAccount(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    const { error } = await (supabase
      .from("site_settings" as any)
      .update({ receipts_enabled: next, updated_at: new Date().toISOString() })
      .eq("id", 1) as any);
    setSaving(false);
    if (error) {
      toast.error("Failed to update setting");
      return;
    }
    setEnabled(next);
    toast.success(next ? "Receipts system enabled" : "Receipts system disabled");
  };

  if (enabled === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Receipt className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Receipts (Invoice Maven)</h1>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Auto Receipt Generation</h2>
            <p className="text-sm text-muted-foreground">
              When ON, customers can download receipts for completed orders, and
              receipts are issued via Invoice Maven. When OFF, no receipts will
              be created and the "Receipt" button is hidden from customers.
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={saving}
            onCheckedChange={handleToggle}
          />
        </div>

        <div
          className={`rounded-lg border p-4 text-sm ${
            enabled
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200"
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <strong>Status:</strong>{" "}
              {enabled
                ? "ENABLED — real receipts will be issued through Invoice Maven for every completed order."
                : "DISABLED — perfect for testing. No receipts will be created and customers won't see the download button."}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4 border-cyan-500/30 bg-cyan-500/5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold">Which Invoice Maven account is active?</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Runs a sandbox probe (<code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">test: 1</code>,
          nothing is stored) and shows a masked fingerprint of the stored API key.
          Compare the first/last 4 characters with the API key shown in each of your
          Invoice Maven accounts, and open the probe PDF to see the business name and
          exempt-dealer number printed in the header.
        </p>
        <Button onClick={checkAccount} disabled={checkingAccount} variant="secondary">
          {checkingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          <span className="ml-2">Check active account</span>
        </Button>
        {whoami && (
          <div className="rounded-lg border border-border p-3 text-xs space-y-2">
            {whoami.fingerprint && (
              <div className="font-mono">
                API key: {whoami.fingerprint.key_first4}…{whoami.fingerprint.key_last4}{" "}
                ({whoami.fingerprint.key_length} chars) · {whoami.fingerprint.contact_email}
              </div>
            )}
            {whoami.pdf_original && (
              <Button size="sm" variant="outline" onClick={() => window.open(whoami.pdf_original, "_blank")}>
                <FileText className="h-3 w-3 mr-1" />
                Open probe PDF
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
            <pre className="whitespace-pre-wrap break-all font-mono text-[10px]">
              {JSON.stringify(whoami, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4 border-purple-500/30 bg-purple-500/5">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-semibold">Sandbox Mode (Test Receipts)</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Generate a <strong className="text-purple-300">test receipt</strong> with
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">test: 1</code>
          sent to Invoice Maven. Test receipts are NOT saved in your tax records and
          are NOT cached locally — perfect for verifying the integration works end-to-end.
          Works regardless of the on/off toggle above (admin override).
        </p>

        <div className="space-y-2">
          <Label htmlFor="manual-order-id">Test by Order ID</Label>
          <div className="flex gap-2">
            <Input
              id="manual-order-id"
              placeholder="Paste order UUID here..."
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              className="font-mono text-xs"
            />
            <Button
              onClick={() => runSandboxTest(orderIdInput.trim())}
              disabled={testing !== null || !orderIdInput.trim()}
              variant="default"
            >
              {testing === orderIdInput.trim() ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              <span className="ml-2">Run Test</span>
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Recent Completed Orders</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadRecentOrders}
              disabled={loadingOrders}
            >
              {loadingOrders ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Search className="h-3 w-3" />
              )}
              <span className="ml-1 text-xs">Refresh</span>
            </Button>
          </div>
          <div className="rounded-lg border border-border divide-y divide-border max-h-72 overflow-auto">
            {recentOrders.length === 0 && !loadingOrders && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No completed orders yet
              </div>
            )}
            {recentOrders.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 p-3 hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {o.game_title || "Untitled order"}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {o.id} · €{Number(o.price).toFixed(2)} × {o.quantity ?? 1}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runSandboxTest(o.id)}
                  disabled={testing !== null}
                >
                  {testing === o.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FlaskConical className="h-3 w-3" />
                  )}
                  <span className="ml-1 text-xs">Test</span>
                </Button>
              </div>
            ))}
          </div>
        </div>

        {lastResult && (
          <div
            className={`rounded-lg border p-3 text-xs ${
              lastResult.ok
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/40 bg-red-500/10 text-red-200"
            }`}
          >
            <div className="font-semibold mb-1">
              {lastResult.ok ? "✓ Test result" : "✗ Test failed"}
            </div>
            {lastResult.ok && (lastResult.data?.pdf_original || lastResult.data?.pdf_copy) && (
              <div className="mb-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                {lastResult.data?.pdf_original && (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => window.open(lastResult.data.pdf_original, "_blank")}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Open PDF (Hebrew / שלך)
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          const res = await fetch(lastResult.data.pdf_original);
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `receipt-${lastResult.data.doc_no || "test"}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (err: any) {
                          toast.error(`Download failed: ${err?.message || err}`);
                        }
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download PDF (Hebrew)
                    </Button>
                  </>
                )}
                {lastResult.data?.pdf_copy && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(lastResult.data.pdf_copy, "_blank")}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    View Copy (English / לקוח)
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                )}
                {lastResult.data?.doc_no && (
                  <span className="text-xs self-center text-muted-foreground">
                    Doc #{lastResult.data.doc_no}
                  </span>
                )}
                </div>
                {lastResult.data?.pdf_original && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide opacity-70">
                      Original PDF link (Hebrew — your copy / העותק שלך):
                    </div>
                    <div className="flex gap-1">
                      <input
                        readOnly
                        value={lastResult.data.pdf_original}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="flex-1 bg-background/40 border border-border/40 rounded px-2 py-1 text-[10px] font-mono"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(lastResult.data.pdf_original);
                          toast.success("Copied!");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
                {lastResult.data?.pdf_copy && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wide opacity-70">
                      Copy PDF link (English — customer / לקוח):
                    </div>
                    <div className="flex gap-1">
                      <input
                        readOnly
                        value={lastResult.data.pdf_copy}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="flex-1 bg-background/40 border border-border/40 rounded px-2 py-1 text-[10px] font-mono"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(lastResult.data.pdf_copy);
                          toast.success("Copied!");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <pre className="whitespace-pre-wrap break-all font-mono text-[10px]">
              {JSON.stringify(lastResult.ok ? lastResult.data : lastResult.error, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-2 text-sm text-muted-foreground">
        <h3 className="text-base font-semibold text-foreground">How it works</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Only receipts (קבלה, doc_type 400) are ever issued — invoices / tax invoices
            are never created, and every document is sent with <code>no_vat: 1</code> (עוסק פטור).
          </li>
          <li>Currency sent to Invoice Maven is EUR; ILS conversion is handled on their side for tax reporting.</li>
          <li>Each receipt is cached — a second click reuses the same document and never charges twice.</li>
          <li>Sandbox tests bypass the cache and send <code>test: 1</code> — Invoice Maven will not save the document.</li>
        </ul>
      </Card>
    </div>
  );
};

export default AdminReceiptsSettings;