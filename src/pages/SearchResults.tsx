import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GameCard from "@/components/GameCard";
import ProductFilters, { SortOption, AdditionalFilters, EMPTY_ADDITIONAL_FILTERS, applyAdditionalFilters } from "@/components/ProductFilters";
import { GameCardSkeletonGrid } from "@/components/GameCardSkeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CheckSquare, Pencil } from "lucide-react";
import { usePricingRules } from "@/hooks/usePricingRules";
import { kinguinBuyPrice } from "@/lib/kinguinMarkup";
import { useAuth } from "@/hooks/useAuth";
import AdminProductEditModal from "@/components/admin/AdminProductEditModal";
import { useCart } from "@/hooks/useCart";
import { useFlyToCart, FlyToCartOverlay } from "@/components/FlyToCart";
import game1 from "@/assets/game1.jpg";
import { useGameGroupMap, collapseByGameGroup } from "@/hooks/useGameGroupMap";
import { tokenizeSearchQuery } from "@/lib/searchTokenize";

const PAGE_SIZE = 30;

const getRawProductPrice = (item: Record<string, unknown>) => {
  const rawPrice = Number(item.price ?? item.sell_price ?? item.min_price ?? item.lowest_price ?? 0);
  return Number.isFinite(rawPrice) ? rawPrice : 0;
};

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // URLSearchParams.get() does NOT convert "+" to space — only %20 is decoded.
  // Browsers and bots commonly encode spaces as "+" in query strings, so we
  // normalize that here to avoid zero-result searches like "red+dead+redemption".
  const query = (searchParams.get("q") || "").replace(/\+/g, " ");
  const [allResults, setAllResults] = useState<any[]>([]);
  const [kinguinPrices, setKinguinPrices] = useState<Record<string, { kinguinPrice: number | null; sellPrice: number; stock: number }>>({});
  const [manualKeyCounts, setManualKeyCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [regionFilter, setRegionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [additionalFilters, setAdditionalFilters] = useState<AdditionalFilters>(EMPTY_ADDITIONAL_FILTERS);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const { calculate } = usePricingRules();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { flyingItems, triggerFly } = useFlyToCart();

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.rpc("check_my_role" as any, { _role: "admin" });
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setAllResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);

      // Search aliases — treat these terms as equivalent
      const SEARCH_ALIASES: Record<string, string[]> = {
        "gta": ["grand theft auto"],
        "grand theft auto": ["gta"],
      };

      const rawQuery = query.trim().toLowerCase();
      const aliasQueries: string[] = [rawQuery];
      for (const [key, aliases] of Object.entries(SEARCH_ALIASES)) {
        if (rawQuery.includes(key)) {
          for (const alias of aliases) {
            aliasQueries.push(rawQuery.split(key).join(alias));
          }
        }
      }
      const uniqueQueries = [...new Set(aliasQueries)];

      // Run a regex-AND query per alias variant, then merge results.
      // Searches title + developers + publishers via the RPC. Apostrophes are
      // ignored, so "assassins creed" matches "Assassin's Creed" and
      // "cd projekt" matches games where CD Projekt is the developer/publisher.
      const queryResults = await Promise.all(
        uniqueQueries.map(async (q) => {
          const words = tokenizeSearchQuery(q);
          if (words.length === 0) return [];
          const { data } = await supabase.rpc(
            "search_products_with_metadata" as any,
            { _words: words }
          );
          return (data as any[]) || [];
        })
      );
      const merged = new Map<string, any>();
      for (const list of queryResults) {
        for (const item of list) merged.set(item.id, item);
      }
      const data = Array.from(merged.values()).slice(0, 500);
      setAllResults(data);

      // Log search query
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      supabase.from("search_logs").insert({
        query: query.trim().toLowerCase(),
        results_count: data?.length || 0,
        user_id: currentUser?.id || null,
        page_path: typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : null,
        user_agent: typeof navigator !== "undefined"
          ? navigator.userAgent.slice(0, 500)
          : null,
      } as any).then(() => {});

      // Fetch kinguin prices and manual key counts for these products
      if (data && data.length > 0) {
        const ids = data.map((p: any) => p.id);
        const [kpRes, mkRes] = await Promise.all([
          supabase.rpc("get_public_kinguin_by_ids" as any, { _ids: ids }),
          supabase.rpc("get_manual_key_counts"),
        ]);
        const priceMap: Record<string, { kinguinPrice: number | null; sellPrice: number; stock: number }> = {};
        (kpRes.data || []).forEach((kp: any) => {
          if (kp.is_active && (kp.kinguin_stock ?? 0) > 0) {
            priceMap[kp.allowed_product_id] = {
              kinguinPrice: null,
              sellPrice: kp.sell_price || 0,
              stock: kp.kinguin_stock || 0,
            };
          }
        });
        setKinguinPrices(priceMap);
        const mkMap: Record<string, number> = {};
        (mkRes.data || []).forEach((mk: any) => {
          mkMap[mk.allowed_product_id] = Number(mk.key_count);
        });
        setManualKeyCounts(mkMap);
      }
      setLoading(false);
    };
    fetchResults();
  }, [query]);

  // Filter + sort
  const filtered = useMemo(() => {
    let items = [...allResults];
    // Attach the computed display price so sort/filter use the real price shown on the card.
    items = items.map((i) => {
      const kd = kinguinPrices[i.id];
      const computed = kd
        ? (kd.kinguinPrice ? calculate(kinguinBuyPrice(kd.kinguinPrice)).finalPrice : kd.sellPrice)
        : getRawProductPrice(i);
      return { ...i, price: computed };
    }).filter((i) => !!kinguinPrices[i.id] || (manualKeyCounts[i.id] || 0) > 0);
    if (regionFilter) {
      items = items.filter((i) => i.region === regionFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter((i) => (i.title || "").toLowerCase().includes(q));
    }
    items = applyAdditionalFilters(items, additionalFilters);
    if (sortBy === "price-asc") items.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (sortBy === "price-desc") items.sort((a, b) => (b.price || 0) - (a.price || 0));
    else if (sortBy === "newest") items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === "oldest") items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return items;
  }, [allResults, sortBy, regionFilter, searchQuery, additionalFilters, kinguinPrices, manualKeyCounts, calculate]);

  const availableRegions = useMemo(() => {
    return [...new Set(allResults.map((i) => i.region || "Global"))].sort();
  }, [allResults]);

  const regionCounts = useMemo(() => {
    return allResults.reduce((acc, i) => {
      const r = i.region || "Global";
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [allResults]);

  const { data: gameGroupMap } = useGameGroupMap();
  const collapsed = useMemo(
    () => collapseByGameGroup(filtered as any[], gameGroupMap),
    [filtered, gameGroupMap],
  );
  const totalPages = Math.ceil(collapsed.length / PAGE_SIZE);
  const paginatedResults = collapsed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const visibleIds = paginatedResults.map((item) => item.id);
    setSelectedIds(new Set(visibleIds));
  };

  const selectedProducts = allResults.filter((p) => selectedIds.has(p.id));

  const handleAddToCart = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerFly(e);
    addItem({
      offerId: item.id,
      title: item.title,
      platform: item.platform,
      price: item.price,
      sellerName: kinguinPrices[item.id] ? "Official Store" : "Seller",
      image_url: item.image_url || game1,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-32 pb-12">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            Search Results
          </h1>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                variant={selectMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectMode(!selectMode);
                  if (selectMode) setSelectedIds(new Set());
                }}
                className="font-display text-xs"
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                {selectMode ? "Cancel" : "Select"}
              </Button>
              {selectMode && (
                <>
                  <Button variant="outline" size="sm" onClick={selectAll} className="font-display text-xs">
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    disabled={selectedIds.size === 0}
                    onClick={() => setEditModalOpen(true)}
                    className="font-display text-xs"
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit ({selectedIds.size})
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        <p className="text-muted-foreground mb-6">
          {loading ? "Searching..." : `${filtered.length} results for "${query}"`}
        </p>

        {!loading && (
          <ProductFilters
            sort={sortBy}
            onSortChange={(s) => { setSortBy(s); goToPage(1); }}
            region={regionFilter}
            onRegionChange={(r) => { setRegionFilter(r); goToPage(1); }}
            availableRegions={availableRegions}
            regionCounts={regionCounts}
            searchQuery={searchQuery}
            onSearchChange={(q) => { setSearchQuery(q); goToPage(1); }}
            products={filtered}
            additionalFilters={additionalFilters}
            onAdditionalFiltersChange={(f) => { setAdditionalFilters(f); goToPage(1); }}
          />
        )}

        {loading && (
          <GameCardSkeletonGrid count={10} />
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No results found for "{query}"</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-5">
          {paginatedResults.map((item) => {
            const kinguinData = kinguinPrices[item.id];
            const hasManualKeys = (manualKeyCounts[item.id] || 0) > 0;
            const hasStock = !!kinguinData || hasManualKeys;
            const displayPrice = kinguinData
              ? (kinguinData.kinguinPrice ? calculate(kinguinBuyPrice(kinguinData.kinguinPrice)).finalPrice : kinguinData.sellPrice)
              : getRawProductPrice(item);
            if (!hasStock) return null;
            return (
              <GameCard
                key={item.id}
                id={item.id}
                title={item.title}
                platform={item.platform}
                slug={item.slug}
                price={displayPrice}
                image={item.image_url || game1}
                soldCount={item.sold_count}
                wishlistCount={item.wishlist_count}
                isKinguin={!!kinguinData}
                selectable={selectMode}
                selected={selectedIds.has(item.id)}
                onSelect={toggleSelect}
                onAddToCart={(e) => handleAddToCart({ ...item, price: displayPrice }, e)}
              />
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-3">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <Footer />
      <FlyToCartOverlay items={flyingItems} />

      {editModalOpen && selectedProducts.length > 0 && (
        <AdminProductEditModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          products={selectedProducts}
          onSaved={() => {
            setEditModalOpen(false);
            setSelectMode(false);
            setSelectedIds(new Set());
          }}
          forceBulk
        />
      )}
    </div>
  );
};

export default SearchResults;
