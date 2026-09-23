import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, TrendingUp, DollarSign } from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePricingRules } from "@/hooks/usePricingRules";

const EXAMPLE_COSTS = [1, 2, 5, 10, 15, 25, 50, 75, 100, 150, 250, 500];

const PricingCalculator = () => {
  const [customCost, setCustomCost] = useState("");
  const { rules, settings, loading, calculate } = usePricingRules();

  const tableData = useMemo(() => EXAMPLE_COSTS.map(calculate), [calculate]);
  const customResult = useMemo(() => {
    const val = parseFloat(customCost);
    return val > 0 ? calculate(val) : null;
  }, [customCost, calculate]);

  const fmt = (n: number) => `€${n.toFixed(2)}`;

  return (
    <div className="min-h-screen bg-[#0a0a1a]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-wider text-white flex items-center justify-center gap-3">
            <Calculator className="h-8 w-8 text-purple-400" />
            Pricing Calculator
          </h1>
          <p className="text-sm text-gray-400">Digital Products · Game Codes · Subscriptions</p>
        </div>

        {/* Margin tiers from DB */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {rules.sort((a, b) => a.tier_order - b.tier_order).map((rule, idx) => {
            const colors = [
              "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30",
              "from-blue-500/20 to-blue-600/5 border-blue-500/30",
              "from-purple-500/20 to-purple-600/5 border-purple-500/30",
              "from-amber-500/20 to-amber-600/5 border-amber-500/30",
            ];
            const prevMax = idx > 0 ? rules[idx - 1].max_cost : 0;
            const range = rule.max_cost >= 99999 ? `€${prevMax}+` : `€${prevMax} – €${rule.max_cost}`;
            return (
              <div key={rule.id} className={`rounded-lg border bg-gradient-to-br ${colors[idx % colors.length]} p-3 text-center`}>
                <p className="text-xs text-gray-400">{range}</p>
                <p className="text-xl font-black text-white">{(rule.margin_pct * 100).toFixed(0)}%</p>
              </div>
            );
          })}
        </div>

        {/* Quick Calculator */}
        <Card className="bg-[#12122a] border-purple-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-400" />
              Quick Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 whitespace-nowrap">Cost Price (€):</span>
              <Input
                type="number" min="0" step="0.01" placeholder="Enter cost..."
                value={customCost} onChange={(e) => setCustomCost(e.target.value)}
                className="max-w-[200px] bg-[#1a1a3a] border-purple-500/30 text-white"
              />
            </div>
            {customResult && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ResultCard label="Selling Price" value={fmt(customResult.finalPrice)} color="text-white" />
                <ResultCard label="Platform Fees" value={fmt(customResult.platformFees)} color="text-red-400" />
                <ResultCard label="Net Profit" value={fmt(customResult.netProfit)} color="text-emerald-400" />
                <ResultCard label="Profit %" value={`${customResult.netProfitPct.toFixed(1)}%`} color="text-emerald-400" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-[#12122a] border-purple-500/30 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-400" />
              Price Points Table
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-purple-500/20 hover:bg-transparent">
                    <TableHead className="text-gray-400 text-xs">Cost</TableHead>
                    <TableHead className="text-gray-400 text-xs">Margin Tier</TableHead>
                    <TableHead className="text-gray-400 text-xs">Platform Fees</TableHead>
                    <TableHead className="text-gray-400 text-xs">Selling Price</TableHead>
                    <TableHead className="text-gray-400 text-xs">Net Profit (€)</TableHead>
                    <TableHead className="text-gray-400 text-xs">Net Profit (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row) => (
                    <TableRow key={row.cost} className="border-purple-500/10 hover:bg-purple-500/5">
                      <TableCell className="text-white font-semibold">{fmt(row.cost)}</TableCell>
                      <TableCell className="text-purple-300 text-sm">{row.marginTier}</TableCell>
                      <TableCell className="text-red-400 text-sm">{fmt(row.platformFees)}</TableCell>
                      <TableCell className="text-white font-bold text-base">{fmt(row.finalPrice)}</TableCell>
                      <TableCell className="text-emerald-400 font-semibold">{fmt(row.netProfit)}</TableCell>
                      <TableCell className="text-emerald-400 font-semibold">{row.netProfitPct.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500">
          Prices rounded to the nearest cent
        </p>
      </div>
    </div>
  );
};

const ResultCard = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="rounded-lg bg-[#1a1a3a] border border-purple-500/20 p-3 text-center">
    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
    <p className={`text-lg font-black ${color}`}>{value}</p>
  </div>
);

export default PricingCalculator;
