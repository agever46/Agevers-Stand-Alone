import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, Loader2, Package, X, Check, Layers } from "lucide-react";
import { classifyGameItem, isNoTypeProduct, type GameItemType } from "@/lib/gameItemClassifier";

interface CandidateProduct {
  id: string;
  title: string;
  original_title: string | null;
  platform: string;
  store: string | null;
  region: string | null;
  image_url: string | null;
  slug: string;
}

interface Candidate {
  key: string;
  suggestedTitle: string;
  products: CandidateProduct[];
  excluded: Set<string>;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Add-on/DLC/bundle name indicators — used both to check a colon-separated
// suffix ("The Sims 4: Back to School Bundle") and a dash-separated middle
// segment ("The Sims 4 - Werewolves Game Pack DLC - PC - Global").
const ADDON_KEYWORD_RE = /\b(stuff(?:\s+pack)?|game\s+pack|expansion(?:\s+pack)?|kit|bundle|dlc|skins?|bonus|season\s+pass|content\s+pack|character\s+pack|outfit|cosmetic|upgrade|add[\s-]?on)\b/i;
const EDITION_RE = /\b(DIGITAL\s+DELUXE|SUPER\s+DELUXE|GAME\s+OF\s+THE\s+YEAR|DEFINITIVE|DELUXE|ULTIMATE|GOLD|PREMIUM|COLLECTOR'?S?|LIMITED|LEGACY|COMPLETE|GOTY|LEGENDARY|CHAMPION|ENHANCED|ANNIVERSARY|STANDARD)\s+EDITION\b/gi;
const GOTY_STANDALONE_RE = /\bGOTY\b/g;
// Denomination amounts on gift cards / wallet top-ups (e.g. "Steam Wallet
// Card 2 USD", "PSN Card $50") — different amounts of the SAME card are
// meant to become a value switcher within one group, same as region, so
// they must not split the grouping key.
const CURRENCY_CODES = "USD|EUR|GBP|CAD|AUD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|BRL|ARS|MXN|CLP|COP|PEN|JPY|KRW|CNY|INR|ZAR|SAR|AED|ILS|NZD|SGD|HKD|THB|MYR|PHP|IDR|VND|TWD|BGN|UAH|UYU|CRC|MVR";
const AMOUNT_RE = new RegExp(
  `\\b\\d+(?:[.,]\\d+)?\\s*(?:${CURRENCY_CODES})\\b|\\b(?:${CURRENCY_CODES})\\s*\\d+(?:[.,]\\d+)?\\b|[$€£]\\s*\\d+(?:[.,]\\d+)?`,
  "gi",
);

// Returns the base game name, or null when the title looks like a distinct
// add-on/DLC/bundle product rather than a region/edition variant of the same
// product — those should never be merged into the same candidate group.
// Titles here follow "Name[: Addon] - [Addon -] Platform - Region"; the
// number of dash-separated segments and what's in them tells us which shape
// we're looking at, rather than trusting the position of the first dash.
function extractBaseNameOrNull(rawTitle: string): string | null {
  let name = rawTitle.trim();
  name = name.replace(/^\s*PRE[\s-]?ORDER\s+BONUS\s*[:\-–—]?\s*/i, "");
  name = name.replace(/^\s*PRE[\s-]?ORDER\s*[:\-–—]?\s*/i, "");

  const segments = name.split(/\s[-–—]\s/).map((s) => s.trim()).filter(Boolean);
  let base = segments[0] || name;

  // "Name - Addon - Platform - Region" (4 segments) or "Name - Addon -
  // Platform" (3 segments where the middle one reads like an add-on) — the
  // extra segment is the add-on's own name, not part of the base game.
  if (segments.length > 3) return null;
  if (segments.length === 3 && ADDON_KEYWORD_RE.test(segments[1])) return null;

  // Colon-separated add-on name within the first segment, e.g.
  // "The Sims 4: Back to School Bundle" — strip it, UNLESS it's just a
  // regular subtitle like "Call of Duty: Black Ops 6".
  const lastColon = base.lastIndexOf(":");
  if (lastColon > 0) {
    const after = base.slice(lastColon + 1).trim();
    if (ADDON_KEYWORD_RE.test(after)) {
      base = base.slice(0, lastColon);
    }
  }
  return base.trim();
}

function suggestedTitleFrom(rawTitle: string): string | null {
  const base = extractBaseNameOrNull(rawTitle);
  if (base === null) return null;
  return base
    .replace(EDITION_RE, "")
    .replace(GOTY_STANDALONE_RE, "")
    .replace(AMOUNT_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

const PAGE_SIZE = 1000;

async function fetchAllGroupedProductIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("game_group_items")
      .select("allowed_product_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of (data as any[]) || []) ids.add(row.allowed_product_id);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return ids;
}

async function fetchCandidateProducts(searchQuery: string): Promise<CandidateProduct[]> {
  const rows: CandidateProduct[] = [];
  let from = 0;
  for (;;) {
    let q = supabase
      .from("allowed_products")
      .select("id, title, original_title, platform, store, region, image_url, slug")
      .range(from, from + PAGE_SIZE - 1);
    if (searchQuery) q = q.ilike("title", `%${searchQuery}%`);
    const { data, error } = await q;
    if (error) throw error;
    for (const p of (data as any[]) || []) {
      if (isNoTypeProduct({ store: p.store })) continue;
      if (p.store === "Subscriptions" || p.store === "Top Ups") continue;
      // Second opinion beyond the title-structure check below: an explicit
      // DLC/skin/currency classification also disqualifies a product from
      // base-game grouping.
      const itemType = classifyGameItem(p.original_title?.trim() ? p.original_title : p.title);
      if (itemType === "dlc" || itemType === "skin" || itemType === "currency") continue;
      rows.push(p);
    }
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

const AdminGameGroupSuggestions = () => {
  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<{ scanned: number; alreadyGrouped: number } | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [titleEdits, setTitleEdits] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const scan = async () => {
    setScanning(true);
    setCandidates([]);
    setStats(null);
    try {
      const groupedIds = await fetchAllGroupedProductIds();
      const products = await fetchCandidateProducts(searchQuery.trim());

      const byKey = new Map<string, { suggestedTitle: string; products: CandidateProduct[] }>();
      for (const p of products) {
        if (groupedIds.has(p.id)) continue;
        const srcTitle = p.original_title?.trim() ? p.original_title : p.title;
        const suggestedTitle = suggestedTitleFrom(srcTitle);
        if (suggestedTitle === null) continue;
        const key = suggestedTitle.replace(/[^A-Za-z0-9]+/g, " ").trim().toUpperCase();
        if (!key || key.length < 3) continue;
        if (!byKey.has(key)) byKey.set(key, { suggestedTitle, products: [] });
        byKey.get(key)!.products.push(p);
      }

      const found: Candidate[] = [];
      for (const [key, entry] of byKey.entries()) {
        if (entry.products.length < 2) continue;
        found.push({
          key,
          suggestedTitle: entry.suggestedTitle,
          products: entry.products,
          excluded: new Set(),
        });
      }
      found.sort((a, b) => b.products.length - a.products.length);

      setStats({ scanned: products.length, alreadyGrouped: groupedIds.size });
      setCandidates(found);
      if (found.length === 0) {
        toast.info("No candidate groups found — everything scanned is either already grouped or has no matching variant.");
      }
    } catch (err: any) {
      toast.error(err.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const toggleExclude = (candKey: string, productId: string) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.key !== candKey) return c;
        const next = new Set(c.excluded);
        if (next.has(productId)) next.delete(productId);
        else next.add(productId);
        return { ...c, excluded: next };
      }),
    );
  };

  const reject = (candKey: string) => {
    setCandidates((prev) => prev.filter((c) => c.key !== candKey));
  };

  const approve = async (cand: Candidate) => {
    const surviving = cand.products.filter((p) => !cand.excluded.has(p.id));
    if (surviving.length < 2) {
      toast.error("At least 2 products must remain to create a group");
      return;
    }
    const title = (titleEdits[cand.key] ?? cand.suggestedTitle).trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    setSavingKey(cand.key);
    try {
      const slug = slugify(title);
      const { data: newGroup, error: groupErr } = await supabase
        .from("game_groups")
        .insert({ title, slug, image_url: surviving[0].image_url, is_active: true } as any)
        .select()
        .single();
      if (groupErr) throw groupErr;

      const itemRows = surviving.map((p, idx) => ({
        group_id: (newGroup as any).id,
        allowed_product_id: p.id,
        item_type: classifyGameItem(p.original_title?.trim() ? p.original_title : p.title) as GameItemType,
        display_order: idx,
      }));
      const { error: itemsErr } = await supabase.from("game_group_items").insert(itemRows as any);
      if (itemsErr) throw itemsErr;

      toast.success(`"${title}" created with ${surviving.length} items`);
      setCandidates((prev) => prev.filter((c) => c.key !== cand.key));
    } catch (err: any) {
      if (String(err.message || "").includes("duplicate key")) {
        toast.error(`A group with slug "${slugify(title)}" already exists — edit the title and try again`);
      } else {
        toast.error(err.message || "Failed to create group");
      }
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">Group Suggestions</h2>
          <p className="text-xs text-muted-foreground">
            Scans ungrouped products for likely region/edition variants of the same game. Nothing is written until you approve a candidate.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !scanning) scan(); }}
          placeholder="Optional: search a specific product title to test on (e.g. a game with few variants)"
          className="h-8 text-sm flex-1"
        />
        <Button onClick={scan} disabled={scanning} size="sm" className="gap-1.5 shrink-0">
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {scanning ? "Scanning..." : searchQuery.trim() ? "Search" : "Scan for Candidate Groups"}
        </Button>
      </div>

      {stats && (
        <p className="text-xs text-muted-foreground">
          Scanned {stats.scanned} eligible product{stats.scanned === 1 ? "" : "s"}
          {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ""} ({stats.alreadyGrouped} already in a group) — found {candidates.length} candidate group{candidates.length === 1 ? "" : "s"}.
        </p>
      )}

      {candidates.length === 0 && !scanning && !stats && (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border/50 rounded-lg">
          <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Click "Scan for Candidate Groups" to look for ungrouped variants.
        </div>
      )}

      <div className="space-y-3">
        {candidates.map((cand) => {
          const surviving = cand.products.filter((p) => !cand.excluded.has(p.id));
          return (
            <div key={cand.key} className="border border-border/50 rounded-lg p-3 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Input
                  value={titleEdits[cand.key] ?? cand.suggestedTitle}
                  onChange={(e) => setTitleEdits((prev) => ({ ...prev, [cand.key]: e.target.value }))}
                  className="h-8 text-sm font-display font-bold flex-1"
                />
                <span className="text-[10px] text-muted-foreground shrink-0">{surviving.length} items</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                {cand.products.map((p) => {
                  const isExcluded = cand.excluded.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 p-1.5 rounded border ${isExcluded ? "border-border/30 opacity-40" : "border-border/50"}`}
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.platform} · {p.region || "—"}</p>
                      </div>
                      <button
                        onClick={() => toggleExclude(cand.key, p.id)}
                        className="shrink-0 p-1 rounded hover:bg-muted"
                        title={isExcluded ? "Include in group" : "Remove from group"}
                      >
                        {isExcluded ? <Check className="h-3.5 w-3.5 text-muted-foreground" /> : <X className="h-3.5 w-3.5 text-destructive" />}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 text-[11px] gap-1"
                  disabled={savingKey === cand.key || surviving.length < 2}
                  onClick={() => approve(cand)}
                >
                  {savingKey === cand.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] gap-1 text-muted-foreground"
                  disabled={savingKey === cand.key}
                  onClick={() => reject(cand.key)}
                >
                  <X className="h-3 w-3" /> Reject
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminGameGroupSuggestions;
