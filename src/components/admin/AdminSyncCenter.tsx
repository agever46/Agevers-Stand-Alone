import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Wand2, Image as ImageIcon, DollarSign, Crown, Database, Activity, CheckCircle2, XCircle, Loader2, Map, Send, Tag } from "lucide-react";
import AdminKinguinSync from "./AdminKinguinSync";
import AdminCronManager from "./AdminCronManager";
import { useCronJobs } from "@/hooks/useCronJobs";
import { describeSchedule } from "@/lib/cronSchedule";

/** Live "when does this run automatically" line for a Sync Center panel. */
const AutoScheduleLine = ({ pattern, jobs }: { pattern: string; jobs: ReturnType<typeof useCronJobs>["jobs"] }) => {
  const job = jobs.find((j) => j.command.includes(pattern));
  if (!job) return <>No automatic schedule is currently set up for this — see Cron Schedule Manager below.</>;
  if (!job.active) return <>The automatic run ({describeSchedule(job.schedule)}) is currently turned off — see Cron Schedule Manager below.</>;
  return <>Auto-runs {describeSchedule(job.schedule).toLowerCase()}.</>;
};

/**
 * AdminSyncCenter — single hub for all background sync / maintenance jobs:
 * - AI paraphrase queue
 * - Storage image WebP compression
 * - Kinguin stock sync (manual trigger)
 * - Recalculate sell prices
 * - Kinguin metadata sync (link to Kinguin section)
 */
const AdminSyncCenter = () => {
  const { jobs: cronJobs } = useCronJobs();

  // ── Paraphrase ───────────────────────────────────────────────
  const [cronProgress, setCronProgress] = useState<{ completed: number; total: number } | null>(null);
  const [runningParaphrase, setRunningParaphrase] = useState(false);

  const fetchParaphraseProgress = useCallback(async () => {
    const [{ count: completedCount }, { count: totalCount }] = await Promise.all([
      supabase.from("allowed_products").select("id", { count: "exact", head: true }).eq("description_paraphrased", true).not("description", "is", null).neq("description", ""),
      supabase.from("allowed_products").select("id", { count: "exact", head: true }).not("description", "is", null).neq("description", ""),
    ]);
    setCronProgress({ completed: completedCount ?? 0, total: totalCount ?? 0 });
  }, []);

  useEffect(() => {
    fetchParaphraseProgress();
    const i = setInterval(fetchParaphraseProgress, 15000);
    return () => clearInterval(i);
  }, [fetchParaphraseProgress]);

  const triggerParaphrase = async () => {
    setRunningParaphrase(true);
    try {
      const { data, error } = await supabase.functions.invoke("batch-paraphrase-parallel", { body: { batchSize: 50 } });
      if (error) throw error;
      if (data?.credits_exhausted) toast.error("AI credits exhausted");
      else if (data?.rate_limited) toast.warning("Rate limited — try again shortly");
      else toast.success(`Paraphrased ${data?.processed ?? 0} products (${data?.remaining ?? 0} remaining)`);
      setTimeout(fetchParaphraseProgress, 3000);
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to trigger paraphrase");
    } finally {
      setTimeout(() => setRunningParaphrase(false), 3000);
    }
  };

  // ── Image Compression ───────────────────────────────────────
  const [compressingImages, setCompressingImages] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<{ processed: number; total: number; savedKb: number; status: string; totalRemaining?: number } | null>(null);

  const convertImageToWebp = async (blob: Blob, quality = 0.82): Promise<Blob> => {
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    ctx.drawImage(bmp, 0, 0);
    return new Promise((resolve, reject) => {
      canvas.toBlob((webp) => {
        if (!webp) reject(new Error("WebP conversion failed"));
        else resolve(webp);
      }, "image/webp", quality);
    });
  };

  const handleCompressStorageImages = async () => {
    setCompressingImages(true);
    setCompressionProgress({ processed: 0, total: 0, savedKb: 0, status: "Loading target list..." });
    try {
      const { data: listData, error: listError } = await supabase.functions.invoke("compress-storage-images", { body: { action: "list" } });
      if (listError) throw listError;
      if (listData?.error) throw new Error(listData.error);

      const targets = Array.isArray(listData?.targets) ? listData.targets : [];
      const totalRemaining = Number(listData?.totalRemaining ?? targets.length);
      let processed = 0;
      let savedKb = 0;
      setCompressionProgress({ processed, total: targets.length, savedKb, totalRemaining, status: "Starting compression..." });

      for (const target of targets) {
        const bucket = String(target.bucket || "");
        const path = String(target.path || "");
        setCompressionProgress({ processed, total: targets.length, savedKb, totalRemaining, status: `Compressing ${path.split("/").pop()}` });

        const { data: blob, error: downloadError } = await supabase.storage.from(bucket).download(path);
        if (downloadError || !blob) throw new Error(downloadError?.message || `Could not download ${path}`);

        const webp = await convertImageToWebp(blob);
        const newPath = path.replace(/\.(png|jpe?g|gif|bmp)$/i, "") + ".webp";

        const webpBuffer = await webp.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(webpBuffer);
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)) as any);
        }
        const webpBase64 = btoa(binary);

        const { data: updateData, error: updateError } = await supabase.functions.invoke("compress-storage-images", {
          body: { action: "update_refs", bucket, path, newPath, webpBase64 },
        });
        if (updateError) throw updateError;
        if (updateData?.error) throw new Error(updateData.error);

        processed += 1;
        savedKb += Math.max(0, Math.round((blob.size - webp.size) / 1024));
        setCompressionProgress({ processed, total: targets.length, savedKb, totalRemaining, status: `Compressed ${processed}/${targets.length}` });
      }

      toast.success(`Compressed ${processed} files — saved ${(savedKb / 1024).toFixed(1)} MB`);
    } catch (e) {
      const msg = (e as Error)?.message || "Compression failed";
      toast.error(msg);
      setCompressionProgress((prev) => prev ? { ...prev, status: msg } : prev);
    } finally {
      setCompressingImages(false);
    }
  };

  // ── Kinguin Stock Sync ──────────────────────────────────────
  const [syncingStock, setSyncingStock] = useState(false);
  const triggerStockSync = async () => {
    setSyncingStock(true);
    try {
      const { error } = await supabase.functions.invoke("kinguin-stock-sync", { body: { limit: 400 } });
      if (error) throw error;
      toast.success("Stock sync triggered (400 products)");
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to trigger stock sync");
    } finally {
      setSyncingStock(false);
    }
  };

  // ── Kinguin Discover (manual) ──────────────────────────────
  const [runningDiscover, setRunningDiscover] = useState(false);
  const triggerDiscover = async () => {
    setRunningDiscover(true);
    try {
      // 1. Discover new products
      const { data, error } = await supabase.functions.invoke("kinguin-discover", { body: {} });
      if (error) throw error;
      const added = data?.new_suggestions ?? 0;
      const checked = data?.total_checked ?? 0;

      // 2. Cleanup out-of-stock / missing suggestions
      let removed = 0;
      let updated = 0;
      try {
        const { data: cleanupData, error: cleanupError } = await supabase.functions.invoke(
          "kinguin-suggestions-cleanup",
          { body: {} },
        );
        if (cleanupError) throw cleanupError;
        removed = cleanupData?.removed ?? cleanupData?.deleted ?? 0;
        updated = cleanupData?.updated ?? 0;
      } catch (e) {
        toast.warning(`Cleanup failed: ${(e as Error)?.message || "unknown error"}`);
      }

      toast.success(
        `Discover: ${added} new (scanned ${checked}) · Cleanup: ${removed} removed, ${updated} updated`,
      );
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to run Discover");
    } finally {
      setRunningDiscover(false);
    }
  };

  // ── Recalculate Sell Prices ─────────────────────────────────
  const [recalculating, setRecalculating] = useState(false);
  const triggerRecalcPrices = async () => {
    setRecalculating(true);
    try {
      const { error } = await supabase.rpc("recalculate_all_sell_prices" as any);
      if (error) throw error;
      toast.success("All sell prices recalculated");
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to recalculate prices");
    } finally {
      setRecalculating(false);
    }
  };

  // ── Gift Card Auto Grouping ────────────────────────────────
  const [groupingCards, setGroupingCards] = useState(false);
  const triggerGiftCardGrouping = async () => {
    setGroupingCards(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-group-gift-cards", { body: {} });
      if (error) throw error;
      toast.success(`Grouping complete: ${data?.new_groups ?? 0} new brands found.`);
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to group gift cards");
    } finally {
      setGroupingCards(false);
    }
  };

  // ── Reset stuck paraphrasing ────────────────────────────────
  const [resettingStuck, setResettingStuck] = useState(false);
  const resetStuckParaphrase = async () => {
    setResettingStuck(true);
    try {
      const { data, error } = await supabase.rpc("reset_stuck_paraphrasing" as any);
      if (error) throw error;
      toast.success(`Reset ${data ?? 0} stuck items`);
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to reset stuck items");
    } finally {
      setResettingStuck(false);
    }
  };

  // ── Sitemap Refresh ─────────────────────────────────────────
  const [refreshingSitemap, setRefreshingSitemap] = useState(false);
  const triggerSitemapRefresh = async () => {
    setRefreshingSitemap(true);
    try {
      const res = await fetch("https://ppernxjnicippytjuxpz.supabase.co/functions/v1/sitemap-xml", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const urlCount = (text.match(/<url>/g) || []).length;
      toast.success(`Sitemap regenerated — ${urlCount.toLocaleString()} URLs`);
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to refresh sitemap");
    } finally {
      setRefreshingSitemap(false);
    }
  };

  // ── External Services Health ────────────────────────────────
  type Svc = { id: string; name: string; category: string; ok: boolean; detail: string };
  const [services, setServices] = useState<Svc[] | null>(null);
  const [checkingServices, setCheckingServices] = useState(false);

  const checkServices = useCallback(async () => {
    setCheckingServices(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-external-services", { body: {} });
      if (error) throw error;
      setServices(Array.isArray(data?.services) ? data.services : []);
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to check services");
    } finally {
      setCheckingServices(false);
    }
  }, []);

  useEffect(() => {
    checkServices();
  }, [checkServices]);

  const testTelegram = async () => {
    try {
      const { error } = await supabase.functions.invoke("telegram-notify", {
        body: { title: "Admin Test", message: "הודעת בדיקה מ-Sync Center ✅" },
      });
      if (error) throw error;
      toast.success("Telegram test message sent!");
    } catch (e) {
      toast.error((e as Error)?.message || "Telegram test failed");
    }
  };

  // ── Reclassify Gift Cards ───────────────────────────────────
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyDryRun, setReclassifyDryRun] = useState(true);
  const [reclassifyProgress, setReclassifyProgress] = useState<{
    checked: number; total: number; updated: number; skippedCard: number; unknown: number; failed: number; notFound: number;
  } | null>(null);
  const [reclassifyDiag, setReclassifyDiag] = useState<{
    unknownPlatforms: Record<string, number>;
    unknownSamples: { id: string; name: string; kPlatform: string | null }[];
    cardSamples: { name: string }[];
    failedSamples: { id: string; kinguinId: string; status?: number; reason: string }[];
  } | null>(null);

  const runReclassifyGiftCards = async () => {
    setReclassifying(true);
    setReclassifyProgress(null);
    setReclassifyDiag(null);
    let offset = 0;
    const totals = { updated: 0, skippedCard: 0, unknown: 0, failed: 0, notFound: 0, checked: 0, grandTotal: 0 };
    const diag = {
      unknownPlatforms: {} as Record<string, number>,
      unknownSamples: [] as { id: string; name: string; kPlatform: string | null }[],
      cardSamples: [] as { name: string }[],
      failedSamples: [] as { id: string; kinguinId: string; status?: number; reason: string }[],
    };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      while (true) {
        const res = await fetch(
          `https://ppernxjnicippytjuxpz.supabase.co/functions/v1/reclassify-gift-cards`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ dryRun: reclassifyDryRun, batchSize: 400, offset }),
          }
        );
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let batchDone: { hasMore: boolean; nextOffset: number } | null = null;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            const m = line.match(/^data: (.+)$/);
            if (!m) continue;
            try {
              const d = JSON.parse(m[1]);
              if (typeof d.grandTotal === "number") totals.grandTotal = d.grandTotal;
              if (d.type === "progress" || d.type === "done" || d.type === "start") {
                setReclassifyProgress({
                  checked: totals.checked + (d.checked ?? 0),
                  total: totals.grandTotal || d.total || 0,
                  updated: totals.updated + (d.updated ?? 0),
                  skippedCard: totals.skippedCard + (d.skippedCard ?? 0),
                  unknown: totals.unknown + (d.unknown ?? 0),
                  failed: totals.failed + (d.failed ?? 0),
                  notFound: totals.notFound + (d.notFound ?? 0),
                });
              }
              if (d.type === "done") {
                totals.checked += d.checked ?? 0;
                totals.updated += d.updated ?? 0;
                totals.skippedCard += d.skippedCard ?? 0;
                totals.unknown += d.unknown ?? 0;
                totals.failed += d.failed ?? 0;
                totals.notFound += d.notFound ?? 0;
                if (d.unknownPlatforms) {
                  for (const [k, v] of Object.entries(d.unknownPlatforms as Record<string, number>)) {
                    diag.unknownPlatforms[k] = (diag.unknownPlatforms[k] || 0) + v;
                  }
                }
                if (Array.isArray(d.unknownSamples)) diag.unknownSamples.push(...d.unknownSamples.slice(0, Math.max(0, 30 - diag.unknownSamples.length)));
                if (Array.isArray(d.cardSamples)) diag.cardSamples.push(...d.cardSamples.slice(0, Math.max(0, 10 - diag.cardSamples.length)));
                if (Array.isArray(d.failedSamples)) diag.failedSamples.push(...d.failedSamples.slice(0, Math.max(0, 20 - diag.failedSamples.length)));
                batchDone = { hasMore: !!d.hasMore, nextOffset: d.nextOffset ?? offset };
              }
            } catch { /* ignore */ }
          }
        }
        if (!batchDone || !batchDone.hasMore) break;
        offset = batchDone.nextOffset;
      }
      setReclassifyDiag(diag);
      const msg = reclassifyDryRun
        ? `Dry run: ${totals.updated} would be moved · ${totals.skippedCard} cards · ${totals.unknown} unknown · ${totals.notFound} not-found · ${totals.failed} failed`
        : `Reclassified ${totals.updated} · ${totals.skippedCard} cards kept · ${totals.unknown} unknown · ${totals.notFound} not-found · ${totals.failed} failed`;
      toast.success(msg);
    } catch (e) {
      toast.error((e as Error)?.message || "Reclassify failed");
    } finally {
      setReclassifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-3">
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <RefreshCw className="h-6 w-6 text-primary" />
          Sync Center
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Centralized hub for all background jobs — paraphrasing, image compression, stock & price sync.
        </p>
      </div>

      {/* ── Gift Card Auto Grouping ── */}
      <div className="bg-secondary/20 border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Gift Card Auto Grouping
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Scans loose Gift Cards and groups them into brand collections. Click to run manually.
            </p>
          </div>
          <Button size="sm" disabled={groupingCards} onClick={triggerGiftCardGrouping}>
            {groupingCards ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run Grouping"}
          </Button>
        </div>
      </div>

      {/* ── AI Paraphrase ── */}
      <div className="bg-secondary/20 border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" /> AI Paraphrase Queue
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Rewrites Kinguin descriptions with Gemini for SEO. <AutoScheduleLine pattern="/batch-paraphrase" jobs={cronJobs} /> Click to run manually.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" disabled={resettingStuck} onClick={resetStuckParaphrase}>
              {resettingStuck ? "Resetting..." : "Reset Stuck"}
            </Button>
            <Button size="sm" disabled={runningParaphrase || (cronProgress ? cronProgress.completed >= cronProgress.total : false)} onClick={triggerParaphrase}>
              {runningParaphrase ? "Running..." : "Run Now"}
            </Button>
          </div>
        </div>
        {cronProgress && cronProgress.total > 0 && (
          <>
            <div className="flex justify-between text-xs font-mono text-muted-foreground">
              <span>{cronProgress.completed} / {cronProgress.total}</span>
              <span>{Math.round((cronProgress.completed / cronProgress.total) * 100)}%</span>
            </div>
            <Progress value={(cronProgress.completed / cronProgress.total) * 100} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {cronProgress.completed >= cronProgress.total
                ? "✅ All products paraphrased!"
                : `${cronProgress.total - cronProgress.completed} remaining`}
            </p>
          </>
        )}
      </div>

      {/* ── Image Compression ── */}
      <div className="bg-secondary/20 border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" /> Storage Image Compression
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Converts the largest PNG/JPG originals across all buckets to WebP and updates DB references. Safe to re-run.
            </p>
          </div>
          <Button size="sm" disabled={compressingImages} onClick={handleCompressStorageImages}>
            {compressingImages ? "Compressing..." : "Run Compression"}
          </Button>
        </div>
        {compressionProgress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate max-w-[280px]">{compressionProgress.status}</span>
              <span className="font-mono tabular-nums">{compressionProgress.processed}/{compressionProgress.total}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${compressionProgress.total > 0 ? Math.min(100, (compressionProgress.processed / compressionProgress.total) * 100) : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{compressionProgress.total > 0 ? `${Math.round((compressionProgress.processed / compressionProgress.total) * 100)}%` : "0%"}</span>
              <span>saved {(compressionProgress.savedKb / 1024).toFixed(1)} MB</span>
            </div>
            {typeof compressionProgress.totalRemaining === "number" && (
              <div className="text-[11px] text-center text-amber-400 font-medium pt-1">
                🌐 {Math.max(0, compressionProgress.totalRemaining - compressionProgress.processed)} total images left site-wide
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Kinguin Stock ── */}
      <div className="bg-secondary/20 border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" /> Kinguin Stock Sync
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Refreshes price + stock from Kinguin. <AutoScheduleLine pattern="/kinguin-stock-sync" jobs={cronJobs} /> Click to sync the next 400 products now.
            </p>
          </div>
          <Button size="sm" disabled={syncingStock} onClick={triggerStockSync}>
            {syncingStock ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </div>

      {/* ── Kinguin Discover ── */}
      <div className="bg-secondary/20 border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" /> Kinguin Discover
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Scans Kinguin for new products AND cleans out-of-stock / missing items from the Discover list. <AutoScheduleLine pattern="/kinguin-discover" jobs={cronJobs} /> Click to trigger both manually now.
            </p>
          </div>
          <Button size="sm" disabled={runningDiscover} onClick={triggerDiscover}>
            {runningDiscover ? (<><Loader2 className="h-3 w-3 animate-spin mr-1" />Discovering...</>) : "Run Discover Now"}
          </Button>
        </div>
      </div>

      {/* ── Sell Prices ── */}
      <div className="bg-secondary/20 border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Recalculate Sell Prices
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Re-applies tiered margin rules to every Kinguin product. Run after editing pricing tiers.
            </p>
          </div>
          <Button size="sm" disabled={recalculating} onClick={triggerRecalcPrices}>
            {recalculating ? "Recalculating..." : "Recalculate All"}
          </Button>
        </div>
      </div>

      {/* ── Info: Kinguin metadata sync lives in Kinguin section ── */}
      <div className="bg-muted/30 border border-border/50 rounded-lg p-4 text-xs text-muted-foreground flex items-center gap-2">
        <Database className="h-3.5 w-3.5 shrink-0" />
        <span>Kinguin metadata sync (release dates, requirements, badges) is managed in the <strong>Kinguin</strong> section.</span>
      </div>

      {/* ── Reclassify Gift Cards ── */}
      <div className="bg-secondary/20 border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Reclassify Gift Cards
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Scans every product in the <strong>Gift Cards</strong> store, fetches its Kinguin metadata,
              and moves real games (Steam, Epic, Xbox, PlayStation, Nintendo, etc.) to the correct store & platform.
              Cards, wallets, subscriptions and top-ups are left alone. Run a dry-run first to preview counts.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant={reclassifyDryRun ? "default" : "outline"}
              onClick={() => setReclassifyDryRun(true)}
              disabled={reclassifying}
            >
              Dry Run
            </Button>
            <Button
              size="sm"
              variant={!reclassifyDryRun ? "default" : "outline"}
              onClick={() => setReclassifyDryRun(false)}
              disabled={reclassifying}
            >
              Apply
            </Button>
            <Button size="sm" disabled={reclassifying} onClick={runReclassifyGiftCards}>
              {reclassifying ? "Running..." : "Run"}
            </Button>
          </div>
        </div>
        {reclassifyProgress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>{reclassifyProgress.checked} / {reclassifyProgress.total}</span>
              <span>
                ✅ {reclassifyProgress.updated} · 🎁 {reclassifyProgress.skippedCard} · ❓ {reclassifyProgress.unknown} · 🚫 {reclassifyProgress.notFound} · ❌ {reclassifyProgress.failed}
              </span>
            </div>
            <Progress
              value={reclassifyProgress.total > 0 ? (reclassifyProgress.checked / reclassifyProgress.total) * 100 : 0}
              className="h-2"
            />
          </div>
        )}
        {reclassifyDiag && (
          <div className="mt-3 space-y-3 text-xs">
            {Object.keys(reclassifyDiag.unknownPlatforms).length > 0 && (
              <div className="bg-background/40 border border-border rounded p-3">
                <div className="font-semibold text-foreground mb-1">Unknown Kinguin platforms (not mapped)</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono">
                  {Object.entries(reclassifyDiag.unknownPlatforms)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 30)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="truncate mr-2">{k}</span>
                        <span className="text-muted-foreground">{v}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {reclassifyDiag.unknownSamples.length > 0 && (
              <details className="bg-background/40 border border-border rounded p-3">
                <summary className="font-semibold text-foreground cursor-pointer">Unknown samples ({reclassifyDiag.unknownSamples.length})</summary>
                <div className="mt-2 space-y-0.5 font-mono max-h-64 overflow-auto">
                  {reclassifyDiag.unknownSamples.map((s, i) => (
                    <div key={i} className="truncate">
                      <span className="text-muted-foreground">[{s.kPlatform ?? "∅"}]</span> {s.name}
                    </div>
                  ))}
                </div>
              </details>
            )}
            {reclassifyDiag.cardSamples.length > 0 && (
              <details className="bg-background/40 border border-border rounded p-3">
                <summary className="font-semibold text-foreground cursor-pointer">Kept-as-card samples ({reclassifyDiag.cardSamples.length})</summary>
                <div className="mt-2 space-y-0.5 font-mono max-h-64 overflow-auto">
                  {reclassifyDiag.cardSamples.map((s, i) => (<div key={i} className="truncate">{s.name}</div>))}
                </div>
              </details>
            )}
            {reclassifyDiag.failedSamples.length > 0 && (
              <details className="bg-background/40 border border-border rounded p-3">
                <summary className="font-semibold text-foreground cursor-pointer">Failures ({reclassifyDiag.failedSamples.length})</summary>
                <div className="mt-2 space-y-0.5 font-mono max-h-64 overflow-auto">
                  {reclassifyDiag.failedSamples.map((s, i) => (
                    <div key={i} className="truncate">
                      <span className="text-muted-foreground">kinguin={s.kinguinId}</span> — {s.reason}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* ── Sitemap Refresh ── */}
      <div className="bg-secondary/20 border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Map className="h-4 w-4 text-primary" /> Sitemap Refresh
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Regenerates sitemap.xml from the latest catalog. <AutoScheduleLine pattern="/sitemap-xml" jobs={cronJobs} /> Click to refresh now.
            </p>
          </div>
          <Button size="sm" disabled={refreshingSitemap} onClick={triggerSitemapRefresh}>
            {refreshingSitemap ? "Refreshing..." : "Refresh Now"}
          </Button>
        </div>
      </div>

      {/* ── Telegram Test ── */}
      <div className="bg-secondary/20 border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" /> Telegram Test
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Sends a test notification to the admin Telegram channel to verify the bot connection.
            </p>
          </div>
          <Button size="sm" onClick={testTelegram}>
            Send Test
          </Button>
        </div>
      </div>

      {/* ── External Services Health ── */}
      <div className="bg-secondary/20 border border-border rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> External Services Health
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Live status of every third-party service connected to Agever's. Green = OK, Red = down or misconfigured.
            </p>
          </div>
          <Button size="sm" variant="outline" disabled={checkingServices} onClick={checkServices}>
            {checkingServices ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Recheck"}
          </Button>
        </div>

        {!services && checkingServices && (
          <p className="text-xs text-muted-foreground">Checking all services...</p>
        )}

        {services && (() => {
          const grouped = services.reduce<Record<string, Svc[]>>((acc, s) => {
            (acc[s.category] ||= []).push(s);
            return acc;
          }, {});
          const okCount = services.filter((s) => s.ok).length;
          return (
            <>
              <div className="text-xs font-mono text-muted-foreground">
                {okCount}/{services.length} services healthy
              </div>
              <div className="space-y-4">
                {Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">{cat}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {items.map((s) => (
                        <div
                          key={s.id}
                          className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md border ${
                            s.ok ? "bg-emerald-500/5 border-emerald-500/30" : "bg-red-500/5 border-red-500/40"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {s.ok ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                            )}
                            <span className="text-sm font-medium truncate">{s.name}</span>
                          </div>
                          <span className={`text-[11px] font-mono shrink-0 ${s.ok ? "text-emerald-400/80" : "text-red-400/90"}`}>
                            {s.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          );
        })()}
      </div>

      {/* ── Kinguin Sync Detailed Dashboard ── */}
      <div className="bg-secondary/20 border border-border rounded-lg p-5">
        <AdminKinguinSync />
      </div>

      {/* ── Cron Schedule Manager ── */}
      <AdminCronManager />
    </div>
  );
};

export default AdminSyncCenter;