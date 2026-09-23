import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import {
  clearFinishedImportQueue,
  clearImportQueue,
  getImportQueue,
  subscribeImportQueue,
  type ImportQueueItem,
} from "@/lib/importQueueStore";

/**
 * Floating import-progress panel. Rendered globally so the queue stays
 * visible while the admin moves between tabs / the storefront.
 */
const ImportQueuePanel = () => {
  const [items, setItems] = useState<ImportQueueItem[]>(getImportQueue());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => subscribeImportQueue(setItems), []);

  if (items.length === 0) return null;

  const active = items.filter((q) => q.status === "importing" || q.status === "queued").length;

  return (
    <div className="fixed right-4 bottom-4 z-50 w-80 max-h-[70vh] flex flex-col rounded-lg border border-border bg-background/95 backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-display font-bold tracking-wide">Import Queue</span>
          <span className="text-[10px] text-muted-foreground">
            {active} active · {items.length} total
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 hover:bg-primary/20"
          >
            {collapsed ? "Show" : "Hide"}
          </button>
          <button
            onClick={clearFinishedImportQueue}
            className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 hover:bg-destructive/20"
            title="Clear finished"
          >
            Clear
          </button>
          <button
            onClick={clearImportQueue}
            className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 hover:bg-destructive/20"
            title="Dismiss all"
          >
            ✕
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {items.map((q) => {
            const color =
              q.status === "success" ? "border-emerald-500/50 bg-emerald-500/5"
              : q.status === "duplicate" ? "border-amber-500/50 bg-amber-500/5"
              : q.status === "error" || q.status === "unavailable" ? "border-red-500/50 bg-red-500/5"
              : q.status === "importing" ? "border-primary/60 bg-primary/5"
              : "border-border bg-secondary/30";
            const icon =
              q.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              : q.status === "duplicate" ? <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />
              : q.status === "error" || q.status === "unavailable" ? <XCircle className="h-3.5 w-3.5 text-red-500" />
              : q.status === "importing" ? <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              : <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
            return (
              <div key={q.id} className={`flex items-center gap-2 p-1.5 rounded border ${color}`}>
                {q.image ? (
                  <img src={q.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold truncate">{q.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {q.message || q.status}
                    <span className="ml-1 opacity-60">· {q.source === "kinguin" ? "Kinguin" : "Discover"}</span>
                  </div>
                </div>
                <div className="shrink-0">{icon}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ImportQueuePanel;
