import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, AlertTriangle, Send, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type Provider = "lovable" | "resend";

const AdminEmailProvider = () => {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase
        .from("site_settings" as any)
        .select("email_provider")
        .eq("id", 1)
        .single() as any);
      setProvider((data?.email_provider as Provider) ?? "lovable");
    })();
  }, []);

  const handleToggle = async (useResend: boolean) => {
    const next: Provider = useResend ? "resend" : "lovable";
    setSaving(true);
    const { error } = await (supabase
      .from("site_settings" as any)
      .update({ email_provider: next, updated_at: new Date().toISOString() })
      .eq("id", 1) as any);
    setSaving(false);
    if (error) {
      toast.error("Failed to update email provider");
      return;
    }
    setProvider(next);
    toast.success(
      next === "resend"
        ? "✓ Now sending via Resend"
        : "✓ Now sending via Lovable Emails"
    );
  };

  const sendTest = async () => {
    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setTesting(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "email-verification",
            recipientEmail: testEmail,
            idempotencyKey: `test-${Date.now()}`,
            templateData: { name: "Admin Test", verificationUrl: "https://agevers.com" },
          },
        }
      );
      if (error) throw error;
      setLastResult({ ok: true, data });
      toast.success(
        `Sent via ${data?.provider || provider} — check inbox for ${testEmail}`
      );
    } catch (err: any) {
      setLastResult({ ok: false, error: err?.message || String(err) });
      toast.error(`Failed: ${err?.message || err}`);
    } finally {
      setTesting(false);
    }
  };

  if (provider === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isResend = provider === "resend";

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Mail className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Email Provider</h1>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Send emails via Resend</h2>
            <p className="text-sm text-muted-foreground">
              When ON, all transactional emails (verification, orders, tickets,
              etc.) are sent through Resend's API. When OFF, the default Lovable
              Emails infrastructure is used.
            </p>
          </div>
          <Switch
            checked={isResend}
            disabled={saving}
            onCheckedChange={handleToggle}
          />
        </div>

        <div
          className={`rounded-lg border p-4 text-sm ${
            isResend
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-blue-500/40 bg-blue-500/10 text-blue-200"
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <strong>Active provider:</strong>{" "}
              {isResend
                ? "RESEND — emails are sent immediately via Resend API."
                : "LOVABLE EMAILS — using built-in queue with retries."}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Send Test Email</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Sends a real email using the currently active provider above. Use
          this to verify your DNS / API key is working correctly.
        </p>

        <div className="space-y-2">
          <Label htmlFor="test-email">Recipient email</Label>
          <div className="flex gap-2">
            <Input
              id="test-email"
              type="email"
              placeholder="you@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <Button onClick={sendTest} disabled={testing || !testEmail}>
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="ml-2">Send Test</span>
            </Button>
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
            <div className="font-semibold mb-1 flex items-center gap-2">
              {lastResult.ok ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Sent successfully
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Send failed
                </>
              )}
            </div>
            <pre className="overflow-auto text-[10px] mt-2">
              {JSON.stringify(lastResult.ok ? lastResult.data : lastResult.error, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminEmailProvider;
