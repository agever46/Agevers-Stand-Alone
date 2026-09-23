import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, Eye, Plus, Pencil, Trash2,
} from "lucide-react";

interface AuditEntry {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  entity_title: string | null;
  changes: Record<string, unknown>;
  performed_by: string;
  performer_email: string | null;
  ip_address: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500/20 text-green-400 border-green-500/30",
  update: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  delete: "bg-red-500/20 text-red-400 border-red-500/30",
};

const ACTION_ICONS: Record<string, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

const ENTITY_TYPES = [
  "all", "product", "order", "pricing", "collection", "user", "discount",
  "daily_deal", "nav_menu", "kinguin", "auto_group", "guide",
];

const AdminAuditLog = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const PAGE_SIZE = 30;

  const fetchEntries = async () => {
    setLoading(true);
    let query = supabase
      .from("admin_audit_log" as any)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (filterAction !== "all") query = query.eq("action_type", filterAction);
    if (filterEntity !== "all") query = query.eq("entity_type", filterEntity);
    if (search.trim()) {
      query = query.or(`entity_title.ilike.%${search.trim()}%,performer_email.ilike.%${search.trim()}%`);
    }

    const { data, count } = await query;
    setEntries((data as unknown as AuditEntry[]) || []);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [page, filterAction, filterEntity]);

  const handleSearch = () => { setPage(1); fetchEntries(); };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) +
      " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-foreground">Audit Log</h2>
        <span className="text-xs text-muted-foreground">{total} entries</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by title or email..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(1); }}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={(v) => { setFilterEntity(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t === "all" ? "All Entities" : t.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => { setPage(1); fetchEntries(); }}>
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="text-xs w-[130px]">Time</TableHead>
              <TableHead className="text-xs w-[80px]">Action</TableHead>
              <TableHead className="text-xs w-[100px]">Entity</TableHead>
              <TableHead className="text-xs">Title</TableHead>
              <TableHead className="text-xs">Admin</TableHead>
              <TableHead className="text-xs w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : entries.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">No audit entries yet</TableCell></TableRow>
            ) : entries.map((entry) => {
              const ActionIcon = ACTION_ICONS[entry.action_type] || Pencil;
              return (
                <TableRow key={entry.id} className="hover:bg-secondary/20 cursor-pointer" onClick={() => setSelectedEntry(entry)}>
                  <TableCell className="text-[11px] text-muted-foreground font-mono">{formatDate(entry.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] gap-1 ${ACTION_COLORS[entry.action_type] || ""}`}>
                      <ActionIcon className="h-2.5 w-2.5" />
                      {entry.action_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs capitalize">{entry.entity_type.replace("_", " ")}</TableCell>
                  <TableCell className="text-xs font-medium truncate max-w-[200px]">{entry.entity_title || "—"}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground truncate max-w-[180px]">{entry.performer_email || "System"}</TableCell>
                  <TableCell>
                    <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-display">Audit Entry Details</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground text-xs">Action:</span>
                  <Badge variant="outline" className={`ml-2 text-[10px] ${ACTION_COLORS[selectedEntry.action_type] || ""}`}>
                    {selectedEntry.action_type}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground text-xs">Entity:</span> <span className="text-xs capitalize ml-1">{selectedEntry.entity_type.replace("_", " ")}</span></div>
                <div><span className="text-muted-foreground text-xs">Time:</span> <span className="text-xs ml-1">{formatDate(selectedEntry.created_at)}</span></div>
                <div><span className="text-muted-foreground text-xs">Admin:</span> <span className="text-xs ml-1">{selectedEntry.performer_email || "—"}</span></div>
              </div>
              {selectedEntry.entity_title && (
                <div><span className="text-muted-foreground text-xs">Title:</span> <span className="text-xs font-medium ml-1">{selectedEntry.entity_title}</span></div>
              )}
              {selectedEntry.entity_id && (
                <div><span className="text-muted-foreground text-xs">ID:</span> <span className="text-[10px] font-mono ml-1 text-muted-foreground">{selectedEntry.entity_id}</span></div>
              )}
              {selectedEntry.changes && Object.keys(selectedEntry.changes).length > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs block mb-1">Changes:</span>
                  <pre className="text-[10px] bg-secondary/50 rounded-lg p-3 overflow-auto max-h-[300px] whitespace-pre-wrap">
                    {JSON.stringify(selectedEntry.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAuditLog;
