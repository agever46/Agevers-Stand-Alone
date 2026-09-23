import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Search, RefreshCw, ChevronLeft, ChevronRight, Eye, CheckCircle2, XCircle, Clock, Ban, AlertTriangle } from "lucide-react";

interface LogRow {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string;
  error_message: string | null;
  metadata: any;
  created_at: string;
}

const RANGES: Record<string, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: 3650,
};

const STATUS_STYLES: Record<string, string> = {
  sent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  pending: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  dlq: "bg-red-500/15 text-red-300 border-red-500/30",
  bounced: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  complained: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  suppressed: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
};

const PAGE_SIZE = 50;

const AdminEmailLogs = () => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>("7d");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LogRow | null>(null);
  const [templates, setTemplates] = useState<string[]>([]);

  const fetchAll = async () => {
    setLoading(true);
    const sinceIso = new Date(Date.now() - RANGES[range] * 24 * 60 * 60 * 1000).toISOString();
    // Fetch a generous window — we dedupe by message_id client-side.
    let q = supabase
      .from("email_send_log" as any)
      .select("id, message_id, template_name, recipient_email, status, error_message, metadata, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000);
    const { data, error } = await q;
    if (error) {
      console.error("[AdminEmailLogs] fetch error", error);
      setRows([]);
    } else {
      const all = (data as unknown as LogRow[]) || [];
      // Dedupe: keep latest row per message_id (rows already sorted desc).
      const seen = new Set<string>();
      const deduped: LogRow[] = [];
      for (const r of all) {
        const key = r.message_id || r.id;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(r);
      }
      setRows(deduped);
      const tset = new Set<string>();
      deduped.forEach((r) => r.template_name && tset.add(r.template_name));
      setTemplates(Array.from(tset).sort());
    }
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
      if (term) {
        const hay = `${r.recipient_email || ""} ${r.template_name || ""} ${r.message_id || ""} ${r.error_message || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, templateFilter, search]);

  const stats = useMemo(() => {
    const s = { total: filtered.length, sent: 0, failed: 0, pending: 0, suppressed: 0 };
    for (const r of filtered) {
      if (r.status === "sent") s.sent++;
      else if (r.status === "failed" || r.status === "dlq" || r.status === "bounced" || r.status === "complained") s.failed++;
      else if (r.status === "pending") s.pending++;
      else if (r.status === "suppressed") s.suppressed++;
    }
    return s;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) +
      " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  const statusBadge = (s: string) => {
    const cls = STATUS_STYLES[s] || "bg-secondary text-foreground border-border";
    const Icon =
      s === "sent" ? CheckCircle2 :
      s === "pending" ? Clock :
      s === "suppressed" ? Ban :
      (s === "failed" || s === "dlq") ? XCircle :
      AlertTriangle;
    return (
      <Badge variant="outline" className={`text-[10px] gap-1 ${cls}`}>
        <Icon className="h-2.5 w-2.5" />
        {s}
      </Badge>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Mail className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Sent Emails</h1>
        <Badge variant="outline" className="ml-2 text-[10px]">
          via Resend &amp; Lovable
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Every transactional email sent from the site is logged here — no need to open the Resend dashboard.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-emerald-300">Sent</div>
          <div className="text-2xl font-bold text-emerald-300">{stats.sent}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-blue-300">Pending</div>
          <div className="text-2xl font-bold text-blue-300">{stats.pending}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-red-300">Failed</div>
          <div className="text-2xl font-bold text-red-300">{stats.failed}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-yellow-300">Suppressed</div>
          <div className="text-2xl font-bold text-yellow-300">{stats.suppressed}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="dlq">DLQ</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
            <SelectItem value="suppressed">Suppressed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={templateFilter} onValueChange={(v) => { setTemplateFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All templates</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search recipient, template, error..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={fetchAll}>
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </Card>

      {/* Table */}
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="text-xs w-[140px]">Time</TableHead>
              <TableHead className="text-xs w-[110px]">Status</TableHead>
              <TableHead className="text-xs">Template</TableHead>
              <TableHead className="text-xs">Recipient</TableHead>
              <TableHead className="text-xs">Error</TableHead>
              <TableHead className="text-xs w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">No emails for the selected filters</TableCell></TableRow>
            ) : paged.map((r) => (
              <TableRow key={r.id} className="hover:bg-secondary/20 cursor-pointer" onClick={() => setSelected(r)}>
                <TableCell className="text-[11px] text-muted-foreground font-mono">{formatDate(r.created_at)}</TableCell>
                <TableCell>{statusBadge(r.status)}</TableCell>
                <TableCell className="text-xs">{r.template_name || "—"}</TableCell>
                <TableCell className="text-xs truncate max-w-[220px]">{r.recipient_email || "—"}</TableCell>
                <TableCell className="text-[11px] text-red-300 truncate max-w-[280px]">{r.error_message || ""}</TableCell>
                <TableCell><Eye className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Email details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Status:</span> {statusBadge(selected.status)}</div>
                <div><span className="text-muted-foreground">Time:</span> {formatDate(selected.created_at)}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Template:</span> {selected.template_name || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Recipient:</span> {selected.recipient_email || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Message ID:</span> <span className="font-mono text-[10px]">{selected.message_id || "—"}</span></div>
              </div>
              {selected.error_message && (
                <div>
                  <span className="text-muted-foreground text-xs block mb-1">Error</span>
                  <pre className="text-[11px] bg-red-500/10 border border-red-500/30 rounded p-2 overflow-auto whitespace-pre-wrap text-red-200">{selected.error_message}</pre>
                </div>
              )}
              {selected.metadata && Object.keys(selected.metadata || {}).length > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs block mb-1">Metadata</span>
                  <pre className="text-[10px] bg-secondary/50 rounded p-2 overflow-auto max-h-[260px] whitespace-pre-wrap">{JSON.stringify(selected.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmailLogs;