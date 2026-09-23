import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Status = "checking" | "up" | "down" | "unknown";

interface CronHealthRow {
  function_name: string;
  status: string;
  last_checked_at: string | null;
  last_ok_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
}

interface Item {
  name: string;
  label: string;
  group: string;
  status: Status;
  code?: number;
  ms?: number;
  error?: string;
}

const CRITICAL: { name: string; label: string; group: string }[] = [
  { name: "turnstile-verify", label: "Captcha verification (login)", group: "Auth & Security" },
  { name: "secure-signup", label: "Signup", group: "Auth & Security" },
  { name: "device-verify", label: "Device verification", group: "Auth & Security" },
  { name: "admin-users", label: "Admin users / permissions", group: "Auth & Security" },
  { name: "send-verification-email", label: "Email verification", group: "Auth & Security" },

  { name: "paypal-create-order", label: "PayPal create order", group: "Checkout" },
  { name: "paypal-capture-order", label: "PayPal capture order", group: "Checkout" },
  { name: "paypal-config", label: "PayPal config", group: "Checkout" },
  { name: "purchase-otp", label: "Purchase OTP (SMS/Email)", group: "Checkout" },
  { name: "notify-checkout-sms", label: "Checkout SMS", group: "Checkout" },
  { name: "fraud-check", label: "Fraud check", group: "Checkout" },

  { name: "fulfill-order", label: "Order fulfillment", group: "Fulfillment" },
  { name: "reveal-and-fulfill", label: "Reveal & fulfill", group: "Fulfillment" },
  { name: "kinguin-purchase", label: "Kinguin purchase", group: "Fulfillment" },
  { name: "kinguin-stock-sync", label: "Kinguin stock sync", group: "Fulfillment" },
  { name: "send-transactional-email", label: "Transactional emails", group: "Fulfillment" },

  { name: "exchange-rates", label: "Currency rates", group: "Site" },
  { name: "sitemap-xml", label: "Sitemap", group: "Site" },
  { name: "products-feed", label: "Product feed", group: "Site" },
  { name: "help-chat", label: "Help chat (AI)", group: "Site" },
];

const AdminFunctionHealth = () => {
  const [items, setItems] = useState<Item[]>(
    CRITICAL.map((c) => ({ ...c, status: "checking" as Status }))
  );
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [cronHealth, setCronHealth] = useState<CronHealthRow[]>([]);
  const [cronHealthLoading, setCronHealthLoading] = useState(true);

  const loadCronHealth = useCallback(async () => {
    const { data, error } = await supabase
      .from("cron_health_status")
      .select("function_name, status, last_checked_at, last_ok_at, last_failure_at, last_error, consecutive_failures")
      .order("function_name");
    if (!error) setCronHealth((data || []) as CronHealthRow[]);
    setCronHealthLoading(false);
  }, []);

  const runAll = useCallback(async () => {
    setRunning(true);
    setFatal(null);
    setItems(CRITICAL.map((c) => ({ ...c, status: "checking" as Status })));
    try {
      // The probe runs server-side: browsers cannot issue a raw OPTIONS request,
      // so checking from the client always reported "Failed to fetch".
      const { data, error } = await supabase.functions.invoke("function-health", {
        body: { functions: CRITICAL.map((c) => c.name) },
      });
      if (error) throw error;
      const byName = new Map<string, any>(
        (data?.results || []).map((r: any) => [r.name, r])
      );
      setItems(
        CRITICAL.map((c) => {
          const r = byName.get(c.name);
          if (!r) return { ...c, status: "down" as Status, error: "No result" };
          return {
            ...c,
            status: (r.up === null ? "unknown" : r.up ? "up" : "down") as Status,
            code: r.code,
            ms: r.ms,
            error: r.error || undefined,
          };
        })
      );
    } catch (e: any) {
      setFatal(e?.message || "Health check service unreachable");
      setItems(CRITICAL.map((c) => ({ ...c, status: "down" as Status, error: "Check failed" })));
    }
    setLastRun(new Date());
    setRunning(false);
  }, []);

  useEffect(() => {
    runAll();
    const id = setInterval(runAll, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [runAll]);

  useEffect(() => {
    loadCronHealth();
    const id = setInterval(loadCronHealth, 60 * 1000);
    return () => clearInterval(id);
  }, [loadCronHealth]);

  const down = items.filter((i) => i.status === "down");
  const groups = Array.from(new Set(CRITICAL.map((c) => c.group)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Function Health</h2>
          <p className="text-sm text-muted-foreground">
            Checks that every critical backend function is deployed and reachable.
            {lastRun && ` Last check: ${lastRun.toLocaleTimeString()}`}
          </p>
        </div>
        <Button onClick={runAll} disabled={running} variant="outline">
          {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Re-check
        </Button>
      </div>

      {fatal && !running && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">Health check service unavailable</p>
            <p className="text-muted-foreground">{fatal}</p>
          </div>
        </div>
      )}

      {!fatal && down.length > 0 && !running && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">
              {down.length} function{down.length > 1 ? "s are" : " is"} not responding
            </p>
            <p className="text-muted-foreground">
              {down.map((d) => d.name).join(", ")} — ask Lovable to redeploy {down.length > 1 ? "them" : "it"}.
            </p>
          </div>
        </div>
      )}

      {!fatal && down.length === 0 && !running && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium text-foreground">All critical functions are live.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g} className="rounded-xl border border-border bg-card/50 backdrop-blur p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g}</h3>
            <ul className="space-y-2">
              {items
                .filter((i) => i.group === g)
                .map((i) => (
                  <li key={i.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      {i.status === "checking" ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 animate-pulse shrink-0" />
                      ) : i.status === "up" ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/60 shrink-0" />
                      ) : i.status === "unknown" ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px] shadow-amber-500/60 shrink-0" />
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full bg-destructive shadow-[0_0_8px] shadow-destructive/60 shrink-0" />
                      )}
                      <span className="truncate text-foreground">{i.label}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {i.status === "checking" && "…"}
                      {i.status === "up" && `${i.ms}ms`}
                      {i.status === "unknown" && <span className="text-amber-500">{i.error || "Unknown"}</span>}
                      {i.status === "down" && (
                        <span className="flex items-center gap-1 text-destructive">
                          <XCircle className="h-3 w-3" /> {i.error}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        The check only sends a preflight request — no orders, emails or SMS are triggered. It runs automatically every 5 minutes while this page is open.
      </p>

      <div className="space-y-3 border-t border-border pt-6">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldAlert className="h-4 w-4" /> Cron Auth Monitor
          </h3>
          <p className="text-sm text-muted-foreground">
            Real auth checks (not just reachability) against the cron-invoked functions that were found silently 401ing on Aug 19–20, 2026.
            Runs every 30 minutes in the background and alerts Telegram after 2 consecutive failures.
          </p>
        </div>
        {cronHealthLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : cronHealth.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No data yet — the cron-health-monitor function hasn't run since it was deployed. It runs every 30 minutes.
          </p>
        ) : (
          <ul className="space-y-2 rounded-xl border border-border bg-card/50 backdrop-blur p-4">
            {cronHealth.map((c) => (
              <li key={c.function_name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  {c.status === "ok" ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/60 shrink-0" />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-destructive shadow-[0_0_8px] shadow-destructive/60 shrink-0" />
                  )}
                  <span className="truncate text-foreground">{c.function_name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground text-right">
                  {c.status === "ok" ? (
                    <>OK{c.last_ok_at && ` · ${new Date(c.last_ok_at).toLocaleTimeString()}`}</>
                  ) : (
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-3 w-3" /> {c.consecutive_failures} failed checks
                      {c.last_error && ` · ${c.last_error.slice(0, 60)}`}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminFunctionHealth;
