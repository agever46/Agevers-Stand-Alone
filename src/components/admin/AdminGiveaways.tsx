import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trophy, Trash2, Crown, Calendar, Users, Gift, Send, Mail, KeyRound, ShoppingCart, CheckCircle2, Pencil, Package, Upload, X } from "lucide-react";
import AgeversLoader from "@/components/AgeversLoader";
import { logAuditEvent } from "@/lib/auditLog";

interface Giveaway {
  id: string;
  title: string;
  description: string | null;
  allowed_product_id: string | null;
  prize_image_url: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  winner_user_id: string | null;
  winner_email: string | null;
  winner_announced_at: string | null;
  created_at: string;
  fake_entries_boost?: number | null;
  prize_count?: number | null;
}

interface Entry {
  id: string;
  user_id: string;
  user_email: string;
  entry_count: number;
  bonus_from_orders: number;
  joined_at: string;
}

interface AllowedProduct { id: string; title: string; image_url: string | null; kinguin_price?: number | null }

interface GiveawayPrize {
  id: string;
  giveaway_id: string;
  winner_user_id: string;
  winner_email: string;
  game_code: string;
  source: string;
  cost: number | null;
  email_status: string;
  email_sent_at: string | null;
  created_at: string;
}

const fmt = (d: string) => new Date(d).toLocaleString();

const AdminGiveaways = () => {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editFor, setEditFor] = useState<Giveaway | null>(null);
  const [products, setProducts] = useState<AllowedProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    allowed_product_id: "",
    prize_image_url: "",
    duration_days: 4,
    prize_count: 1,
  });
  const [creating, setCreating] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    allowed_product_id: "",
    prize_image_url: "",
    ends_at: "",
    prize_count: 1,
    predetermined_winner_email: "",
    seeded_winners_text: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editProductSearch, setEditProductSearch] = useState("");
  const [uploadingImage, setUploadingImage] = useState<"create" | "edit" | null>(null);

  // Entries dialog
  const [entriesFor, setEntriesFor] = useState<Giveaway | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [newEntryEmail, setNewEntryEmail] = useState("");
  const [newEntryCount, setNewEntryCount] = useState(1);
  const [addingEntry, setAddingEntry] = useState(false);

  // Deliver prize dialog
  const [deliverFor, setDeliverFor] = useState<Giveaway | null>(null);
  const [deliverWinner, setDeliverWinner] = useState<{ user_id: string; email: string } | null>(null);
  const [deliverTab, setDeliverTab] = useState<'kinguin' | 'manual'>('manual');
  const [manualCode, setManualCode] = useState("");
  const [redeemInstructions, setRedeemInstructions] = useState("");
  const [delivering, setDelivering] = useState(false);
  const [prizes, setPrizes] = useState<Record<string, GiveawayPrize[]>>({});

  // Real vs fake entry counts per giveaway (real = user_id exists in profiles)
  const [realCounts, setRealCounts] = useState<Record<string, { real: number; fake: number }>>({});
  // Set of user_ids considered "real" within the currently open entries dialog
  const [realUserIds, setRealUserIds] = useState<Set<string>>(new Set());

  const fetchGiveaways = async () => {
    setLoading(true);
    const { data } = await supabase.from("giveaways" as any).select("*").order("created_at", { ascending: false });
    const list = (data as unknown as Giveaway[]) || [];
    setGiveaways(list);

    // Fetch prizes for all giveaways that may have any
    const ids = list.map(g => g.id);
    if (ids.length > 0) {
      const { data: prizeRows } = await supabase
        .from("giveaway_prizes" as any)
        .select("*")
        .in("giveaway_id", ids)
        .order("created_at", { ascending: true });
      const map: Record<string, GiveawayPrize[]> = {};
      ((prizeRows as unknown as GiveawayPrize[]) || []).forEach(p => {
        if (!map[p.giveaway_id]) map[p.giveaway_id] = [];
        map[p.giveaway_id].push(p);
      });
      setPrizes(map);

      // Compute real vs fake entries per giveaway
      const { data: allEntries } = await supabase
        .from("giveaway_entries" as any)
        .select("giveaway_id, user_id")
        .in("giveaway_id", ids);
      const entryRows = (allEntries as unknown as { giveaway_id: string; user_id: string }[]) || [];
      const allUserIds = Array.from(new Set(entryRows.map(e => e.user_id)));
      let realSet = new Set<string>();
      if (allUserIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("user_id")
          .in("user_id", allUserIds);
        realSet = new Set(((profRows as { user_id: string }[]) || []).map(p => p.user_id));
      }
      const counts: Record<string, { real: number; fake: number }> = {};
      entryRows.forEach(e => {
        if (!counts[e.giveaway_id]) counts[e.giveaway_id] = { real: 0, fake: 0 };
        if (realSet.has(e.user_id)) counts[e.giveaway_id].real++;
        else counts[e.giveaway_id].fake++;
      });
      setRealCounts(counts);
    } else {
      setPrizes({});
      setRealCounts({});
    }
    setLoading(false);
  };

  useEffect(() => { fetchGiveaways(); }, []);

  const searchProducts = async (q: string) => {
    let query = supabase.from("allowed_products").select("id, title, image_url").order("created_at", { ascending: false }).limit(20);
    if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
    const { data } = await query;
    const baseProducts = (data as AllowedProduct[]) || [];
    if (baseProducts.length === 0) {
      setProducts([]);
      return;
    }
    // Fetch cheapest active Kinguin offer per product to show admin the buy cost
    const ids = baseProducts.map(p => p.id);
    const { data: kpRows } = await supabase
      .from("kinguin_products")
      .select("allowed_product_id, kinguin_price, is_active")
      .in("allowed_product_id", ids)
      .eq("is_active", true);
    const cheapest: Record<string, number> = {};
    ((kpRows as { allowed_product_id: string; kinguin_price: number | null }[]) || []).forEach(kp => {
      if (kp.kinguin_price == null) return;
      const current = cheapest[kp.allowed_product_id];
      if (current == null || Number(kp.kinguin_price) < current) {
        cheapest[kp.allowed_product_id] = Number(kp.kinguin_price);
      }
    });
    setProducts(baseProducts.map(p => ({ ...p, kinguin_price: cheapest[p.id] ?? null })));
  };

  useEffect(() => { if (createOpen) searchProducts(productSearch); }, [productSearch, createOpen]);
  useEffect(() => { if (editFor) searchProducts(editProductSearch); }, [editProductSearch, editFor]);

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setCreating(true);
    const starts = new Date();
    const ends = new Date(starts.getTime() + form.duration_days * 24 * 60 * 60 * 1000);
    const { data, error } = await (supabase as any).from("giveaways").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      allowed_product_id: form.allowed_product_id || null,
      prize_image_url: form.prize_image_url.trim() || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: "active",
      prize_count: Math.max(1, Math.min(50, form.prize_count || 1)),
    }).select("id, title").single();
    if (error) toast.error(error.message);
    else {
      await logAuditEvent({
        action_type: "create",
        entity_type: "giveaway",
        entity_id: data?.id,
        entity_title: data?.title || form.title.trim(),
        changes: { duration_days: form.duration_days, ends_at: ends.toISOString(), prize_count: form.prize_count },
      });
      toast.success("Giveaway created!");
      setCreateOpen(false);
      setForm({ title: "", description: "", allowed_product_id: "", prize_image_url: "", duration_days: 4, prize_count: 1 });
      fetchGiveaways();
    }
    setCreating(false);
  };

  const openEdit = (g: Giveaway) => {
    setEditFor(g);
    setEditForm({
      title: g.title,
      description: g.description || "",
      allowed_product_id: g.allowed_product_id || "",
      prize_image_url: g.prize_image_url || "",
      ends_at: g.ends_at.slice(0, 16), // for datetime-local
      prize_count: g.prize_count ?? 1,
      predetermined_winner_email: (g as any).predetermined_winner_email || "",
      seeded_winners_text: (Array.isArray((g as any).seeded_winners) ? (g as any).seeded_winners : [])
        .map((s: any) => `${s?.email || ""}${s?.entries ? ":" + s.entries : ""}${s?.bonus ? ":" + s.bonus : ""}`.replace(/:+$/, ""))
        .filter((l: string) => l.trim())
        .join("\n"),
    });
    setEditProductSearch("");
  };

  // Parse "email[:entries[:bonus]]" lines into the seeded_winners jsonb array.
  const parseSeededWinners = (text: string) =>
    text.split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [email, entries, bonus] = l.split(":").map((p) => p.trim());
        return {
          email: (email || "").toLowerCase(),
          entries: Math.max(1, parseInt(entries || "", 10) || 1),
          bonus: Math.max(0, parseInt(bonus || "", 10) || 0),
        };
      })
      .filter((s) => s.email.includes("@"));

  const handleSaveEdit = async () => {
    if (!editFor) return;
    if (!editForm.title.trim()) { toast.error("Title is required"); return; }
    const deliveredCount = prizes[editFor.id]?.length ?? 0;
    const newPrizeCount = Math.max(1, Math.min(50, editForm.prize_count || 1));
    if (newPrizeCount < deliveredCount) {
      toast.error(`Cannot reduce prize count below already delivered (${deliveredCount}).`);
      return;
    }
    setSavingEdit(true);
    const { error } = await (supabase as any).from("giveaways").update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      allowed_product_id: editForm.allowed_product_id || null,
      prize_image_url: editForm.prize_image_url.trim() || null,
      ends_at: new Date(editForm.ends_at).toISOString(),
      prize_count: newPrizeCount,
      predetermined_winner_email: editForm.predetermined_winner_email.trim().toLowerCase() || null,
      seeded_winners: parseSeededWinners(editForm.seeded_winners_text),
    }).eq("id", editFor.id);
    if (error) {
      toast.error(error.message);
    } else {
      await logAuditEvent({
        action_type: "update",
        entity_type: "giveaway",
        entity_id: editFor.id,
        entity_title: editForm.title.trim(),
        changes: {
          ends_at: new Date(editForm.ends_at).toISOString(),
          prize_count: newPrizeCount,
          allowed_product_id: editForm.allowed_product_id || null,
        },
      });
      toast.success("Giveaway updated");
      setEditFor(null);
      fetchGiveaways();
    }
    setSavingEdit(false);
  };

  const openEntries = async (g: Giveaway) => {
    setEntriesFor(g);
    setLoadingEntries(true);
    setNewEntryEmail("");
    setNewEntryCount(1);
    const { data } = await supabase.from("giveaway_entries" as any)
      .select("*").eq("giveaway_id", g.id)
      .order("entry_count", { ascending: false });
    const list = (data as unknown as Entry[]) || [];
    setEntries(list);
    // Determine which entries are real users (exist in profiles)
    const uids = Array.from(new Set(list.map(e => e.user_id)));
    if (uids.length > 0) {
      const { data: profRows } = await supabase
        .from("profiles")
        .select("user_id")
        .in("user_id", uids);
      setRealUserIds(new Set(((profRows as { user_id: string }[]) || []).map(p => p.user_id)));
    } else {
      setRealUserIds(new Set());
    }
    setLoadingEntries(false);
  };

  const addManualEntry = async () => {
    if (!entriesFor) return;
    const email = newEntryEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Invalid email format");
      return;
    }
    const count = Math.max(1, Math.min(1000, Number(newEntryCount) || 1));
    setAddingEntry(true);
    // Check if a real user with that email exists -> merge into their entry; else create a fake-user row
    const existing = entries.find(e => e.user_email.toLowerCase() === email);
    let error: any = null;
    if (existing) {
      const res = await (supabase as any).from("giveaway_entries")
        .update({ entry_count: existing.entry_count + count })
        .eq("id", existing.id);
      error = res.error;
    } else {
      const res = await (supabase as any).from("giveaway_entries").insert({
        giveaway_id: entriesFor.id,
        user_id: crypto.randomUUID(),
        user_email: email,
        entry_count: count,
        bonus_from_orders: 0,
      });
      error = res.error;
    }
    if (error) {
      toast.error(error.message);
    } else {
      await logAuditEvent({
        action_type: existing ? "update" : "create",
        entity_type: "giveaway",
        entity_id: entriesFor.id,
        entity_title: entriesFor.title,
        changes: { action: "add_manual_entry", email, entries_added: count },
      });
      toast.success(existing ? `Added +${count} entries to ${email}` : `Added ${email} with ${count} entries`);
      setNewEntryEmail("");
      setNewEntryCount(1);
      // refresh entries
      const { data } = await supabase.from("giveaway_entries" as any)
        .select("*").eq("giveaway_id", entriesFor.id)
        .order("entry_count", { ascending: false });
      setEntries((data as unknown as Entry[]) || []);
    }
    setAddingEntry(false);
  };

  const pickWinner = async (entry: Entry) => {
    if (!entriesFor) return;
    const deliveredCount = prizes[entriesFor.id]?.length ?? 0;
    const maxPrizes = entriesFor.prize_count ?? 1;
    if (deliveredCount >= maxPrizes) {
      toast.error(`All ${maxPrizes} prizes already delivered.`);
      return;
    }
    if (!confirm(`Crown ${entry.user_email} as a winner and deliver a prize?`)) return;
    // If giveaway has no primary winner yet, set it now. Otherwise just route into Deliver dialog
    // with this specific winner (additional winners are stored only on giveaway_prizes).
    if (!entriesFor.winner_user_id) {
      const { error } = await (supabase as any).from("giveaways").update({
        winner_user_id: entry.user_id,
        winner_email: entry.user_email,
        winner_announced_at: new Date().toISOString(),
        status: "drawn",
      }).eq("id", entriesFor.id);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Winner crowned 🏆 — now deliver the prize");
    const crowned = {
      ...entriesFor,
      winner_user_id: entriesFor.winner_user_id || entry.user_id,
      winner_email: entriesFor.winner_email || entry.user_email,
      status: "drawn",
    } as Giveaway;
    setEntriesFor(null);
    fetchGiveaways();
    setTimeout(() => openDeliver(crowned, { user_id: entry.user_id, email: entry.user_email }), 300);
  };

  const openDeliver = (g: Giveaway, winner?: { user_id: string; email: string }) => {
    setDeliverFor(g);
    setDeliverWinner(winner || (g.winner_user_id && g.winner_email
      ? { user_id: g.winner_user_id, email: g.winner_email }
      : null));
    setDeliverTab('manual');
    setManualCode("");
    setRedeemInstructions("");
  };

  const handleDeliver = async () => {
    if (!deliverFor) return;
    if (!deliverWinner) { toast.error("No winner selected"); return; }
    if (deliverTab === 'manual' && manualCode.trim().length < 3) {
      toast.error("Please enter a valid game code");
      return;
    }
    if (deliverTab === 'kinguin') {
      if (!confirm("This will buy the prize from Kinguin (charges your account) and email the code to the winner. Continue?")) return;
    }
    setDelivering(true);
    try {
      const { data, error } = await supabase.functions.invoke('giveaway-deliver-prize', {
        body: {
          giveaway_id: deliverFor.id,
          source: deliverTab,
          manual_code: deliverTab === 'manual' ? manualCode.trim() : undefined,
          redeem_instructions: redeemInstructions.trim() || undefined,
          winner_user_id: deliverWinner.user_id,
          winner_email: deliverWinner.email,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success((data as any)?.message || "Prize delivered to winner!");
      await logAuditEvent({
        action_type: "update",
        entity_type: "giveaway",
        entity_id: deliverFor.id,
        entity_title: deliverFor.title,
        changes: { action: "deliver_prize", source: deliverTab, cost: (data as any)?.cost ?? null, winner: deliverWinner.email },
      });
      setDeliverFor(null);
      fetchGiveaways();
    } catch (e: any) {
      toast.error(e?.message || "Failed to deliver prize");
    }
    setDelivering(false);
  };

  const pickRandom = () => {
    if (entries.length === 0) { toast.error("No entries"); return; }
    // Weighted by entry_count
    const pool: Entry[] = [];
    entries.forEach(e => { for (let i = 0; i < (e.entry_count || 1); i++) pool.push(e); });
    const winner = pool[Math.floor(Math.random() * pool.length)];
    pickWinner(winner);
  };

  const endGiveaway = async (g: Giveaway) => {
    const winnerEmail = window.prompt(
      `End giveaway "${g.title}".\n\nOptional: enter a winner email to display (leave empty to end without a winner):`,
      ""
    );
    if (winnerEmail === null) return; // cancelled
    const trimmed = winnerEmail.trim();
    const update: Record<string, any> = { status: "ended" };
    if (trimmed) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        toast.error("Invalid email format");
        return;
      }
      update.winner_email = trimmed;
      update.winner_announced_at = new Date().toISOString();
    }
    const { error } = await (supabase as any).from("giveaways").update(update).eq("id", g.id);
    if (error) { toast.error(error.message); return; }
    await logAuditEvent({
      action_type: "update",
      entity_type: "giveaway",
      entity_id: g.id,
      entity_title: g.title,
      changes: { action: "end_giveaway", manual_winner_email: trimmed || null },
    });
    toast.success(trimmed ? `Ended — winner set to ${trimmed}` : "Giveaway ended");
    fetchGiveaways();
  };

  const deleteGiveaway = async (g: Giveaway) => {
    if (g.status === "active") {
      toast.error("Cannot delete an active giveaway. End it first.");
      return;
    }
    const typed = window.prompt(
      `⚠️ Permanently delete "${g.title}" and ALL its entries?\n\nType the giveaway title exactly to confirm:`
    );
    if (typed === null) return;
    if (typed.trim() !== g.title.trim()) {
      toast.error("Title did not match. Deletion cancelled.");
      return;
    }
    const { error } = await supabase.from("giveaways" as any).delete().eq("id", g.id);
    if (error) {
      toast.error(error.message);
    } else {
      await logAuditEvent({
        action_type: "delete",
        entity_type: "giveaway",
        entity_id: g.id,
        entity_title: g.title,
        changes: { status: g.status, ends_at: g.ends_at },
      });
      toast.success("Deleted");
      fetchGiveaways();
    }
  };

  const handleImageUpload = async (file: File, target: "create" | "edit") => {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploadingImage(target);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `giveaways/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      const url = data.publicUrl;
      if (target === "create") setForm((f) => ({ ...f, prize_image_url: url }));
      else setEditForm((f) => ({ ...f, prize_image_url: url }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploadingImage(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" /> Giveaways
          </h1>
          <p className="text-sm text-muted-foreground">Run free game key giveaways every 4 days.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Giveaway
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><AgeversLoader /></div>
      ) : giveaways.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No giveaways yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {giveaways.map(g => (
            <div key={g.id} className="glass rounded-xl p-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-foreground">{g.title}</h3>
                  <Badge variant={g.status === "active" ? "default" : g.status === "drawn" ? "secondary" : "outline"}>
                    {g.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Ends {fmt(g.ends_at)}</span>
                  <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {(prizes[g.id]?.length ?? 0)} / {g.prize_count ?? 1} prizes delivered</span>
                  <span className="flex items-center gap-1" title="Real users (exist in profiles) vs manually-added fake entries">
                    <Users className="h-3 w-3" />
                    <span className="text-emerald-400 font-semibold">{realCounts[g.id]?.real ?? 0} real</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-amber-400">{realCounts[g.id]?.fake ?? 0} fake</span>
                  </span>
                  {g.winner_email && <span className="flex items-center gap-1 text-primary"><Trophy className="h-3 w-3" /> {g.winner_email}</span>}
                </div>
                {(prizes[g.id]?.length ?? 0) > 0 && (
                  <div className="mt-2 space-y-1">
                    {prizes[g.id].map((p, idx) => (
                      <div key={p.id} className="flex items-center gap-2 flex-wrap text-xs">
                        <Badge variant="outline" className="shrink-0">#{idx + 1}</Badge>
                        <span className="text-muted-foreground">{p.winner_email}</span>
                        <code className="font-mono bg-secondary/60 border border-border/50 rounded px-2 py-0.5 break-all max-w-full">
                          {p.game_code}
                        </code>
                        {p.email_status === 'sent' && (
                          <span className="flex items-center gap-1 text-emerald-500">
                            <CheckCircle2 className="h-3 w-3" /> sent
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={() => {
                            navigator.clipboard.writeText(p.game_code);
                            toast.success("Code copied");
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5" title="Cosmetic boost added to the publicly-displayed entry count. Unrelated to the real/fake entries on the left — those are actual rows in the entries table.">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    min={0}
                    defaultValue={g.fake_entries_boost ?? 0}
                    className="h-8 w-20 text-xs"
                    onBlur={async (e) => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      if (val === (g.fake_entries_boost ?? 0)) return;
                      const { error } = await (supabase as any)
                        .from("giveaways")
                        .update({ fake_entries_boost: val })
                        .eq("id", g.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success(`Display boost set to +${val}`);
                        fetchGiveaways();
                      }
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">boost</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => openEntries(g)} className="gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Entries
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(g)} className="gap-1.5" title="Edit giveaway">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {g.winner_user_id && (prizes[g.id]?.length ?? 0) < (g.prize_count ?? 1) && (
                  <Button size="sm" variant="default" onClick={() => openDeliver(g)} className="gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    Deliver ({(prizes[g.id]?.length ?? 0)}/{g.prize_count ?? 1})
                  </Button>
                )}
                {g.status === "active" && (
                  <Button size="sm" variant="ghost" onClick={() => endGiveaway(g)}>End</Button>
                )}
                {g.status !== "active" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteGiveaway(g)}
                    className="text-destructive"
                    title="Delete giveaway"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Giveaway</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Win a Free Cyberpunk 2077 Key" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short description of the prize" rows={3} />
            </div>
            <div>
              <Label>Duration (days)</Label>
              <Input type="number" min={1} max={30} value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) || 4 })} />
            </div>
            <div>
              <Label>Number of prizes / winners</Label>
              <Input type="number" min={1} max={50} value={form.prize_count}
                onChange={(e) => setForm({ ...form, prize_count: Number(e.target.value) || 1 })} />
              <p className="text-xs text-muted-foreground mt-1">
                How many game codes to give out. Each prize can go to a different winner (or the same person).
              </p>
            </div>
            <div>
              <Label>Custom Prize Image URL (optional — overrides product image)</Label>
              <div className="flex gap-2">
                <Input value={form.prize_image_url} onChange={(e) => setForm({ ...form, prize_image_url: e.target.value })}
                  placeholder="https://... or upload below" className="flex-1" />
                <Button type="button" variant="outline" size="sm" disabled={uploadingImage === "create"}
                  onClick={() => document.getElementById("giveaway-img-create")?.click()} className="gap-1 shrink-0">
                  <Upload className="h-4 w-4" />
                  {uploadingImage === "create" ? "Uploading…" : "Upload"}
                </Button>
                <input id="giveaway-img-create" type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "create"); e.target.value = ""; }} />
              </div>
              {form.prize_image_url && (
                <div className="mt-2 relative inline-block">
                  <img src={form.prize_image_url} alt="Preview" className="h-24 w-24 object-cover rounded-lg border border-border/50" />
                  <button type="button" onClick={() => setForm({ ...form, prize_image_url: "" })}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <div>
              <Label>Linked Product (the prize)</Label>
              <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products..." className="mb-2" />
              <div className="max-h-48 overflow-y-auto border border-border/50 rounded-lg">
                {products.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => setForm({ ...form, allowed_product_id: p.id })}
                    className={`w-full flex items-center gap-2 p-2 text-left text-sm hover:bg-secondary/50 ${form.allowed_product_id === p.id ? "bg-primary/10" : ""}`}>
                    {p.image_url && <img src={p.image_url} alt="" className="h-8 w-8 object-cover rounded" />}
                    <span className="truncate">{p.title}</span>
                    {p.kinguin_price != null ? (
                      <span className="ml-auto shrink-0 text-xs font-medium text-emerald-400 whitespace-nowrap">
                        Cost: €{p.kinguin_price.toFixed(2)}
                      </span>
                    ) : (
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                        No Kinguin offer
                      </span>
                    )}
                    {form.allowed_product_id === p.id && <Badge className="ml-auto">Selected</Badge>}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating…" : "Create Giveaway"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editFor} onOpenChange={(o) => !o && setEditFor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Giveaway
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ends at</Label>
                <Input type="datetime-local" value={editForm.ends_at}
                  onChange={(e) => setEditForm({ ...editForm, ends_at: e.target.value })} />
              </div>
              <div>
                <Label>Number of prizes</Label>
                <Input type="number" min={1} max={50} value={editForm.prize_count}
                  onChange={(e) => setEditForm({ ...editForm, prize_count: Number(e.target.value) || 1 })} />
                {editFor && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {(prizes[editFor.id]?.length ?? 0)} already delivered — cannot reduce below that.
                  </p>
                )}
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <Crown className="h-4 w-4 text-yellow-500" /> Predetermined Winner (optional)
              </Label>
              <Input
                type="email"
                value={editForm.predetermined_winner_email}
                onChange={(e) => setEditForm({ ...editForm, predetermined_winner_email: e.target.value })}
                placeholder="user@example.com"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                If set, when the giveaway auto-finalizes this email will be chosen as the winner (must exist in entries).
              </p>
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <Crown className="h-4 w-4 text-purple-400" /> Seeded Fake Winners (optional)
              </Label>
              <Textarea
                value={editForm.seeded_winners_text}
                onChange={(e) => setEditForm({ ...editForm, seeded_winners_text: e.target.value })}
                placeholder={"one per line: email[:entries[:bonus]]\ngamer1@gmail.com:30:5\ngamer2@outlook.com:20"}
                rows={4}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                On auto-finalize these are added as fake entries and crowned as prize winners — no Kinguin purchase and no emails are sent to them. Format per line: email, optionally followed by entry count and order bonus separated by colons.
              </p>
            </div>
            <div>
              <Label>Custom Prize Image URL (optional)</Label>
              <div className="flex gap-2">
                <Input value={editForm.prize_image_url} onChange={(e) => setEditForm({ ...editForm, prize_image_url: e.target.value })}
                  placeholder="https://... or upload below" className="flex-1" />
                <Button type="button" variant="outline" size="sm" disabled={uploadingImage === "edit"}
                  onClick={() => document.getElementById("giveaway-img-edit")?.click()} className="gap-1 shrink-0">
                  <Upload className="h-4 w-4" />
                  {uploadingImage === "edit" ? "Uploading…" : "Upload"}
                </Button>
                <input id="giveaway-img-edit" type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "edit"); e.target.value = ""; }} />
              </div>
              {editForm.prize_image_url && (
                <div className="mt-2 relative inline-block">
                  <img src={editForm.prize_image_url} alt="Preview" className="h-24 w-24 object-cover rounded-lg border border-border/50" />
                  <button type="button" onClick={() => setEditForm({ ...editForm, prize_image_url: "" })}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <div>
              <Label>Linked Product (the prize)</Label>
              <Input value={editProductSearch} onChange={(e) => setEditProductSearch(e.target.value)}
                placeholder="Search products..." className="mb-2" />
              <div className="max-h-48 overflow-y-auto border border-border/50 rounded-lg">
                <button type="button"
                  onClick={() => setEditForm({ ...editForm, allowed_product_id: "" })}
                  className={`w-full flex items-center gap-2 p-2 text-left text-sm hover:bg-secondary/50 ${!editForm.allowed_product_id ? "bg-primary/10" : ""}`}>
                  <span className="italic text-muted-foreground">No linked product</span>
                  {!editForm.allowed_product_id && <Badge className="ml-auto">Selected</Badge>}
                </button>
                {products.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => setEditForm({ ...editForm, allowed_product_id: p.id })}
                    className={`w-full flex items-center gap-2 p-2 text-left text-sm hover:bg-secondary/50 ${editForm.allowed_product_id === p.id ? "bg-primary/10" : ""}`}>
                    {p.image_url && <img src={p.image_url} alt="" className="h-8 w-8 object-cover rounded" />}
                    <span className="truncate">{p.title}</span>
                    {p.kinguin_price != null ? (
                      <span className="ml-auto shrink-0 text-xs font-medium text-emerald-400 whitespace-nowrap">
                        Cost: €{p.kinguin_price.toFixed(2)}
                      </span>
                    ) : (
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                        No Kinguin offer
                      </span>
                    )}
                    {editForm.allowed_product_id === p.id && <Badge className="ml-auto">Selected</Badge>}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditFor(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliver Prize dialog */}
      <Dialog open={!!deliverFor} onOpenChange={(o) => !o && setDeliverFor(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Deliver Prize — {deliverFor?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-secondary/40 rounded-lg p-3 text-sm flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <span>
                Sending to: <span className="font-mono font-bold text-foreground">{deliverWinner?.email || deliverFor?.winner_email}</span>
                {deliverFor && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (prize {(prizes[deliverFor.id]?.length ?? 0) + 1} of {deliverFor.prize_count ?? 1})
                  </span>
                )}
              </span>
            </div>

            <Tabs value={deliverTab} onValueChange={(v) => setDeliverTab(v as 'kinguin' | 'manual')}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="manual" className="gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" /> Enter code manually
                </TabsTrigger>
                <TabsTrigger value="kinguin" className="gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" /> Buy from Kinguin
                </TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-3 mt-4">
                <div>
                  <Label>Game code *</Label>
                  <Input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. ABCD-1234-EFGH-5678"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste the code you obtained from your own stock or another supplier.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="kinguin" className="space-y-3 mt-4">
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm">
                  The system will purchase the linked product directly from Kinguin and email
                  the key to the winner. Your Kinguin balance will be charged.
                </div>
              </TabsContent>
            </Tabs>

            <div>
              <Label>Custom redeem instructions (optional)</Label>
              <Textarea
                value={redeemInstructions}
                onChange={(e) => setRedeemInstructions(e.target.value)}
                placeholder="Leave blank to auto-generate based on the game's platform."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeliverFor(null)} disabled={delivering}>Cancel</Button>
            <Button onClick={handleDeliver} disabled={delivering} className="gap-2">
              <Send className="h-4 w-4" />
              {delivering ? "Delivering…" : "Send Prize to Winner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entries dialog */}
      <Dialog open={!!entriesFor} onOpenChange={(o) => !o && setEntriesFor(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Entries — {entriesFor?.title}</DialogTitle>
          </DialogHeader>
          {/* Add manual entry */}
          <div className="border border-border/50 rounded-lg p-3 bg-secondary/30 space-y-2">
            <p className="text-xs font-display font-bold uppercase tracking-wide text-muted-foreground">
              Add manual entry
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={newEntryEmail}
                  onChange={(e) => setNewEntryEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="h-9"
                />
              </div>
              <div className="w-24">
                <Label className="text-xs">Entries</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={newEntryCount}
                  onChange={(e) => setNewEntryCount(Number(e.target.value) || 1)}
                  className="h-9"
                />
              </div>
              <Button onClick={addManualEntry} disabled={addingEntry} size="sm" className="gap-1.5 h-9">
                <Plus className="h-3.5 w-3.5" />
                {addingEntry ? "Adding…" : "Add"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              If the email already exists in this giveaway, its entry count will be increased. Otherwise a new participant row is created.
            </p>
          </div>

          {loadingEntries ? (
            <div className="flex justify-center py-8"><AgeversLoader /></div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No entries yet.</p>
          ) : (
            <>
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm text-muted-foreground">
                  {entries.length} participants ·{" "}
                  <span className="text-emerald-400 font-semibold">
                    {entries.filter(e => realUserIds.has(e.user_id)).length} real
                  </span>{" "}
                  ·{" "}
                  <span className="text-amber-400">
                    {entries.filter(e => !realUserIds.has(e.user_id)).length} fake
                  </span>
                </p>
                {entriesFor?.status === "active" && (
                  <Button onClick={pickRandom} className="gap-2" size="sm">
                    <Trophy className="h-4 w-4" /> Pick Random Winner
                  </Button>
                )}
              </div>
              <div className="border border-border/50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="p-2 text-left text-xs uppercase">Email</th>
                      <th className="p-2 text-center text-xs uppercase">Entries</th>
                      <th className="p-2 text-center text-xs uppercase">Bonus</th>
                      <th className="p-2 text-left text-xs uppercase">Joined</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(e => (
                      <tr key={e.id} className="border-t border-border/30">
                        <td className="p-2 font-mono text-xs">
                          <div className="flex items-center gap-2">
                            <span>{e.user_email}</span>
                            {realUserIds.has(e.user_id) ? (
                              <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-400">REAL</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400">FAKE</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-center font-bold text-primary">{e.entry_count}</td>
                        <td className="p-2 text-center text-xs text-muted-foreground">+{e.bonus_from_orders}</td>
                        <td className="p-2 text-xs text-muted-foreground">{fmt(e.joined_at)}</td>
                        <td className="p-2 text-right">
                          {entriesFor?.status === "active" && (
                            <Button size="sm" variant="outline" onClick={() => pickWinner(e)} className="gap-1">
                              <Crown className="h-3 w-3" /> Crown
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGiveaways;