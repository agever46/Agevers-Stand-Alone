import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, PlayCircle, AlertTriangle, CheckCircle2, Clock, Timer } from "lucide-react";
import { toast } from "sonner";
import { useCronJobs } from "@/hooks/useCronJobs";
import { describeSchedule, secondsUntilNextRun, formatCountdown } from "@/lib/cronSchedule";

interface SyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  mode: string;
  batch_size: number;
  total_processed: number;
  updated: number;
  deactivated: number;
  reactivated: number;
  price_changed: number;
  expired: number;
  skipped: number;
  status: string;
  error_message: string | null;
}

const fmtTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
};

const fmtDuration = (ms: number | null) => {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  return `${s}s`;
};

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "success") {
    return <Badge className="bg-green-500/15 text-green-500 border-green-500/30">Success</Badge>;
  }
  if (status === "partial") {
    return <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">Partial (timeout)</Badge>;
  }
  if (status === "running") {
    return <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30">Running</Badge>;
  }
  if (status === "error") {
    return <Badge className="bg-red-500/15 text-red-500 border-red-500/30">Error</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
};

const AdminKinguinSync = () => {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [importingSoftware, setImportingSoftware] = useState<null | "windows" | "office">(null);
  const [activeProducts, setActiveProducts] = useState<number | null>(null);
  const [secondsToNext, setSecondsToNext] = useState<number | null>(null);
  const { findByCommand } = useCronJobs();
  const syncJob = findByCommand("/kinguin-stock-sync");

  const fetchRuns = useCallback(async () => {
    const [{ data: runsData }, { count }] = await Promise.all([
      supabase
        .from("kinguin_sync_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(25),
      supabase
        .from("kinguin_products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);
    setRuns((runsData ?? []) as SyncRun[]);
    setActiveProducts(count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRuns();
    // Poll every 30s instead of realtime subscription to reduce client + DB load
    const id = setInterval(fetchRuns, 30000);
    return () => clearInterval(id);
  }, [fetchRuns]);

  useEffect(() => {
    if (!syncJob || !syncJob.active) {
      setSecondsToNext(null);
      return;
    }
    const tick = () => setSecondsToNext(secondsUntilNextRun(syncJob.schedule));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [syncJob?.schedule, syncJob?.active]);

  const triggerSync = async () => {
    setTriggering(true);
    try {
      const { error } = await supabase.functions.invoke("kinguin-stock-sync", { body: { limit: 400 } });
      if (error) throw error;
      toast.success("Sync triggered");
      fetchRuns();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to trigger sync";
      toast.error(msg);
    } finally {
      setTriggering(false);
    }
  };

  const importSoftwareCatalog = async (kind: "windows" | "office") => {
    setImportingSoftware(kind);
    try {
      const queries = kind === "windows"
        ? ["Windows 11", "Windows 10", "Microsoft Windows"]
        : ["Microsoft Office 2021", "Microsoft Office 2019", "Microsoft Office 365"];
      let totalAdded = 0;
      let totalSkipped = 0;
      let totalBlocked = 0;
      for (const query of queries) {
        const { data, error } = await supabase.functions.invoke("kinguin-bulk-import", {
          body: { query, maxPages: 3, skipParaphrase: true, categoryOverride: kind },
        });
        if (error) throw error;
        totalAdded += data?.added ?? 0;
        totalSkipped += data?.skipped ?? 0;
        totalBlocked += data?.blocked ?? 0;
      }
      toast.success(
        `${kind === "windows" ? "Windows" : "Office"} import complete — added ${totalAdded}, skipped ${totalSkipped}, blocked ${totalBlocked}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      toast.error(msg);
    } finally {
      setImportingSoftware(null);
    }
  };

  const latest = runs[0];
  const last24h = runs.filter(r => new Date(r.started_at).getTime() > Date.now() - 24 * 3600_000);
  const totalProcessed24h = last24h.reduce((s, r) => s + (r.total_processed || 0), 0);
  const totalSkipped24h = last24h.reduce((s, r) => s + (r.skipped || 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Kinguin Stock Sync</h2>
          <p className="text-sm text-muted-foreground">
            {syncJob
              ? syncJob.active
                ? `Background job ${describeSchedule(syncJob.schedule).toLowerCase()} (up to 1000 products, plus up to 150 previously-inactive ones re-checked each run).`
                : "Background job is currently turned off — see Cron Schedule Manager below."
              : "No background schedule found for this job — see Cron Schedule Manager below."}
            {" "}"Run Now" below uses a smaller manual batch.
          </p>
        </div>
        <div className="flex gap-2">
          {secondsToNext !== null && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/40 text-sm font-mono">
              <Timer className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-muted-foreground">Next sync in</span>
              <span className="font-bold text-primary tabular-nums">{formatCountdown(secondsToNext)}</span>
            </div>
          )}
          <Button variant="outline" onClick={fetchRuns}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={triggerSync} disabled={triggering}>
            {triggering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Run Now
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Software Licenses (Windows / Office)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground flex-1 min-w-[220px]">
            Pulls Windows and Office licenses from Kinguin and files them under the
            Software → Windows and Software → Office pages.
          </p>
          <Button
            variant="outline"
            disabled={importingSoftware !== null}
            onClick={() => importSoftwareCatalog("windows")}
          >
            {importingSoftware === "windows" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-4 w-4" />
            )}
            Import Windows Licenses
          </Button>
          <Button
            variant="outline"
            disabled={importingSoftware !== null}
            onClick={() => importSoftwareCatalog("office")}
          >
            {importingSoftware === "office" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="mr-2 h-4 w-4" />
            )}
            Import Office Licenses
          </Button>
        </CardContent>
      </Card>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Last Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{fmtTime(latest?.started_at ?? null)}</div>
            <div className="mt-1">{latest ? <StatusBadge status={latest.status} /> : <span className="text-sm text-muted-foreground">No runs yet</span>}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground">Processed (last run)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latest?.total_processed ?? 0}</div>
            <p className="text-xs text-muted-foreground">of {latest?.batch_size ?? 0} fetched</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Skipped (timeout)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(latest?.skipped ?? 0) > 0 ? "text-amber-500" : ""}`}>
              {latest?.skipped ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">{totalSkipped24h} skipped in last 24h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Active Catalog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProducts ?? 0}</div>
            <p className="text-xs text-muted-foreground">{totalProcessed24h} processed in last 24h</p>
          </CardContent>
        </Card>
      </div>

      {/* Latest run breakdown */}
      {latest && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest Run Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Mode</div><div className="font-semibold capitalize">{latest.mode}</div></div>
            <div><div className="text-xs text-muted-foreground">Duration</div><div className="font-semibold">{fmtDuration(latest.duration_ms)}</div></div>
            <div><div className="text-xs text-muted-foreground">Updated</div><div className="font-semibold text-green-500">{latest.updated}</div></div>
            <div><div className="text-xs text-muted-foreground">Deactivated</div><div className="font-semibold text-red-500">{latest.deactivated}</div></div>
            <div><div className="text-xs text-muted-foreground">Price recalcs</div><div className="font-semibold text-blue-500">{latest.price_changed}</div></div>
            <div><div className="text-xs text-muted-foreground">Expired</div><div className="font-semibold">{latest.expired}</div></div>
            {latest.error_message && (
              <div className="col-span-full text-red-500 text-sm border border-red-500/30 bg-red-500/5 rounded p-2">
                {latest.error_message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Runs (last 25)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Started</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Duration</th>
                <th className="py-2 pr-3">Batch</th>
                <th className="py-2 pr-3">Updated</th>
                <th className="py-2 pr-3">Deact.</th>
                <th className="py-2 pr-3">Reactiv.</th>
                <th className="py-2 pr-3">Price↻</th>
                <th className="py-2 pr-3">Expired</th>
                <th className="py-2 pr-3">Skipped</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr><td colSpan={10} className="py-4 text-center text-muted-foreground">No runs recorded yet.</td></tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2 pr-3 whitespace-nowrap">{fmtTime(r.started_at)}</td>
                  <td className="py-2 pr-3"><StatusBadge status={r.status} /></td>
                  <td className="py-2 pr-3">{fmtDuration(r.duration_ms)}</td>
                  <td className="py-2 pr-3">{r.batch_size}</td>
                  <td className="py-2 pr-3 text-green-500">{r.updated}</td>
                  <td className="py-2 pr-3 text-red-500">{r.deactivated}</td>
                  <td className="py-2 pr-3 text-emerald-500">{r.reactivated}</td>
                  <td className="py-2 pr-3 text-blue-500">{r.price_changed}</td>
                  <td className="py-2 pr-3">{r.expired}</td>
                  <td className={`py-2 pr-3 ${r.skipped > 0 ? "text-amber-500 font-semibold" : ""}`}>{r.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminKinguinSync;