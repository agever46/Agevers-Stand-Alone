import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save, Plus, Trash2, Calculator, CreditCard, Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePricingRules, PricingRule, PricingSettings } from "@/hooks/usePricingRules";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

interface PaymentProcessor {
  id: string;
  name: string;
  label: string;
  fee_pct: number;
  fee_fixed: number;
  is_active: boolean;
  display_order: number;
}

const AdminPricing = () => {
  const { rules, topupRules, settings, loading, fetchRules, calculate, calculateTopup } = usePricingRules();
  const [editRules, setEditRules] = useState<PricingRule[]>([]);
  const [editTopupRules, setEditTopupRules] = useState<PricingRule[]>([]);
  const [editSettings, setEditSettings] = useState<PricingSettings>({ fixed_fee: 0, platform_pct: 0 });
  const [saving, setSaving] = useState(false);
  const [savingTopup, setSavingTopup] = useState(false);
  const [processors, setProcessors] = useState<PaymentProcessor[]>([]);
  const [savingProcessors, setSavingProcessors] = useState(false);

  const fetchProcessors = async () => {
    const { data } = await supabase
      .from("payment_processors")
      .select("*")
      .order("display_order");
    if (data) setProcessors(data as any);
  };

  useEffect(() => {
    setEditRules(rules.map(r => ({ ...r })));
    setEditTopupRules(topupRules.map(r => ({ ...r })));
    setEditSettings({ ...settings });
  }, [rules, topupRules, settings]);

  useEffect(() => {
    fetchProcessors();
  }, []);

  const updateProcessor = (idx: number, field: keyof PaymentProcessor, value: any) => {
    setProcessors(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addProcessor = () => {
    const maxOrder = processors.reduce((m, p) => Math.max(m, p.display_order), 0);
    setProcessors(prev => [...prev, {
      id: crypto.randomUUID(),
      name: "",
      label: "",
      fee_pct: 0,
      fee_fixed: 0,
      is_active: true,
      display_order: maxOrder + 1,
    }]);
  };

  const removeProcessor = (idx: number) => {
    const proc = processors[idx];
    setProcessors(prev => prev.filter((_, i) => i !== idx));
    if (proc.id) {
      supabase.from("payment_processors").delete().eq("id", proc.id);
    }
  };

  const saveProcessors = async () => {
    setSavingProcessors(true);
    try {
      for (const p of processors) {
        if (!p.name || !p.label) continue;
        const row = {
          name: p.name.toLowerCase().replace(/\s+/g, '_'),
          label: p.label,
          fee_pct: p.fee_pct,
          fee_fixed: p.fee_fixed,
          is_active: p.is_active,
          display_order: p.display_order,
        };
        const { error } = await supabase.from("payment_processors").upsert({ id: p.id, ...row } as any);
        if (error) throw error;
      }
      toast.success("Payment processors saved!");
      fetchProcessors();
    } catch (err: any) {
      toast.error("Failed to save processors: " + err.message);
    }
    setSavingProcessors(false);
  };

  const updateRule = (idx: number, field: keyof PricingRule, value: string) => {
    setEditRules(prev => {
      const next = [...prev];
      if (field === "max_cost") next[idx] = { ...next[idx], max_cost: parseFloat(value) || 0 };
      if (field === "margin_pct") next[idx] = { ...next[idx], margin_pct: (parseFloat(value) || 0) / 100 };
      return next;
    });
  };

  const addTier = () => {
    const maxOrder = editRules.reduce((m, r) => Math.max(m, r.tier_order), 0);
    setEditRules(prev => [...prev, { id: crypto.randomUUID(), tier_order: maxOrder + 1, max_cost: 0, margin_pct: 0.05 }]);
  };

  const removeTier = (idx: number) => {
    if (editRules.length <= 1) return;
    setEditRules(prev => prev.filter((_, i) => i !== idx));
  };

  // Topup tier functions
  const updateTopupRule = (idx: number, field: keyof PricingRule, value: string) => {
    setEditTopupRules(prev => {
      const next = [...prev];
      if (field === "max_cost") next[idx] = { ...next[idx], max_cost: parseFloat(value) || 0 };
      if (field === "margin_pct") next[idx] = { ...next[idx], margin_pct: (parseFloat(value) || 0) / 100 };
      return next;
    });
  };

  const addTopupTier = () => {
    const maxOrder = editTopupRules.reduce((m, r) => Math.max(m, r.tier_order), 0);
    setEditTopupRules(prev => [...prev, { id: crypto.randomUUID(), tier_order: maxOrder + 1, max_cost: 0, margin_pct: 0.05 }]);
  };

  const removeTopupTier = (idx: number) => {
    if (editTopupRules.length <= 1) return;
    setEditTopupRules(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from("pricing_rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      const inserts = editRules.map((r, i) => ({
        tier_order: i + 1,
        max_cost: r.max_cost,
        margin_pct: r.margin_pct,
      }));
      const { error: rulesErr } = await supabase.from("pricing_rules").insert(inserts as any);
      if (rulesErr) throw rulesErr;

      const { error: settingsErr } = await supabase.from("pricing_settings").update({
        fixed_fee: editSettings.fixed_fee,
        platform_pct: editSettings.platform_pct,
      } as any).eq("id", 1);
      if (settingsErr) throw settingsErr;

      toast.success("Pricing rules saved! Display prices will update automatically.");
      fetchRules();
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  const handleSaveTopup = async () => {
    setSavingTopup(true);
    try {
      await supabase.from("pricing_rules_topups" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      const inserts = editTopupRules.map((r, i) => ({
        tier_order: i + 1,
        max_cost: r.max_cost,
        margin_pct: r.margin_pct,
      }));
      const { error } = await supabase.from("pricing_rules_topups" as any).insert(inserts as any);
      if (error) throw error;

      toast.success("Top Ups pricing saved! Prices will update automatically.");
      fetchRules();
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    }
    setSavingTopup(false);
  };

  const EXAMPLE_COSTS = [1, 2, 5, 10, 15, 25, 50, 75, 100, 150, 250, 500];

  const fmt = (n: number) => `€${n.toFixed(2)}`;

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading pricing rules...</div>;

  return (
    <div className="space-y-6">
      {/* Margin Tiers */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Margin Tiers
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addTier} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Tier
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {editRules.map((rule, idx) => (
              <div key={rule.id} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-20 shrink-0">
                  {idx === 0 ? "€0" : `€${editRules[idx - 1]?.max_cost || 0}`} – €
                </span>
                <Input
                  type="number"
                  step="1"
                  value={rule.max_cost}
                  onChange={(e) => updateRule(idx, "max_cost", e.target.value)}
                  className="h-8 w-24"
                  placeholder="Max cost"
                />
                <span className="text-xs text-muted-foreground">Margin:</span>
                <Input
                  type="number"
                  step="0.5"
                  value={(rule.margin_pct * 100).toFixed(1)}
                  onChange={(e) => updateRule(idx, "margin_pct", e.target.value)}
                  className="h-8 w-20"
                />
                <span className="text-xs text-muted-foreground">%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeTier(idx)}
                  disabled={editRules.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={saving} className="gap-2">
        <Save className="h-4 w-4" />
        {saving ? "Saving..." : "Save Pricing Rules"}
      </Button>

      {/* Top Ups & Gift Cards Margin Tiers */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Top Ups & Gift Cards Margin Tiers
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addTopupTier} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Tier
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Separate margins for products with store "Top Ups" or tab_category "topups"</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {editTopupRules.map((rule, idx) => (
              <div key={rule.id} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-20 shrink-0">
                  {idx === 0 ? "€0" : `€${editTopupRules[idx - 1]?.max_cost || 0}`} – €
                </span>
                <Input
                  type="number"
                  step="1"
                  value={rule.max_cost}
                  onChange={(e) => updateTopupRule(idx, "max_cost", e.target.value)}
                  className="h-8 w-24"
                  placeholder="Max cost"
                />
                <span className="text-xs text-muted-foreground">Margin:</span>
                <Input
                  type="number"
                  step="0.5"
                  value={(rule.margin_pct * 100).toFixed(1)}
                  onChange={(e) => updateTopupRule(idx, "margin_pct", e.target.value)}
                  className="h-8 w-20"
                />
                <span className="text-xs text-muted-foreground">%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeTopupTier(idx)}
                  disabled={editTopupRules.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Topup Button */}
      <Button onClick={handleSaveTopup} disabled={savingTopup} className="gap-2">
        <Save className="h-4 w-4" />
        {savingTopup ? "Saving..." : "Save Top Ups Pricing"}
      </Button>

      {/* Payment Processors */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Payment Processor Fees
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addProcessor} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Processor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_1fr_100px_100px_60px_40px] gap-2 text-xs text-muted-foreground font-medium px-1">
              <span>Name (ID)</span>
              <span>Label</span>
              <span>Fee %</span>
              <span>Fixed €</span>
              <span>Active</span>
              <span></span>
            </div>
            {processors.map((proc, idx) => (
              <div key={proc.id} className="grid grid-cols-[1fr_1fr_100px_100px_60px_40px] gap-2 items-center">
                <Input
                  value={proc.name}
                  onChange={(e) => updateProcessor(idx, "name", e.target.value)}
                  className="h-8 text-sm"
                  placeholder="paypal"
                />
                <Input
                  value={proc.label}
                  onChange={(e) => updateProcessor(idx, "label", e.target.value)}
                  className="h-8 text-sm"
                  placeholder="PayPal"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={proc.fee_pct}
                  onChange={(e) => updateProcessor(idx, "fee_pct", parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={proc.fee_fixed}
                  onChange={(e) => updateProcessor(idx, "fee_fixed", parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
                <Switch
                  checked={proc.is_active}
                  onCheckedChange={(v) => updateProcessor(idx, "is_active", v)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeProcessor(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {processors.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No payment processors configured</p>
            )}
          </div>
          <Button onClick={saveProcessors} disabled={savingProcessors} className="gap-2 mt-4" size="sm">
            <Save className="h-4 w-4" />
            {savingProcessors ? "Saving..." : "Save Processors"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Table - Regular */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Price Preview — Regular Products</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Cost</TableHead>
                <TableHead className="text-xs">Margin</TableHead>
                <TableHead className="text-xs">Sell Price</TableHead>
                <TableHead className="text-xs">Profit €</TableHead>
                <TableHead className="text-xs">Profit %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EXAMPLE_COSTS.map((cost) => {
                const row = calculate(cost);
                return (
                  <TableRow key={cost}>
                    <TableCell className="font-semibold">{fmt(cost)}</TableCell>
                    <TableCell className="text-primary">{row.marginTier}</TableCell>
                    <TableCell className="font-bold">{fmt(row.finalPrice)}</TableCell>
                    <TableCell className="text-primary font-semibold">{fmt(row.netProfit)}</TableCell>
                    <TableCell className="text-primary">{row.netProfitPct.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview Table - Top Ups */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Price Preview — Top Ups & Gift Cards
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Cost</TableHead>
                <TableHead className="text-xs">Margin</TableHead>
                <TableHead className="text-xs">Sell Price</TableHead>
                <TableHead className="text-xs">Profit €</TableHead>
                <TableHead className="text-xs">Profit %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {EXAMPLE_COSTS.map((cost) => {
                const row = calculateTopup(cost);
                return (
                  <TableRow key={cost}>
                    <TableCell className="font-semibold">{fmt(cost)}</TableCell>
                    <TableCell className="text-primary">{row.marginTier}</TableCell>
                    <TableCell className="font-bold">{fmt(row.finalPrice)}</TableCell>
                    <TableCell className="text-primary font-semibold">{fmt(row.netProfit)}</TableCell>
                    <TableCell className="text-primary">{row.netProfitPct.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPricing;
