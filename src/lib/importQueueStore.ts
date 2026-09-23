/**
 * Global, localStorage-persisted import queue.
 * Shared between Discover (kinguin_product_suggestions) approvals and
 * Kinguin Manager imports so the admin can navigate away and come back
 * while still tracking progress.
 */
export type ImportQueueStatus =
  | "queued"
  | "importing"
  | "success"
  | "duplicate"
  | "error"
  | "unavailable";

export interface ImportQueueItem {
  id: string;
  title: string;
  image: string | null;
  status: ImportQueueStatus;
  message?: string;
  source: "discover" | "kinguin";
  startedAt: number;
}

const STORAGE_KEY = "agevers_import_queue";
const MAX_ITEMS = 200;
const STALE_MS = 6 * 60 * 60 * 1000; // drop entries older than 6h

let items: ImportQueueItem[] = load();
const listeners = new Set<(items: ImportQueueItem[]) => void>();

function load(): ImportQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ImportQueueItem[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .filter((i) => i && typeof i.id === "string" && now - (i.startedAt || 0) < STALE_MS)
      // Anything left "in flight" from a previous page load can never resume.
      .map((i) =>
        i.status === "importing" || i.status === "queued"
          ? { ...i, status: "error" as const, message: i.message || "Interrupted (page reloaded)" }
          : i,
      );
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* quota / private mode — in-memory state still works */
  }
  listeners.forEach((l) => l(items));
}

export function getImportQueue(): ImportQueueItem[] {
  return items;
}

export function subscribeImportQueue(cb: (items: ImportQueueItem[]) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function pushImportQueueItem(item: Omit<ImportQueueItem, "startedAt"> & { startedAt?: number }) {
  items = [
    { startedAt: Date.now(), ...item },
    ...items.filter((i) => i.id !== item.id),
  ].slice(0, MAX_ITEMS);
  persist();
}

export function updateImportQueueItem(id: string, patch: Partial<ImportQueueItem>) {
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  items = items.map((i, n) => (n === idx ? { ...i, ...patch } : i));
  persist();
}

export function clearFinishedImportQueue() {
  items = items.filter((i) => i.status === "importing" || i.status === "queued");
  persist();
}

export function clearImportQueue() {
  items = [];
  persist();
}
