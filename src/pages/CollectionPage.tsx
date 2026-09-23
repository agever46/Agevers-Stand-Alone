import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GameCard from "@/components/GameCard";
import ProductFilters, { SortOption, AdditionalFilters, EMPTY_ADDITIONAL_FILTERS, applyAdditionalFilters } from "@/components/ProductFilters";
import { useFlyToCart, FlyToCartOverlay } from "@/components/FlyToCart";
import { useCart } from "@/hooks/useCart";
import { motion } from "framer-motion";
import { Package, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import game1 from "@/assets/game1.jpg";
import AgeversLoader from "@/components/AgeversLoader";
import { GameCardSkeletonGrid } from "@/components/GameCardSkeleton";
import { useGameGroupMap } from "@/hooks/useGameGroupMap";

const ITEMS_PER_PAGE = 20;
const PAGE_SIZE = 1000;

const matchesTargetPage = (product: { platform?: string | null; store?: string | null }, targetPage?: string | null) => {
  if (!targetPage?.trim()) return true;
  const normalizedTargetPage = targetPage.trim().toLowerCase();

  return [product.platform, product.store].some(
    (value) => value?.trim().toLowerCase() === normalizedTargetPage
  );
};

const matchesCategoryFilter = (product: { platform?: string | null; tab_category?: string | null }, categoryFilter?: string | null) => {
  if (!categoryFilter?.trim()) return true;
  const normalizedCategoryFilter = categoryFilter.trim().toLowerCase();

  return [product.platform, product.tab_category].some(
    (value) => value?.trim().toLowerCase() === normalizedCategoryFilter
  );
};

const CollectionPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [regionFilter, setRegionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [additionalFilters, setAdditionalFilters] = useState<AdditionalFilters>(EMPTY_ADDITIONAL_FILTERS);
  const { addItem } = useCart();
  const { data: gameGroupMap } = useGameGroupMap();
  const { flyingItems, triggerFly } = useFlyToCart();

  useEffect(() => {
    const fetchCollection = async () => {
      // Fetch collection by slug
      const { data: col } = await supabase
        .from("collections")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (!col) {
        setLoading(false);
        return;
      }
      setCollection(col);

      // Fetch product IDs: from manual collection_products OR via auto_group_keyword
      let allCpIds: string[] = [];

      if (col.auto_group_keyword && col.auto_group_keyword.trim()) {
        // AUTO mode: find allowed_products whose title contains the keyword,
        // but keep them scoped to the collection's target page/category rules.
        const kw = col.auto_group_keyword.trim();
        let apFrom = 0;
        while (true) {
          const { data } = await supabase
            .from("allowed_products")
            .select("id, platform, store, tab_category")
            .ilike("title", `%${kw}%`)
            .range(apFrom, apFrom + PAGE_SIZE - 1);

          if (!data || data.length === 0) break;

          const scopedIds = data
            .filter((product: any) => matchesTargetPage(product, col.target_page))
            .filter((product: any) => matchesCategoryFilter(product, col.category_filter))
            .map((product: any) => product.id);

          allCpIds = allCpIds.concat(scopedIds);
          if (data.length < PAGE_SIZE) break;
          apFrom += PAGE_SIZE;
        }
      } else {
        // MANUAL mode: load from collection_products
        let from = 0;
        while (true) {
          const { data } = await supabase
            .from("collection_products")
            .select("allowed_product_id")
            .eq("collection_id", col.id)
            .range(from, from + PAGE_SIZE - 1);
          if (!data || data.length === 0) break;
          allCpIds = allCpIds.concat(data.map((cp: any) => cp.allowed_product_id));
          if (data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
      }

      if (allCpIds.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch allowed products for these IDs
      let allProducts: any[] = [];
      // Batch in chunks of 200 for the IN filter
      for (let i = 0; i < allCpIds.length; i += 200) {
        const chunk = allCpIds.slice(i, i + 200);
        const { data: apData } = await supabase
          .from("allowed_products")
          .select("*")
          .in("id", chunk);
        if (apData) allProducts = allProducts.concat(apData);
      }

      // Fetch kinguin prices for these products
      let kinguinMap: Record<string, { sell_price: number; kinguin_stock: number }> = {};
      for (let i = 0; i < allCpIds.length; i += 200) {
        const chunk = allCpIds.slice(i, i + 200);
        const { data: kpData } = await supabase
          .rpc("get_public_kinguin_by_ids" as any, { _ids: chunk });
        if (kpData) {
          kpData.forEach((kp: any) => {
            kinguinMap[kp.allowed_product_id] = {
              sell_price: kp.sell_price,
              kinguin_stock: kp.kinguin_stock || 0,
            };
          });
        }
      }

      // Fetch product_variations for physical products (Gaming Accessories etc.)
      const variationMap: Record<string, { stock: number; minPrice: number }> = {};
      for (let i = 0; i < allCpIds.length; i += 200) {
        const chunk = allCpIds.slice(i, i + 200);
        const { data: varData } = await (supabase.rpc as any)("get_public_variation_stock", {
          _allowed_product_ids: chunk,
        });
        if (varData) {
          (varData as any[]).forEach((v) => {
            const pid = v.allowed_product_id;
            const vStock = v.stock || 0;
            const vPrice = v.price || 0;
            if (!variationMap[pid]) {
              variationMap[pid] = { stock: vStock, minPrice: vPrice > 0 ? vPrice : Infinity };
            } else {
              variationMap[pid].stock += vStock;
              if (vPrice > 0 && vPrice < variationMap[pid].minPrice) variationMap[pid].minPrice = vPrice;
            }
          });
        }
      }
      Object.values(variationMap).forEach((v) => { if (v.minPrice === Infinity) v.minPrice = 0; });

      // Build items list
      const builtItems = allProducts
        .map((ap) => {
          const kp = kinguinMap[ap.id];
          const variation = variationMap[ap.id];
          const isPhysical = ap.platform === "Gaming Accessories" || !!ap.aliexpress_product_id;
          const stock = isPhysical ? (variation?.stock || 0) : (kp?.kinguin_stock || 0);
          if (stock <= 0) return null;
          const price = isPhysical ? (variation?.minPrice || 0) : (kp?.sell_price || 0);
          return {
            id: ap.id,
            title: ap.title,
            original_title: ap.original_title,
            description: ap.description,
            platform: ap.platform,
            store: ap.store,
            tab_category: ap.tab_category,
            product_type: ap.product_type,
            price,
            image: ap.image_url || game1,
            sellerCount: 1,
            stock,
            isKinguin: !isPhysical,
            region: ap.region || "Global",
            soldCount: ap.sold_count || 0,
            wishlistCount: ap.wishlist_count || 0,
          };
        })
        .filter(Boolean) as any[];

      setItems(builtItems);
      setLoading(false);
    };

    fetchCollection();
  }, [slug]);

  // Region filter
  let filtered = items;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((item) => item.title?.toLowerCase().includes(q));
  }
  if (regionFilter) {
    filtered = filtered.filter((item) => item.region === regionFilter);
  }
  filtered = applyAdditionalFilters(filtered, additionalFilters);

  // Sort
  if (sortBy === "price-asc") filtered.sort((a, b) => a.price - b.price);
  else if (sortBy === "price-desc") filtered.sort((a, b) => b.price - a.price);
  else if (sortBy === "newest") filtered.sort((a, b) => b.id.localeCompare(a.id));
  else if (sortBy === "oldest") filtered.sort((a, b) => a.id.localeCompare(b.id));

  // Collapse Game Group variants to a single tile
  if (gameGroupMap && gameGroupMap.size > 0) {
    const seen = new Set<string>();
    filtered = filtered.filter((it: any) => {
      const info = gameGroupMap.get(it.id);
      if (!info) return true;
      if (seen.has(info.group_id)) return false;
      seen.add(info.group_id);
      it.title = info.title;
      it.image = info.image_url || it.image;
      it.slug = `__game__/${info.slug}`;
      return true;
    });
  }

  const availableRegions = [...new Set(items.map((i) => i.region))].sort();
  const regionCounts = items.reduce((acc, i) => {
    const r = i.region || "Global";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleAddToCart = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerFly(e);
    addItem({
      offerId: item.id,
      title: item.title,
      platform: item.platform,
      price: item.price,
      sellerName: "Official Store",
      image_url: item.image,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <FlyToCartOverlay items={flyingItems} />

      <section className="pt-32 pb-8">
        <div className="container mx-auto px-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-display text-muted-foreground hover:text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground mb-2">
              {collection?.name?.toUpperCase() || "COLLECTION"}
            </h1>
            {collection?.description && (
              <p className="text-muted-foreground">{collection.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} {filtered.length === 1 ? "product" : "products"} available
            </p>
          </motion.div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container mx-auto px-4">
          <ProductFilters
            sort={sortBy}
            onSortChange={(s) => { setSortBy(s); setCurrentPage(1); }}
            region={regionFilter}
            onRegionChange={(r) => { setRegionFilter(r); setCurrentPage(1); }}
            availableRegions={availableRegions}
            regionCounts={regionCounts}
            searchQuery={searchQuery}
            onSearchChange={(q) => { setSearchQuery(q); setCurrentPage(1); }}
            products={items}
            additionalFilters={additionalFilters}
            onAdditionalFiltersChange={(f) => { setAdditionalFilters(f); setCurrentPage(1); }}
          />
          {loading ? (
            <GameCardSkeletonGrid count={12} />
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 glass rounded-xl">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-display">No products available yet.</p>
            </div>
          ) : (
            <>
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
              >
                {paginatedItems.map((item) => (
                  <GameCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    platform={item.platform}
                    slug={item.slug}
                    price={item.price}
                    image={item.image}
                    sellerCount={item.sellerCount}
                    stock={item.stock}
                    isKinguin={item.isKinguin}
                    soldCount={item.soldCount}
                    wishlistCount={item.wishlistCount}
                    onAddToCart={(e) => handleAddToCart(item, e)}
                  />
                ))}
              </motion.div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={`font-display min-w-[36px] ${
                        page === currentPage ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CollectionPage;
