import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Users, Rocket, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";

interface CreatedSeller {
  email: string;
  display_name: string;
  products: number;
}

export const FakeSellerGenerator = () => {
  const [count, setCount] = useState(20);
  const [minStock, setMinStock] = useState(20);
  const [priceMarkup, setPriceMarkup] = useState(10);
  const [priceVariation, setPriceVariation] = useState(5);
  const [cleaning, setCleaning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    sellers: CreatedSeller[];
    errors?: string[];
  } | null>(null);

  const handleGenerate = async () => {
    setProcessing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: {
          action: "bulk_create_sellers",
          count,
          minStock,
          priceMarkup: priceMarkup / 100,
          priceVariation: priceVariation / 100,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast.success(`Created ${data.created} fake sellers`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create sellers");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Fake Seller Generator
        </h3>
        <p className="text-sm text-muted-foreground">
          Create simulated seller accounts with products priced above Official Store to create marketplace competition.
        </p>
      </div>

      {/* Configuration */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg border border-border bg-secondary/30">
        <div>
          <label className="text-xs text-muted-foreground font-body mb-1 block">Number of Sellers</label>
          <Input
            type="number"
            min={1}
            max={40}
            value={count}
            onChange={(e) => setCount(Math.min(40, Math.max(1, parseInt(e.target.value) || 1)))}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Max 40 per batch</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-body mb-1 block">Min Kinguin Stock</label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={minStock}
            onChange={(e) => setMinStock(parseInt(e.target.value) || 20)}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Only products with stock ≥ this</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-body mb-1 block">Price Markup %</label>
          <Input
            type="number"
            min={1}
            max={50}
            value={priceMarkup}
            onChange={(e) => setPriceMarkup(parseInt(e.target.value) || 10)}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Above Official Store price</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-body mb-1 block">Price Variation %</label>
          <Input
            type="number"
            min={0}
            max={20}
            value={priceVariation}
            onChange={(e) => setPriceVariation(parseInt(e.target.value) || 5)}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Random ± for realistic spread</p>
        </div>
      </div>

      {/* Preview */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-foreground">
        <p className="font-medium">Preview:</p>
        <p className="text-muted-foreground mt-1">
          {count} sellers → Only Kinguin products with stock ≥ {minStock} → Stock distributed randomly among sellers → Random sales history (50-2000 orders each)
        </p>
        <p className="text-muted-foreground">
          Prices ~{priceMarkup}% above Official Store (±{priceVariation}%). Example: €10.00 → €{(10 * (1 + (priceMarkup - priceVariation) / 100)).toFixed(2)} - €{(10 * (1 + (priceMarkup + priceVariation) / 100)).toFixed(2)}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleGenerate}
          disabled={processing || cleaning}
          className="gap-2"
          variant="hero"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating sellers... (this may take a minute)
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" />
              Generate {count} Sellers
            </>
          )}
        </Button>
        <Button
          onClick={async () => {
            if (!confirm("Delete ALL fake sellers, their products and orders?")) return;
            setCleaning(true);
            try {
              const { data, error } = await supabase.functions.invoke("admin-users", {
                body: { action: "cleanup_fake_sellers" },
              });
              if (error) throw new Error(error.message);
              if (data?.error) throw new Error(data.error);
              toast.success(`Deleted ${data.deleted} fake sellers`);
              setResult(null);
            } catch (err: any) {
              toast.error(err.message);
            } finally {
              setCleaning(false);
            }
          }}
          disabled={processing || cleaning}
          variant="destructive"
          className="gap-2"
        >
          {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {cleaning ? "Cleaning..." : "Delete All Fake Sellers"}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-neon-green">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Created {result.created} sellers successfully</span>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 space-y-1">
              <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                {result.errors.length} warnings
              </div>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-muted-foreground">{err}</p>
              ))}
            </div>
          )}

          <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium">Seller Name</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Email</th>
                  <th className="text-right p-2 text-muted-foreground font-medium">Products</th>
                </tr>
              </thead>
              <tbody>
                {result.sellers.map((s, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-2 font-medium text-foreground">{s.display_name}</td>
                    <td className="p-2 text-muted-foreground">{s.email}</td>
                    <td className="p-2 text-right text-foreground">{s.products}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
