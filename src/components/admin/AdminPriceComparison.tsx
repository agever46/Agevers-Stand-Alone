import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Calculator,
  Check,
} from "lucide-react";
import { usePricingRules } from "@/hooks/usePricingRules";
import { kinguinBuyPrice } from "@/lib/kinguinMarkup";

interface GGPriceData {
  lowestKeyshop: number | null;
  lowestRetail: number | null;
  historicalLow: number | null;
  currency: string;
  keyshopName: string | null;
  retailName: string | null;
}

interface ProductWithPrices {
  id: string;
  title: string;
  platform: string;
  store: string;
  image_url: string | null;
  kinguin_price: number | null;
  sell_price: number | null;
  gg_loading: boolean;
  gg_found: boolean | null;
  gg_prices: GGPriceData | null;
  gg_url: string | null;
  suggested_sell: number | null;
  gg_product_type: string | null;
  gg_match_confidence: string | null;
  gg_type_mismatch: string | null;
  gg_page_title: string | null;
}

const AdminPriceComparison = () => {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductWithPrices[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ done: 0, total: 0 });
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const { calculate, loading: rulesLoading } = usePricingRules();

  const searchProducts = async () => {
    if (search.trim().length < 2) {
      toast.error("Enter at least 2 characters to search");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("allowed_products")
        .select("id, title, platform, store, image_url")
        .ilike("title", `%${search.trim()}%`)
        .order("title")
        .limit(30);

      if (error) throw error;

      const ids = (data || []).map((p: any) => p.id);
      const { data: kpData } = await supabase
        .from("kinguin_products")
        .select("allowed_product_id, kinguin_price, sell_price")
        .in("allowed_product_id", ids);

      const kpMap: Record<string, { kinguin_price: number | null; sell_price: number }> = {};
      (kpData || []).forEach((k: any) => {
        kpMap[k.allowed_product_id] = {
          kinguin_price: k.kinguin_price,
          sell_price: k.sell_price,
        };
      });

      const mapped: ProductWithPrices[] = (data || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        platform: p.platform,
        store: p.store,
        image_url: p.image_url,
        kinguin_price: kpMap[p.id]?.kinguin_price ?? null,
        sell_price: kpMap[p.id]?.sell_price ?? null,
        gg_loading: false,
        gg_found: null,
        gg_prices: null,
        gg_url: null,
        suggested_sell: null,
        gg_product_type: null,
        gg_match_confidence: null,
        gg_type_mismatch: null,
        gg_page_title: null,
      }));

      setProducts(mapped);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const fetchGGPrice = async (product: ProductWithPrices) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, gg_loading: true } : p))
    );

    try {
      const { data, error } = await supabase.functions.invoke("ggdeals-scrape", {
        body: { title: product.title, platform: product.platform, store: product.store },
      });

      if (error) throw error;

      const ggPrices: GGPriceData | null = data?.found ? data.prices : null;
      const lowestCost = ggPrices?.lowestKeyshop ?? null;
      let suggestedSell: number | null = null;

      if (lowestCost !== null && !rulesLoading) {
        const calc = calculate(lowestCost);
        suggestedSell = calc.finalPrice;
      }

      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? {
                ...p,
                gg_loading: false,
                gg_found: data?.found ?? false,
                gg_prices: ggPrices,
                gg_url: data?.url ?? null,
                suggested_sell: suggestedSell,
                gg_product_type: data?.productType ?? null,
                gg_match_confidence: data?.matchConfidence ?? null,
                gg_type_mismatch: data?.typeMismatchWarning ?? null,
                gg_page_title: data?.pageProductTitle ?? null,
              }
            : p
        )
      );
    } catch (err: any) {
      console.error("GG fetch error:", err);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, gg_loading: false, gg_found: false } : p
        )
      );
    }
  };

  const fetchAllPrices = async () => {
    setFetchingAll(true);
    const unfetched = products.filter((p) => p.gg_found === null);
    setFetchProgress({ done: 0, total: unfetched.length });

    for (let i = 0; i < unfetched.length; i++) {
      await fetchGGPrice(unfetched[i]);
      setFetchProgress({ done: i + 1, total: unfetched.length });
      // Rate limit: Firecrawl has limits, wait between requests
      if (i < unfetched.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    setFetchingAll(false);
    toast.success(`Fetched prices for ${unfetched.length} products`);
  };

  const applyRecommendedPrice = async (product: ProductWithPrices) => {
    if (!product.suggested_sell) return;
    setApplyingId(product.id);
    try {
      const { error } = await supabase
        .from("kinguin_products")
        .update({ sell_price: product.suggested_sell } as any)
        .eq("allowed_product_id", product.id);
      if (error) throw error;

      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, sell_price: product.suggested_sell } : p
        )
      );
      toast.success(`Price updated to €${product.suggested_sell!.toFixed(2)}`);
    } catch (err: any) {
      toast.error("Error updating: " + err.message);
    }
    setApplyingId(null);
  };

  const getPriceComparison = (p: ProductWithPrices) => {
    if (!p.kinguin_price || !p.gg_prices?.lowestKeyshop) return null;
    const ggPrice = p.gg_prices.lowestKeyshop;
    const actualCost = kinguinBuyPrice(p.kinguin_price);
    const diff = actualCost - ggPrice;
    const pct = ((diff / actualCost) * 100).toFixed(1);
    return { diff, pct, cheaper: diff > 0 ? "gg" : "kinguin", ggPrice };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            Price Comparison — All Platforms
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Search products, compare prices from AllKeyShop across all platforms (via Firecrawl)
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchAllPrices}
          disabled={fetchingAll || products.length === 0}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${fetchingAll ? "animate-spin" : ""}`} />
          {fetchingAll
            ? `Fetching ${fetchProgress.done}/${fetchProgress.total}...`
            : "Fetch All Prices"}
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchProducts()}
            placeholder="Search products by title..."
            className="pl-9"
          />
        </div>
        <Button onClick={searchProducts} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {/* Progress */}
      {fetchingAll && (
        <div className="text-xs px-3 py-2 rounded-md bg-secondary border border-border text-muted-foreground">
          ⏳ Fetching prices: {fetchProgress.done}/{fetchProgress.total} (be patient, scraping takes time)
        </div>
      )}

      {/* Results */}
      {products.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 border-b border-border">
                   <th className="text-left px-3 py-2 font-display text-xs text-muted-foreground">
                     Product
                   </th>
                   <th className="text-center px-3 py-2 font-display text-xs text-muted-foreground w-20">
                     Type
                   </th>
                  <th className="text-center px-3 py-2 font-display text-xs text-muted-foreground">
                    Kinguin Buy
                  </th>
                  <th className="text-center px-3 py-2 font-display text-xs text-muted-foreground">
                    GG Keyshops
                  </th>
                  <th className="text-center px-3 py-2 font-display text-xs text-muted-foreground">
                    GG Retail
                  </th>
                  <th className="text-center px-3 py-2 font-display text-xs text-muted-foreground">
                    Difference
                  </th>
                  <th className="text-center px-3 py-2 font-display text-xs text-muted-foreground">
                    <Calculator className="h-3.5 w-3.5 inline mr-1" />
                    Store Price
                  </th>
                  <th className="text-center px-3 py-2 font-display text-xs text-muted-foreground w-16">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const comp = getPriceComparison(p);
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${
                        comp?.cheaper === "gg" ? "bg-emerald-500/5" : ""
                      }`}
                    >
                      {/* Product */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {p.image_url && (
                            <img
                              src={p.image_url}
                              alt=""
                              className="w-8 h-8 rounded object-cover"
                            />
                          )}
                          <div>
                            <div className="font-medium text-xs text-foreground truncate max-w-[220px]">
                              {p.title}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {p.platform} · {p.store}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Product Type + Confidence */}
                      <td className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          {p.gg_product_type ? (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              p.gg_product_type === "game" ? "bg-primary/20 text-primary" :
                              p.gg_product_type === "dlc" ? "bg-violet-500/20 text-violet-400" :
                              p.gg_product_type === "edition" ? "bg-amber-500/20 text-amber-400" :
                              p.gg_product_type === "currency" ? "bg-cyan-500/20 text-cyan-400" :
                              p.gg_product_type === "in-game-item" ? "bg-pink-500/20 text-pink-400" :
                              p.gg_product_type === "gift-card" ? "bg-emerald-500/20 text-emerald-400" :
                              p.gg_product_type === "bundle" ? "bg-orange-500/20 text-orange-400" :
                              p.gg_product_type === "subscription" ? "bg-blue-500/20 text-blue-400" :
                              "bg-secondary text-muted-foreground"
                            }`}>
                              {p.gg_product_type.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {p.gg_match_confidence && (
                            <span className={`text-[9px] ${
                              p.gg_match_confidence === "high" ? "text-emerald-400" :
                              p.gg_match_confidence === "medium" ? "text-amber-400" :
                              "text-destructive"
                            }`}>
                              {p.gg_match_confidence === "high" ? "✓" : p.gg_match_confidence === "medium" ? "~" : "⚠"} {p.gg_match_confidence}
                            </span>
                          )}
                          {p.gg_type_mismatch && (
                            <span className="text-[9px] text-destructive" title={p.gg_type_mismatch}>⚠ mismatch</span>
                          )}
                        </div>
                      </td>

                      {/* Kinguin Price */}
                      <td className="px-3 py-2 text-center">
                        {p.kinguin_price != null ? (
                          <span className="text-xs font-mono text-foreground">
                            €{kinguinBuyPrice(p.kinguin_price).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* GG Keyshops */}
                      <td className="px-3 py-2 text-center">
                        {p.gg_loading ? (
                          <Loader2 className="h-3 w-3 animate-spin mx-auto text-muted-foreground" />
                        ) : p.gg_prices?.lowestKeyshop != null ? (
                          <span className="text-xs font-mono text-foreground">
                            €{p.gg_prices.lowestKeyshop.toFixed(2)}
                          </span>
                        ) : p.gg_found === false ? (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* GG Retail */}
                      <td className="px-3 py-2 text-center">
                        {p.gg_prices?.lowestRetail != null ? (
                          <span className="text-xs font-mono text-muted-foreground">
                            €{p.gg_prices.lowestRetail.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Difference */}
                      <td className="px-3 py-2 text-center">
                        {comp ? (
                          <div className="flex items-center justify-center gap-1">
                            {comp.cheaper === "gg" ? (
                              <TrendingDown className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <TrendingUp className="h-3 w-3 text-destructive" />
                            )}
                            <span
                              className={`text-xs font-mono font-bold ${
                                comp.cheaper === "gg"
                                  ? "text-emerald-400"
                                  : "text-destructive"
                              }`}
                            >
                              {comp.cheaper === "gg" ? "-" : "+"}€
                              {Math.abs(comp.diff).toFixed(2)} (
                              {Math.abs(parseFloat(comp.pct))}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Suggested Store Price */}
                      <td className="px-3 py-2 text-center">
                        {p.suggested_sell != null ? (
                          <span className="text-xs font-mono font-bold text-primary">
                            €{p.suggested_sell.toFixed(2)}
                          </span>
                        ) : p.gg_prices?.lowestKeyshop != null ? (
                          <span className="text-xs text-muted-foreground">calc...</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {p.gg_found === null && !p.gg_loading && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => fetchGGPrice(p)}
                              disabled={fetchingAll}
                            >
                              <Search className="h-3 w-3" />
                            </Button>
                          )}
                          {p.suggested_sell != null && p.sell_price !== p.suggested_sell && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() => applyRecommendedPrice(p)}
                              disabled={applyingId === p.id}
                              title={`Apply €${p.suggested_sell.toFixed(2)}`}
                            >
                              {applyingId === p.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              Apply
                            </Button>
                          )}
                          {p.suggested_sell != null && p.sell_price === p.suggested_sell && (
                            <span className="text-[10px] text-emerald-400 font-bold">✓ Applied</span>
                          )}
                          {p.gg_url && (
                            <a
                              href={p.gg_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          {products.some((p) => p.gg_prices) && (
            <div className="px-3 py-2 bg-secondary/30 border-t border-border text-xs text-muted-foreground flex gap-4 flex-wrap">
              <span>
                🟢 GG cheaper:{" "}
                <strong>
                  {products.filter((p) => getPriceComparison(p)?.cheaper === "gg").length}
                </strong>
              </span>
              <span>
                🔴 Kinguin cheaper:{" "}
                <strong>
                  {products.filter((p) => getPriceComparison(p)?.cheaper === "kinguin").length}
                </strong>
              </span>
              <span>
                ⚪ No data:{" "}
                <strong>
                  {products.filter((p) => !getPriceComparison(p)).length}
                </strong>
              </span>
            </div>
          )}
        </div>
      )}

      {products.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Search a product to compare prices across all platforms</p>
        </div>
      )}
    </div>
  );
};

export default AdminPriceComparison;
