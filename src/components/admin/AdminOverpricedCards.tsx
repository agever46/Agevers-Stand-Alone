import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, AlertTriangle, EyeOff, Eye, ExternalLink, Search, TrendingDown, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ScanRow {
  id: string;
  product_id: string;
  kinguin_product_row_id: string | null;
  title: string;
  sell_price: number;
  kinguin_price: number | null;
  kinguin_stock: number | null;
  face_value: number;
  face_currency: string;
  face_value_eur: number;
  sell_vs_face_ratio: number;
  is_active: boolean;
  created_at: string;
}

interface RecoveredRow {
  id: string;
  title: string;
  old_sell_price: number;
  new_sell_price: number;
  kinguin_stock: number | null;
  face_value: number;
  face_currency: string;
  face_value_eur: number;
  markup_pct: number;
  cap_pct: number;
  tier_label: string;
}

// Tiered max-markup based on card face value (EUR).
// Smaller cards tolerate higher % (absolute € impact is small), larger cards tighter.
interface MarkupTier { maxFaceEur: number; maxMarkupPct: number; label: string; }
const DEFAULT_TIERS: MarkupTier[] = [
  { maxFaceEur: 5,   maxMarkupPct: 40, label: "≤ €5" },
  { maxFaceEur: 10,  maxMarkupPct: 30, label: "€5–€10" },
  { maxFaceEur: 25,  maxMarkupPct: 20, label: "€10–€25" },
  { maxFaceEur: 50,  maxMarkupPct: 15, label: "€25–€50" },
  { maxFaceEur: 100, maxMarkupPct: 10, label: "€50–€100" },
  { maxFaceEur: Infinity, maxMarkupPct: 7, label: "> €100" },
];
const tierFor = (faceEur: number, tiers: MarkupTier[]): MarkupTier => {
  for (const t of tiers) if (faceEur <= t.maxFaceEur) return t;
  return tiers[tiers.length - 1];
};
const markupColor = (markupPct: number, thresholdPct: number): string => {
  if (markupPct >= thresholdPct + 20) return "bg-red-500/20 text-red-400 border-red-500/40";
  if (markupPct >= thresholdPct) return "bg-orange-500/20 text-orange-400 border-orange-500/40";
  if (markupPct >= thresholdPct - 5) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
  return "bg-green-500/20 text-green-400 border-green-500/40";
};

const AdminOverpricedCards = () => {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState("");
  const [minRatio, setMinRatio] = useState(1.05);
  const [tiers, setTiers] = useState<MarkupTier[]>(DEFAULT_TIERS);
  const [bulkDisabling, setBulkDisabling] = useState(false);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [recovered, setRecovered] = useState<RecoveredRow[]>([]);
  const [recheckSummary, setRecheckSummary] = useState<string | null>(null);
  const [flaggedCount, setFlaggedCount] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [sweepProgress, setSweepProgress] = useState<{ done: number; total: number } | null>(null);

  const fetchFlaggedCount = async () => {
    const { count } = await supabase
      .from("kinguin_products")
      .select("id", { count: "exact", head: true })
      .eq("is_overpriced", true);
    setFlaggedCount(count ?? 0);
  };

  const runRecheck = async (autoApply: boolean) => {
    setRechecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("recheck-overpriced-cards", {
        body: { limit: 200, autoApply },
      });
      if (error) throw error;
      const list: RecoveredRow[] = data?.recovered ?? [];
      setRecovered(list);
      setRecheckSummary(
        `Checked ${data?.checked ?? 0} disabled card(s) against live Kinguin prices — ${list.length} are no longer overpriced` +
          (autoApply ? `, ${data?.applied ?? 0} restored automatically` : ""),
      );
      toast.success(autoApply ? `Restored ${data?.applied ?? 0} card(s)` : `${list.length} card(s) are now fairly priced`);
      await fetchFlaggedCount();
    } catch (e: any) {
      toast.error("Re-check failed: " + (e?.message ?? String(e)));
    } finally {
      setRechecking(false);
    }
  };

  // Sweeps the entire flagged set in back-to-back batches (each edge-function
  // call is capped so it can't hit the runtime timeout).
  const runFullSweep = async (autoApply: boolean) => {
    setRechecking(true);
    setRecovered([]);
    const BATCH = 300;
    let total = flaggedCount ?? 0;
    if (!total) {
      const { count } = await supabase
        .from("kinguin_products")
        .select("id", { count: "exact", head: true })
        .eq("is_overpriced", true);
      total = count ?? 0;
    }
    setSweepProgress({ done: 0, total });
    let checkedTotal = 0;
    let appliedTotal = 0;
    const all: RecoveredRow[] = [];
    try {
      for (let guard = 0; guard < 60 && checkedTotal < total; guard++) {
        const { data, error } = await supabase.functions.invoke("recheck-overpriced-cards", {
          body: { limit: BATCH, autoApply },
        });
        if (error) throw error;
        const batchChecked = Number(data?.checked ?? 0);
        if (batchChecked === 0) break;
        checkedTotal += batchChecked;
        appliedTotal += Number(data?.applied ?? 0);
        all.push(...((data?.recovered ?? []) as RecoveredRow[]));
        setRecovered([...all]);
        setSweepProgress({ done: Math.min(checkedTotal, total), total });
      }
      setRecheckSummary(
        `Full sweep: checked ${checkedTotal} disabled card(s) against live Kinguin prices — ${all.length} are no longer overpriced` +
          (autoApply ? `, ${appliedTotal} restored automatically` : ""),
      );
      toast.success(`Sweep finished — ${all.length} card(s) fairly priced${autoApply ? `, ${appliedTotal} restored` : ""}`);
      await fetchFlaggedCount();
    } catch (e: any) {
      toast.error("Full sweep failed: " + (e?.message ?? String(e)));
    } finally {
      setSweepProgress(null);
      setRechecking(false);
    }
  };

  const restoreRecovered = async (ids: string[]) => {
    if (ids.length === 0) return;
    setRestoring(true);
    const { error } = await supabase
      .from("kinguin_products")
      .update({
        is_overpriced: false,
        overpriced_marked_at: null,
        is_active: true,
        last_change_summary: "restored — price dropped below markup cap",
        last_change_at: new Date().toISOString(),
        last_change_source: "overpriced-recheck-manual",
      } as any)
      .in("id", ids);
    setRestoring(false);
    if (error) {
      toast.error("Restore failed: " + error.message);
      return;
    }
    setRecovered((prev) => prev.filter((r) => !ids.includes(r.id)));
    toast.success(`Restored ${ids.length} card(s) to the store`);
    fetchFlaggedCount();
  };

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("overpriced_card_scans" as any)
      .select("*")
      .order("sell_vs_face_ratio", { ascending: false })
      .limit(2000);
    if (error) {
      toast.error("Failed to load results: " + error.message);
    } else {
      const list = (data as unknown as ScanRow[]) || [];
      setRows(list);
      setLastScannedAt(list[0]?.created_at ?? null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRows(); fetchFlaggedCount(); }, []);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-overpriced-cards", {
        body: { minRatio, onlyActive: true },
      });
      if (error) throw error;
      const reDisabled = Number(data?.re_disabled ?? 0);
      const safetyNote = reDisabled > 0 ? `, ${reDisabled} previously marked cards re-disabled` : "";
      toast.success(`Scan complete — ${data?.inserted ?? 0} overpriced cards found (out of ${data?.scanned ?? 0} scanned)${safetyNote}`);
      await fetchRows();
    } catch (e: any) {
      toast.error("Scan failed: " + (e?.message ?? String(e)));
    } finally {
      setScanning(false);
    }
  };

  const toggleActive = async (row: ScanRow) => {
    if (!row.kinguin_product_row_id) return;
    const next = !row.is_active;
    const updatePayload: Record<string, unknown> = { is_active: next };
    if (!next) {
      updatePayload.is_overpriced = true;
      updatePayload.overpriced_marked_at = new Date().toISOString();
    } else {
      // Re-enabling clears the overpriced flag so future syncs treat it normally
      updatePayload.is_overpriced = false;
      updatePayload.overpriced_marked_at = null;
    }
    const { error } = await supabase
      .from("kinguin_products")
      .update(updatePayload as any)
      .eq("id", row.kinguin_product_row_id);
    if (error) {
      toast.error("Failed: " + error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)));
    toast.success(next ? "Product enabled (overpriced flag cleared)" : "Product disabled & marked as overpriced");
  };

  const exceedsTier = (r: ScanRow): boolean => {
    const sell = Number(r.sell_price);
    const faceEur = Number(r.face_value_eur);
    if (!(faceEur > 0) || !(sell > 0)) return false;
    const markupPct = (sell / faceEur - 1) * 100;
    return markupPct > tierFor(faceEur, tiers).maxMarkupPct;
  };

  const bulkDisableAbove = async () => {
    const targets = rows.filter(
      (r) => r.is_active && r.kinguin_product_row_id && exceedsTier(r)
    );
    if (targets.length === 0) {
      toast.info("No active products exceed their tier's markup cap");
      return;
    }
    if (!confirm(`Disable ${targets.length} product(s) exceeding their tier's markup cap?`)) return;
    setBulkDisabling(true);
    const ids = targets.map((r) => r.kinguin_product_row_id!) as string[];
    const CHUNK = 200;
    let disabled = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("kinguin_products")
        .update({
          is_active: false,
          is_overpriced: true,
          overpriced_marked_at: new Date().toISOString(),
        })
        .in("id", slice);
      if (error) {
        setBulkDisabling(false);
        toast.error(`Bulk disable failed after ${disabled}/${ids.length}: ${error.message}`);
        return;
      }
      disabled += slice.length;
    }
    setBulkDisabling(false);
    setRows((prev) =>
      prev.map((r) => (ids.includes(r.kinguin_product_row_id || "") ? { ...r, is_active: false } : r))
    );
    toast.success(`Disabled ${targets.length} overpriced product(s)`);
  };

  const filtered = search.trim()
    ? rows.filter((r) => r.title.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;
  const activeOverThreshold = rows.filter((r) => r.is_active && exceedsTier(r)).length;

  const updateTier = (idx: number, value: number) => {
    setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, maxMarkupPct: value } : t)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            Overpriced Gift Cards
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Detects gift cards whose sell price is significantly above the card's face value.
            {lastScannedAt && (
              <span className="ml-2 text-foreground/70">
                · Last scan: {new Date(lastScannedAt).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Min ratio:</span>
            <Input
              type="number"
              step="0.05"
              min="1"
              value={minRatio}
              onChange={(e) => setMinRatio(Number(e.target.value) || 1.05)}
              className="w-20 h-8"
            />
          </div>
          <Button onClick={runScan} disabled={scanning} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning..." : "Run Scan"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-orange-300 font-medium">
            Tiered max markup over face value (per card size)
          </span>
          <span className="text-xs text-muted-foreground">
            {activeOverThreshold} active product(s) exceed their tier's cap
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {tiers.map((t, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-md border border-border bg-background/40 p-2">
              <span className="text-[11px] text-muted-foreground">{t.label}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-orange-300">+</span>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={t.maxMarkupPct}
                  onChange={(e) => updateTier(i, Number(e.target.value) || 0)}
                  className="h-7 w-16 text-xs"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="destructive" onClick={bulkDisableAbove} disabled={bulkDisabling}>
            <EyeOff className="h-3.5 w-3.5 mr-1" />
            {bulkDisabling ? "Disabling..." : "Disable all exceeding tier cap"}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

      </div>

      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-xs text-green-300 font-medium flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" />
              Price-drop recovery
            </span>
            <p className="text-[11px] text-muted-foreground mt-1">
              Disabled cards are skipped by the normal stock sync, so their price goes stale. This re-fetches the live
              Kinguin price for flagged cards and finds the ones that are no longer overpriced.
              {flaggedCount != null && (
                <span className="ml-1 text-foreground/70">· {flaggedCount} card(s) currently flagged</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => runRecheck(false)} disabled={rechecking}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${rechecking ? "animate-spin" : ""}`} />
              {rechecking ? "Checking..." : "Re-check prices"}
            </Button>
            <Button size="sm" onClick={() => runRecheck(true)} disabled={rechecking}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Check &amp; auto-restore
            </Button>
            <Button size="sm" variant="default" onClick={() => runFullSweep(true)} disabled={rechecking}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${sweepProgress ? "animate-spin" : ""}`} />
              {sweepProgress ? `Sweeping ${sweepProgress.done}/${sweepProgress.total}` : "Sweep ALL & restore"}
            </Button>
          </div>
        </div>
        {recheckSummary && <p className="text-[11px] text-muted-foreground">{recheckSummary}</p>}
        {recovered.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                disabled={restoring}
                onClick={() => restoreRecovered(recovered.map((r) => r.id))}
              >
                {restoring ? "Restoring..." : `Restore all ${recovered.length}`}
              </Button>
            </div>
            <div className="rounded-md border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-right">Old → new price</TableHead>
                    <TableHead className="text-right">Face value</TableHead>
                    <TableHead className="text-right">Markup now</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recovered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-md">
                        <div className="text-sm truncate" title={r.title}>{r.title}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        <span className="text-muted-foreground line-through">€{Number(r.old_sell_price).toFixed(2)}</span>{" "}
                        <span className="text-green-400">€{Number(r.new_sell_price).toFixed(2)}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {r.face_value} {r.face_currency}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/40">
                          +{r.markup_pct.toFixed(1)}% / max +{r.cap_pct}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.kinguin_stock ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" disabled={restoring} onClick={() => restoreRecovered([r.id])}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="text-right">Site price</TableHead>
              <TableHead className="text-right">Face value</TableHead>
              <TableHead className="text-right">Markup vs face</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No results. Click "Run Scan" to detect overpriced cards.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const sell = Number(r.sell_price);
                const faceEur = Number(r.face_value_eur);
                const markupPct = faceEur > 0 ? (sell / faceEur - 1) * 100 : null;
                const tier = faceEur > 0 ? tierFor(faceEur, tiers) : null;
                const cap = tier?.maxMarkupPct ?? 0;
                return (
                <TableRow key={r.id}>
                  <TableCell className="max-w-md">
                    <div className="font-medium text-sm truncate" title={r.title}>{r.title}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">€{Number(r.sell_price).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div>{Number(r.face_value)} {r.face_currency}</div>
                    {r.face_currency !== "EUR" && (
                      <div className="text-xs text-muted-foreground">≈ €{faceEur.toFixed(2)}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {markupPct != null ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <Badge
                          variant="outline"
                          className={markupColor(markupPct, cap)}
                          title={`Site sells at €${sell.toFixed(2)}, face value ≈ €${faceEur.toFixed(2)}. Tier ${tier?.label}: max +${cap}%.`}
                        >
                          {markupPct >= 0 ? "+" : ""}{markupPct.toFixed(1)}% / max +{cap}%
                          {markupPct > cap ? " ✗" : " ✓"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{tier?.label}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.kinguin_stock ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.is_active ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`/admin/products?search=${encodeURIComponent(r.title)}`, "_blank")}
                        title="Open in products"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant={r.is_active ? "destructive" : "outline"}
                        onClick={() => toggleActive(r)}
                      >
                        {r.is_active ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                        {r.is_active ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rows.length} results.
        Markup vs face = (Site price ÷ Face value in €) − 1. Only the site price and the card's true face value matter here —
        Kinguin's buy price and fees are intentionally ignored.
      </div>
    </div>
  );
};

export default AdminOverpricedCards;