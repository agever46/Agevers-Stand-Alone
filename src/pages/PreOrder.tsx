import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GameCard from "@/components/GameCard";
import ProductFilters, { SortOption, AdditionalFilters, EMPTY_ADDITIONAL_FILTERS, applyAdditionalFilters } from "@/components/ProductFilters";
import { useFlyToCart, FlyToCartOverlay } from "@/components/FlyToCart";
import { useCart } from "@/hooks/useCart";
import { motion } from "framer-motion";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminBulkPlatformBar from "@/components/AdminBulkPlatformBar";
import { useGameGroupMap, collapseByGameGroup } from "@/hooks/useGameGroupMap";

const ITEMS_PER_PAGE = 20;

const PreOrder = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [regionFilter, setRegionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [additionalFilters, setAdditionalFilters] = useState<AdditionalFilters>(EMPTY_ADDITIONAL_FILTERS);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { addItem } = useCart();
  const { flyingItems, triggerFly } = useFlyToCart();
  const { data: gameGroupMap } = useGameGroupMap();

  useEffect(() => {
    const fetchPreOrders = async () => {
      setLoading(true);
      const now = new Date().toISOString();

      // Get allowed_products with release_date in the future
      const { data: allowedData } = await supabase
        .from("allowed_products")
        .select("*")
        .gt("release_date", now)
        .order("release_date", { ascending: true });

      if (!allowedData || allowedData.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      // Get kinguin prices for these products
      const ids = allowedData.map((p) => p.id);
      const { data: kinguinData } = await supabase
        .rpc("get_public_kinguin_by_ids" as any, { _ids: ids });

      // Get seller products for these
      const titles = allowedData.map((p) => p.title);
      const { data: sellerData } = await supabase
        .from("products_public" as any)
        .select("*")
        .in("title", titles)
        .eq("status", "active");

      // Merge into unified product list
      const merged = allowedData.map((ap) => {
        const kp = kinguinData?.find((k) => k.allowed_product_id === ap.id);
        const sp = (sellerData as any[])?.find((s: any) => s.title === ap.title);

        const price = sp?.price || kp?.sell_price || null;
        const stock = (sp?.stock_count || 0) + (kp?.kinguin_stock || 0);

        return {
          id: ap.id,
          title: ap.title,
          platform: ap.platform,
          store: ap.store,
          image_url: ap.image_url,
          price,
          original_price: sp?.original_price || null,
          stock_count: stock,
          region: ap.region,
          release_date: ap.release_date,
          seller_id: sp?.seller_id || null,
          category: "games",
          sold_count: ap.sold_count || 0,
          wishlist_count: ap.wishlist_count || 0,
        };
      }).filter((p) => p.price !== null);

      setProducts(merged);
      setLoading(false);
    };

    fetchPreOrders();
  }, []);

  // Filters & sorting
  const regions = [...new Set(products.map((p) => p.region).filter(Boolean))].sort();
  const regionCounts = products.reduce((acc, p) => {
    const r = p.region || "Global";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let filtered = products
    .filter((p) => !searchQuery || p.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((p) => !regionFilter || p.region === regionFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case "price-asc": return (a.price || 0) - (b.price || 0);
        case "price-desc": return (b.price || 0) - (a.price || 0);
        case "newest": return new Date(a.release_date).getTime() - new Date(b.release_date).getTime();
        case "oldest": return new Date(b.release_date).getTime() - new Date(a.release_date).getTime();
        default: return 0;
      }
    });
  filtered = applyAdditionalFilters(filtered, additionalFilters);
  filtered = collapseByGameGroup(filtered, gameGroupMap);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [sortBy, regionFilter, searchQuery, additionalFilters]);

  const handleAddToCart = (product: any, e?: React.MouseEvent) => {
    addItem({
      offerId: product.id,
      title: product.title,
      platform: product.platform,
      price: product.price,
      sellerName: "Agever",
      image_url: product.image_url,
    });
    if (e) triggerFly(e);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <FlyToCartOverlay items={flyingItems} />
      <div className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-8 w-8 text-amber-400" />
            <h1 className="text-3xl font-display font-bold">Pre-Orders</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Secure upcoming titles before they launch. Pre-order now and be ready on release day.
          </p>
        </motion.div>

        <ProductFilters
          sort={sortBy}
          onSortChange={setSortBy}
          region={regionFilter}
          onRegionChange={setRegionFilter}
          availableRegions={regions}
          regionCounts={regionCounts}
          searchQuery={searchQuery}
          onSearchChange={(q) => { setSearchQuery(q); setCurrentPage(1); }}
          products={products}
          additionalFilters={additionalFilters}
          onAdditionalFiltersChange={setAdditionalFilters}
        />
        <AdminBulkPlatformBar
          selectMode={selectMode}
          setSelectMode={setSelectMode}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          visibleIds={paginated.map((p) => p.id)}
          onComplete={() => window.location.reload()}
        />

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">No pre-orders available</p>
            <p className="text-sm">Check back soon for upcoming releases!</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
              {paginated.map((product) => (
                <GameCard
                  key={product.id}
                  id={product.id}
                  title={product.title}
                  platform={product.platform}
                  slug={product.slug}
                  price={product.price}
                  originalPrice={product.original_price}
                  image={product.image_url}
                  soldCount={product.sold_count}
                  wishlistCount={product.wishlist_count}
                  releaseDate={product.release_date}
                  onAddToCart={(e) => handleAddToCart(product, e)}
                  badge="PRE-ORDER"
                  selectable={selectMode}
                  selected={selectedIds.has(product.id)}
                  onSelect={(id) => {
                    const next = new Set(selectedIds);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    setSelectedIds(next);
                  }}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default PreOrder;
