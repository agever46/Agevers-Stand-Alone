import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock, Wand2 } from "lucide-react";

export type ParaphraseStatus = "queued" | "running" | "success" | "error";

export interface ParaphraseItem {
  id: string;
  title: string;
  image: string | null;
  status: ParaphraseStatus;
  message?: string;
  startedAt: number;
}

type Listener = (items: ParaphraseItem[]) => void;

const state: { items: ParaphraseItem[]; listeners: Set<Listener> } = {
  items: [],
  listeners: new Set(),
};

const emit = () => state.listeners.forEach((l) => l([...state.items]));

export const paraphraseQueue = {
  enqueue(item: Omit<ParaphraseItem, "startedAt" | "status"> & { status?: ParaphraseStatus }) {
    // If already present, reset to queued
    const existing = state.items.find((i) => i.id === item.id);
    if (existing) {
      existing.status = item.status ?? "queued";
      existing.message = undefined;
      existing.startedAt = Date.now();
    } else {
      state.items = [
        { ...item, status: item.status ?? "queued", startedAt: Date.now() },
        ...state.items,
      ];
    }
    emit();
  },
  update(id: string, patch: Partial<ParaphraseItem>) {
    state.items = state.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    emit();
  },
  clearFinished() {
    state.items = state.items.filter((i) => i.status === "queued" || i.status === "running");
    emit();
  },
  subscribe(l: Listener) {
    state.listeners.add(l);
    l([...state.items]);
    return () => state.listeners.delete(l);
  },
};

export const ParaphraseQueuePanel = () => {
  const [items, setItems] = useState<ParaphraseItem[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const unsub = paraphraseQueue.subscribe(setItems);
    return () => { unsub(); };
  }, []);

  if (items.length === 0) return null;

  const active = items.filter((q) => q.status === "queued" || q.status === "running").length;

  return (
    <div className="fixed right-4 bottom-4 z-50 w-80 max-h-[70vh] flex flex-col rounded-lg border border-border bg-background/95 backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Wand2 className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-display font-bold tracking-wide">Paraphrase Queue</span>
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
            onClick={() => paraphraseQueue.clearFinished()}
            className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 hover:bg-destructive/20"
            title="Clear finished"
          >
            Clear
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {items.map((q) => {
            const color =
              q.status === "success" ? "border-emerald-500/50 bg-emerald-500/5"
              : q.status === "error" ? "border-red-500/50 bg-red-500/5"
              : q.status === "running" ? "border-violet-500/60 bg-violet-500/5"
              : "border-border bg-secondary/30";
            const icon =
              q.status === "success" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              : q.status === "error" ? <XCircle className="h-3.5 w-3.5 text-red-500" />
              : q.status === "running" ? <Loader2 className="h-3.5 w-3.5 text-violet-400 animate-spin" />
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

export default ParaphraseQueuePanel;