import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Clock, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { CRON_DAYS, describeSchedule } from "@/lib/cronSchedule";

type CronJob = {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
};

const FREQUENCY_PRESETS: { label: string; value: string }[] = [
  { label: "Every 30 seconds", value: "30s" },
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 2 minutes", value: "*/2 * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Hourly", value: "hourly" },
  { label: "Every 3 hours", value: "every-3h" },
  { label: "Every 6 hours", value: "every-6h" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Every 3 days", value: "every-3d" },
  { label: "Custom (advanced)", value: "custom" },
];

const DAYS = CRON_DAYS;

/**
 * Human-friendly description for every known cron job, matched by the
 * FUNCTION IT CALLS (a substring of the command URL) rather than the exact
 * jobname. Jobnames get a fresh suffix/jobid every time a job is
 * rescheduled (e.g. "-every-2min" became "-every-5-hours"), which silently
 * breaks a jobname-keyed lookup — matching on the command URL survives
 * renames since the target function doesn't change.
 */
const JOB_DESCRIPTIONS_BY_COMMAND: { pattern: string; description: string }[] = [
  { pattern: "/process-email-queue", description: "Sends queued transactional & marketing emails (verification, receipts, newsletters). Frequent runs = faster delivery." },
  { pattern: "/kinguin-stock-sync", description: "Syncs Kinguin product stock & prices into our catalog so OOS items hide/reactivate and prices stay accurate." },
  { pattern: "/kinguin-preorder-sync", description: "Updates pre-order release dates and auto-delivers keys when a pre-order title is released." },
  { pattern: "/kinguin-discover", description: "Scans Kinguin for new products matching our allowed_products list and imports them." },
  { pattern: "/kinguin-balance-check", description: "Checks our Kinguin EUR balance and alerts admins when low." },
  { pattern: "/kinguin-suggestions-cleanup", description: "Removes stale/out-of-stock entries from the Kinguin product-suggestions list." },
  { pattern: "/google-merchant-sync", description: "Pushes the full product catalog to Google Merchant Center for Shopping ads." },
  { pattern: "/publish-scheduled-news", description: "DEPRECATED: Publishes news articles whose scheduled_publish_at time has arrived." },
  { pattern: "/process-wishlist-alerts", description: "Emails users when items on their wishlist drop in price or come back in stock." },
  { pattern: "/process-abandoned-carts", description: "DEPRECATED: Sends recovery emails to users who left items in their cart." },
  { pattern: "/process-verification-reminders", description: "Sends daily (every 24h) email-verification reminders and suspends unverified accounts after 72h." },
  { pattern: "/auto-create-bundle", description: "Auto-creates new product bundles based on top-sellers and AI suggestions." },
  { pattern: "/send-cooling-period-ended-emails", description: "Emails customers once their order's fraud-review cooling period has ended and the code is ready to reveal." },
  { pattern: "/paypal-health-check", description: "Pings PayPal's API to confirm our credentials/connection are still working; alerts admins if not." },
  { pattern: "/seo-audit", description: "Scans the site for SEO issues (missing titles, meta descriptions, broken links, etc.) and logs findings for Admin > SEO Agent." },
  { pattern: "/geo-mention-check", description: "Checks whether AI answer engines (ChatGPT, Perplexity, etc.) mention the store for target prompts." },
  { pattern: "/giveaway-auto-finalize", description: "One-time job that picks the winner when a specific giveaway ends." },
];

function describeJob(job: CronJob): string {
  const match = JOB_DESCRIPTIONS_BY_COMMAND.find((d) => job.command.includes(d.pattern));
  if (match) return match.description;
  if (job.jobname === "strip-preorder-released-daily") return "Removes the pre-order badge from products whose release date has passed.";
  if (job.jobname === "cleanup-cron-history-hourly") return "Trims old cron.job_run_details rows to keep the history table small.";
  if (job.jobname === "cleanup-net-http-response-hourly") return "Trims old net._http_response rows from pg_net to free DB space.";
  if (job.jobname === "page-views-cleanup-hourly") return "Deletes page-view analytics older than the retention window.";
  return "No description available — check the SQL command for what this job runs.";
}

/** Build a cron expression from preset + hour + minute + (optional weekday). */
function buildSchedule(preset: string, hour: number, minute: number, weekday: number | null, custom: string): string {
  const hh = Math.max(0, Math.min(23, hour));
  const mm = Math.max(0, Math.min(59, minute));
  switch (preset) {
    case "30s": return "30 seconds";
    case "hourly": return `${mm} * * * *`;
    case "every-3h": return `${mm} */3 * * *`;
    case "every-6h": return `${mm} */6 * * *`;
    case "daily": return `${mm} ${hh} * * *`;
    case "weekly": return `${mm} ${hh} * * ${weekday ?? 0}`;
    case "every-3d": return `${mm} ${hh} */3 * *`;
    case "custom": return custom.trim();
    default: return preset; // raw cron expression
  }
}

const AdminCronManager = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<CronJob | null>(null);
  const [preset, setPreset] = useState<string>("daily");
  const [hour, setHour] = useState(3);
  const [minute, setMinute] = useState(0);
  const [weekday, setWeekday] = useState<number>(1);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_cron_jobs" as any);
      if (error) throw error;
      setJobs((data ?? []) as CronJob[]);
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to load cron jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (job: CronJob) => {
    setEditing(job);
    setPreset("custom");
    setCustom(job.schedule);
    setHour(3);
    setMinute(0);
    setWeekday(1);
  };

  const handleSave = async () => {
    if (!editing) return;
    const schedule = buildSchedule(preset, hour, minute, weekday, custom);
    if (!schedule) {
      toast.error("Schedule is empty");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("admin_update_cron_schedule" as any, {
        _jobname: editing.jobname,
        _schedule: schedule,
      });
      if (error) throw error;
      toast.success(`Updated ${editing.jobname}`);
      setEditing(null);
      load();
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to update schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (job: CronJob, active: boolean) => {
    try {
      const { error } = await supabase.rpc("admin_toggle_cron_job" as any, {
        _jobname: job.jobname,
        _active: active,
      });
      if (error) throw error;
      toast.success(`${job.jobname} ${active ? "enabled" : "disabled"}`);
      setJobs((prev) => prev.map((j) => j.jobname === job.jobname ? { ...j, active } : j));
    } catch (e) {
      toast.error((e as Error)?.message || "Failed to toggle job");
    }
  };

  const filtered = jobs.filter((j) => j.jobname.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="bg-secondary/20 border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Cron Schedule Manager
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Control timing for every background job. Pick frequency + hour + day, toggle on/off, or paste a custom cron expression.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Input
            placeholder="Search jobs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 w-48"
          />
          <Button size="sm" variant="outline" disabled={loading} onClick={load}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-md divide-y divide-border overflow-hidden">
        {filtered.length === 0 && !loading && (
          <div className="p-4 text-xs text-muted-foreground text-center">No cron jobs match.</div>
        )}
        {filtered.map((job) => (
          <div key={job.jobid} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-secondary/30">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${job.active ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
                {job.jobname}
              </div>
              <div className="text-xs text-foreground/70 mt-1 leading-snug">
                {describeJob(job)}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                {describeSchedule(job.schedule)} <span className="opacity-50">— {job.schedule}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Switch checked={job.active} onCheckedChange={(v) => handleToggle(job, v)} />
              <Button size="sm" variant="ghost" onClick={() => openEdit(job)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Reschedule: {editing?.jobname}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Frequency</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCY_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(preset === "daily" || preset === "weekly" || preset === "every-3d") && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Hour (UTC, 0-23)</Label>
                  <Input type="number" min={0} max={23} value={hour}
                    onChange={(e) => setHour(Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Minute (0-59)</Label>
                  <Input type="number" min={0} max={59} value={minute}
                    onChange={(e) => setMinute(Number(e.target.value))} className="mt-1" />
                </div>
              </div>
            )}

            {(preset === "hourly" || preset === "every-3h" || preset === "every-6h") && (
              <div>
                <Label className="text-xs">Minute offset (0-59)</Label>
                <Input type="number" min={0} max={59} value={minute}
                  onChange={(e) => setMinute(Number(e.target.value))} className="mt-1" />
              </div>
            )}

            {preset === "weekly" && (
              <div>
                <Label className="text-xs">Day of week</Label>
                <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {preset === "custom" && (
              <div>
                <Label className="text-xs">Cron expression</Label>
                <Input value={custom} onChange={(e) => setCustom(e.target.value)}
                  placeholder="*/5 * * * *" className="mt-1 font-mono" />
                <p className="text-[10px] text-muted-foreground mt-1">Format: minute hour day month weekday (or "30 seconds")</p>
              </div>
            )}

            <div className="bg-muted/40 border border-border rounded p-2 text-[11px] font-mono">
              Preview: <span className="text-primary">{buildSchedule(preset, hour, minute, weekday, custom) || "—"}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCronManager;