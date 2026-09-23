import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Wand2, Check, X, ChevronRight } from "lucide-react";

interface Proposal {
  id: string;
  old: string;
  new: string;
  type: string;
  confidence: "high" | "medium" | "low";
  platform: string;
  region: string;
  changed: boolean;
  ruleMatched?: boolean;
}

const TYPE_FILTERS = [
  "all", "Game", "Edition", "DLC", "Game + Bonus", "PRE ORDER BONUS",
  "Season Pass", "Expansion", "Skin", "Currency", "Bundle",
  "Subscription", "Top Up",
];

const AdminTitleReformatter = () => {
  const [batchStart, setBatchStart] = useState(0);
  const [batchLimit, setBatchLimit] = useState(50);
  const [filterType, setFilterType] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);
  const [hideUnchanged, setHideUnchanged] = useState(true);

  const loadPreview = async (start = 0) => {
    setLoading(true);
    setProposals([]);
    setEdits({});
    setSelected(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("reformat-titles", {
        body: {
          mode: "preview",
          batchStart: start,
          batchLimit,
          filterType: filterType === "all" ? null : filterType,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const props: Proposal[] = data.proposals || [];
      setProposals(props);
      setHasMore(!!data.hasMore);
      setBatchStart(start);
      // Pre-select all CHANGED rows by default
      setSelected(new Set(props.filter((p) => p.changed).map((p) => p.id)));
      toast.success(`Loaded ${props.length} proposals (${props.filter((p) => p.changed).length} would change)`);
    } catch (e: any) {
      toast.error(e.message || "Failed to load preview");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const applySelected = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one row");
      return;
    }
    if (!confirm(`Apply ${selected.size} title updates to the catalog?`)) return;
    setApplying(true);
    try {
      const overrides: Record<string, string> = {};
      const learn: Array<{
        id: string; oldTitle: string; proposed: string; finalTitle: string;
        platform: string; region: string; typeHint: string | null;
      }> = [];
      for (const p of proposals) {
        if (!selected.has(p.id)) continue;
        const finalTitle = (edits[p.id] ?? p.new).trim();
        overrides[p.id] = finalTitle;
        // Only send to learning if user manually edited away from the auto-proposal
        if (finalTitle && finalTitle !== p.new) {
          learn.push({
            id: p.id,
            oldTitle: p.old,
            proposed: p.new,
            finalTitle,
            platform: p.platform,
            region: p.region,
            typeHint: p.type || null,
          });
        }
      }
      const { data, error } = await supabase.functions.invoke("reformat-titles", {
        body: { mode: "apply", overrides, learn },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const learned = data?.rulesLearned || 0;
      toast.success(
        `Applied ${data.applied} updates${learned ? ` · learned ${learned} rule${learned === 1 ? "" : "s"}` : ""}`
      );
      // Remove applied rows from local list
      setProposals((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e.message || "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const visible = hideUnchanged ? proposals.filter((p) => p.changed) : proposals;
  const changedCount = proposals.filter((p) => p.changed).length;

  const confidenceColor = (c: Proposal["confidence"]) =>
    c === "high" ? "bg-primary/20 text-primary border-primary/30"
    : c === "medium" ? "bg-accent/20 text-accent-foreground border-accent/30"
    : "bg-destructive/20 text-destructive border-destructive/30";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wand2 className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Title Reformatter</h2>
        <span className="text-xs text-muted-foreground">
          Convert legacy titles to “Name - Sub-Title (Type) - Platform - Region”
        </span>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        💡 Edit any proposed title manually before applying — the system will learn the pattern
        and apply it automatically to similar titles in the next batch.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-secondary/30 rounded-lg border border-border">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Filter by type</Label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 px-3 rounded-md bg-background border border-border text-sm"
          >
            {TYPE_FILTERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Batch size</Label>
          <Input type="number" min={10} max={500} value={batchLimit}
            onChange={(e) => setBatchLimit(Math.max(10, Math.min(500, Number(e.target.value) || 50)))}
            className="w-24" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Start offset</Label>
          <Input type="number" min={0} value={batchStart}
            onChange={(e) => setBatchStart(Math.max(0, Number(e.target.value) || 0))}
            className="w-28" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={hideUnchanged} onCheckedChange={(v) => setHideUnchanged(!!v)} />
          Hide unchanged
        </label>
        <Button onClick={() => loadPreview(0)} disabled={loading} className="ml-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
          Generate Preview
        </Button>
      </div>

      {/* Summary + Apply */}
      {proposals.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="text-sm">
            <span className="font-bold">{proposals.length}</span> total ·{" "}
            <span className="font-bold text-primary">{changedCount}</span> changed ·{" "}
            <span className="font-bold text-primary">{selected.size}</span> selected
          </div>
          <div className="flex gap-2">
            {hasMore && (
              <Button variant="outline" size="sm" onClick={() => loadPreview(batchStart + batchLimit)} disabled={loading}>
                Next batch <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
            <Button onClick={applySelected} disabled={applying || selected.size === 0}>
              {applying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Apply {selected.size} update{selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {/* Proposals table */}
      {visible.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[40px_1fr_1fr_120px_60px] gap-2 px-3 py-2 bg-secondary/50 text-xs font-bold uppercase tracking-wider">
                <div></div>
                <div>Old title</div>
                <div>New title (editable)</div>
                <div>Type</div>
                <div className="text-center">Conf.</div>
              </div>
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {visible.map((p) => {
                  const isSelected = selected.has(p.id);
                  const editedValue = edits[p.id] ?? p.new;
                  return (
                    <div key={p.id} className={`grid grid-cols-[40px_1fr_1fr_120px_60px] gap-2 px-3 py-2 items-center text-sm ${isSelected ? "bg-primary/5" : ""}`}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(p.id)} />
                      <div className="text-muted-foreground line-through truncate" title={p.old}>{p.old}</div>
                      <div className="relative">
                        <Input
                          value={editedValue}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className="h-8 text-sm pr-12"
                        />
                        {p.ruleMatched && (
                          <span
                            title="Matched a learned correction rule"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded"
                          >
                            RULE
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs justify-center">{p.type}</Badge>
                      <div className="flex justify-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${confidenceColor(p.confidence)}`}>
                          {p.confidence[0].toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && proposals.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
          <Wand2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Configure filters and click <strong>Generate Preview</strong> to see proposed title changes.</p>
        </div>
      )}
    </div>
  );
};

export default AdminTitleReformatter;