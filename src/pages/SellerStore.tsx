import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GameCard from "@/components/GameCard";
import SellerReviews from "@/components/SellerReviews";
import ProductFilters, { SortOption, AdditionalFilters, EMPTY_ADDITIONAL_FILTERS, applyAdditionalFilters } from "@/components/ProductFilters";
import { useFlyToCart, FlyToCartOverlay } from "@/components/FlyToCart";
import { useCart } from "@/hooks/useCart";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Star,
  Calendar,
  Package,
  TicketCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
  Zap,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildSocialProofIndex, findBestAllowedProduct, resolveSocialProof } from "@/lib/socialProof";

import game1 from "@/assets/game1.jpg";
import AgeversLoader from "@/components/AgeversLoader";

const ITEMS_PER_PAGE = 20;
const OFFICIAL_STORE_ID = "0efdf045-36a2-408e-905e-bcc877742db9";

interface SellerProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface SellerStats {
  avg_overall: number;
  avg_product: number;
  avg_service: number;
  avg_shipping: number;
  review_count: number;
}

const SellerStore = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [salesCount, setSalesCount] = useState(0);
  const [ticketRatio, setTicketRatio] = useState<string>("0%");
  const [avgResponseTime, setAvgResponseTime] = useState<string>("N/A");
  const [products, setProducts] = useState<any[]>([]);
  const [allowedProducts, setAllowedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [regionFilter, setRegionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [additionalFilters, setAdditionalFilters] = useState<AdditionalFilters>(EMPTY_ADDITIONAL_FILTERS);
  const [activeTab, setActiveTab] = useState("listings");
  const { addItem } = useCart();
  const { flyingItems, triggerFly } = useFlyToCart();

  useEffect(() => {
    if (!id) return;
    fetchSellerData();
  }, [id]);

  const fetchSellerData = async () => {
    if (!id) return;
    const isOfficialStore = id === OFFICIAL_STORE_ID;

    // Fetch profile, stats, sales count, and products in parallel
    const [profileRes, statsRes, salesRes, ticketsRes, productsRes, boostRes] = await Promise.all([
      supabase.from("public_profiles").select("*").eq("user_id", id).maybeSingle(),
      supabase.rpc("get_seller_avg_ratings", { _seller_id: id }),
      // Sales in last 3 months
      supabase.from("seller_sales").select("id", { count: "exact" }).eq("seller_id", id).eq("status", "completed").gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
      // Tickets in last 3 months
      supabase.from("support_tickets").select("id, created_at, seller_response, updated_at", { count: "exact" }).eq("seller_id", id).gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from("products_public" as any)
        .select("*")
        .eq("seller_id", id)
        .eq("status", "active"),
      // Fake sales boost (simulated sellers) — added on top of real count
      supabase.from("profiles").select("fake_sales_boost").eq("user_id", id).maybeSingle(),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data);
    } else {
      // Fallback to profiles table if public_profiles view has no data
      const { data: fallbackProfile } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .eq("user_id", id)
        .maybeSingle();
      if (fallbackProfile) {
        setProfile(fallbackProfile);
      }
    }

    if (statsRes.data && (statsRes.data as any[]).length > 0) {
      const s = (statsRes.data as any[])[0];
      const reviewCount = Number(s.review_count) || 0;
      if (reviewCount > 0) {
        setStats({
          avg_overall: Number(s.avg_overall) || 0,
          avg_product: Number(s.avg_product) || 0,
          avg_service: Number(s.avg_service) || 0,
          avg_shipping: Number(s.avg_shipping) || 0,
          review_count: reviewCount,
        });
      } else if (isOfficialStore) {
        setStats({ avg_overall: 4.9, avg_product: 4.9, avg_service: 4.85, avg_shipping: 4.95, review_count: 967 });
      }
    } else if (isOfficialStore) {
      setStats({ avg_overall: 4.9, avg_product: 4.9, avg_service: 4.85, avg_shipping: 4.95, review_count: 967 });
    }

    if (isOfficialStore) {
      setSalesCount(8000);
      setTicketRatio("0.0%");
      setAvgResponseTime("< 9h");
      setMemberSince("Jan 2018");
    } else {
      const boost = (boostRes as any)?.data?.fake_sales_boost || 0;
      const totalSales = (salesRes.count || 0) + boost;
      setSalesCount(totalSales);

      const totalTickets = ticketsRes.count || 0;
      if (totalSales > 0) {
        const ratio = ((totalTickets / totalSales) * 100).toFixed(1);
        setTicketRatio(`${ratio}%`);
      }

      // Calculate avg response time from tickets
      if (ticketsRes.data && (ticketsRes.data as any[]).length > 0) {
        const responseTimes = (ticketsRes.data as any[])
          .filter((t: any) => t.seller_response && t.updated_at)
          .map((t: any) => new Date(t.updated_at).getTime() - new Date(t.created_at).getTime());
        if (responseTimes.length > 0) {
          const avgMs = responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length;
          const avgHours = Math.round(avgMs / (1000 * 60 * 60));
          setAvgResponseTime(avgHours <= 1 ? "< 1h" : `< ${avgHours}h`);
        }
      }

      // Member since
      const { data: profileFull } = await supabase
        .from("profiles")
        .select("created_at")
        .eq("user_id", id)
        .single();
      if (profileFull) {
        const date = new Date(profileFull.created_at);
        setMemberSince(date.toLocaleDateString("en-US", { month: "short", year: "numeric" }));
      }
    }

    // Process seller products
    let allItems: any[] = [];
    if (productsRes.data) {
      // Fetch allowed_products to match by title/platform/store
      const { data: allowedProducts } = await supabase.from("allowed_products").select("*");
      setAllowedProducts(allowedProducts || []);
      const socialProofIndex = buildSocialProofIndex(allowedProducts || []);
      const items = (productsRes.data as any[]).map((p: any) => {
        const socialProof = resolveSocialProof(p, socialProofIndex);
        const ap = socialProof.bestMatch || findBestAllowedProduct(p, socialProofIndex);
        const stockCount = p.stock_count || 0;
        return {
          id: ap?.id || p.id,
          title: ap?.title || p.title,
          platform: p.platform,
          price: p.price,
          originalPrice: p.original_price ?? undefined,
          image: ap?.image_url || p.image_url || game1,
          region: socialProof.region || ap?.region || "Global",
          stock: stockCount,
          store: ap?.store || p.store,
          soldCount: Math.max(ap?.sold_count || 0, socialProof.soldCount),
          wishlistCount: Math.max(ap?.wishlist_count || 0, socialProof.wishlistCount),
        };
      }).filter((p: any) => p.stock > 0);
      allItems = items;
    }

    // For Official Store, also load Kinguin products
    if (isOfficialStore) {
      const { data: kinguinData } = await supabase
        .rpc("get_public_kinguin_products" as any);
      if (kinguinData) {
        // Need to fetch allowed_products separately for kinguin items
        const kinguinApIds = kinguinData.map((kp: any) => kp.allowed_product_id).filter(Boolean);
        let kinguinAllowed: any[] = [];
        if (kinguinApIds.length > 0) {
          const { data: apData } = await supabase
            .from("allowed_products")
            .select("*")
            .in("id", kinguinApIds);
          kinguinAllowed = apData || [];
        }
        const apMap = Object.fromEntries(kinguinAllowed.map((a: any) => [a.id, a]));
        const existingIds = new Set(allItems.map((i: any) => i.id));
        kinguinData.forEach((kp: any) => {
          const ap = apMap[kp.allowed_product_id];
          if (!ap || existingIds.has(ap.id)) return;
          if ((kp.kinguin_stock || 0) <= 0) return;
          allItems.push({
            id: ap.id,
            title: ap.title,
            platform: ap.platform,
            price: kp.sell_price,
            image: ap.image_url || game1,
            region: ap.region || "Global",
            stock: kp.kinguin_stock || 0,
            store: ap.store,
            isKinguin: true,
            soldCount: ap.sold_count || 0,
            wishlistCount: ap.wishlist_count || 0,
          });
        });
      }
    }

    setProducts(allItems);
    setLoading(false);
  };

  const socialProofIndex = useMemo(() => buildSocialProofIndex(allowedProducts), [allowedProducts]);

  const isOfficialStore = id === OFFICIAL_STORE_ID;
  const sellerName = isOfficialStore ? "Official Store" : (profile?.display_name || profile?.username || "Seller");

  // Sorting & filtering
  let filteredItems = [...products];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter((item) => item.title?.toLowerCase().includes(q));
  }
  if (regionFilter) {
    filteredItems = filteredItems.filter((item) => item.region === regionFilter || item.region === "Global");
  }
  filteredItems = applyAdditionalFilters(filteredItems, additionalFilters);
  if (sortBy === "price-asc") filteredItems.sort((a, b) => a.price - b.price);
  else if (sortBy === "price-desc") filteredItems.sort((a, b) => b.price - a.price);
  else if (sortBy === "newest") filteredItems.sort((a, b) => b.id.localeCompare(a.id));
  else filteredItems.sort((a, b) => b.stock - a.stock);

  const availableRegions = [...new Set(products.map((p) => p.region))].sort();
  const regionCounts = products.reduce((acc, p) => {
    const r = p.region || "Global";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleAddToCart = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerFly(e);
    addItem({
      offerId: item.id,
      title: item.title,
      platform: item.platform,
      price: item.price,
      sellerName,
      image_url: item.image,
    });
  };

  // Calculate time selling
  const getTimeSelling = () => {
    if (!memberSince) return "New seller";
    return `Since ${memberSince}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center items-center pt-40 pb-20">
          <AgeversLoader />
        </div>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="text-center pt-40 pb-20">
          <p className="text-muted-foreground font-display text-xl">Seller not found</p>
        </div>
        <Footer />
      </div>
    );
  }

  const avatarHue = (sellerName.charCodeAt(0) * 137 + sellerName.charCodeAt(sellerName.length - 1) * 59) % 360;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <FlyToCartOverlay items={flyingItems} />

      {/* Seller Header */}
      <section className="pt-28 pb-6">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 md:p-8 border border-border/50"
          >
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Avatar */}
              <div className="shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={sellerName}
                    className="h-24 w-24 md:h-28 md:w-28 rounded-full object-cover border-4 border-primary/30"
                  />
                ) : (
                  <div
                    className="h-24 w-24 md:h-28 md:w-28 rounded-full flex items-center justify-center border-4 border-primary/30 text-white font-display font-black text-4xl"
                    style={{ backgroundColor: `hsl(${avatarHue}, 65%, 50%)` }}
                  >
                    {sellerName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Seller Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <h1 className="font-display text-2xl md:text-3xl font-black tracking-wider text-foreground">
                    {sellerName}
                  </h1>
                  <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
                  <span className="text-[10px] font-display font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/20 text-primary flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Verified Seller
                  </span>
                </div>

                {/* Stats Row */}
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-neon-gold fill-neon-gold" />
                    <div>
                      <span className="font-display text-lg font-black text-foreground">
                        {stats ? stats.avg_overall.toFixed(2) : "N/A"}
                      </span>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current rating</p>
                    </div>
                  </div>

                  {/* Member Since */}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <div>
                      <span className="font-display text-sm font-bold text-foreground">{getTimeSelling()}</span>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Member</p>
                    </div>
                  </div>

                  {/* Sales */}
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-neon-green" />
                    <div>
                      <span className="font-display text-sm font-bold text-foreground">
                        {salesCount.toLocaleString()}+
                      </span>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sold items (last 3 months)</p>
                    </div>
                  </div>

                  {/* Feedbacks */}
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-accent" />
                    <div>
                      <span className="font-display text-sm font-bold text-foreground">
                        {stats ? stats.review_count.toLocaleString() : 0}
                      </span>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lifetime feedbacks</p>
                    </div>
                  </div>



                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="font-display text-sm font-bold text-foreground">{avgResponseTime}</span>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg. response</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tabs: Listings / Ratings */}
      <section className="pb-16">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-card border border-border/50 mb-6">
              <TabsTrigger value="listings" className="font-display uppercase tracking-wider text-xs">
                Listings ({filteredItems.length})
              </TabsTrigger>
              <TabsTrigger value="ratings" className="font-display uppercase tracking-wider text-xs">
                Ratings ({stats?.review_count || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="listings">
              <ProductFilters
                sort={sortBy}
                onSortChange={(s) => { setSortBy(s); setCurrentPage(1); }}
                region={regionFilter}
                onRegionChange={(r) => { setRegionFilter(r); setCurrentPage(1); }}
                availableRegions={availableRegions}
                regionCounts={regionCounts}
                searchQuery={searchQuery}
                onSearchChange={(q) => { setSearchQuery(q); setCurrentPage(1); }}
                products={products}
                additionalFilters={additionalFilters}
                onAdditionalFiltersChange={(f) => { setAdditionalFilters(f); setCurrentPage(1); }}
              />

              {filteredItems.length === 0 ? (
                <div className="text-center py-20 glass rounded-xl">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground font-display">No products listed yet.</p>
                </div>
              ) : (
                <>
                  <motion.div
                    key={`${currentPage}-${sortBy}`}
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
                        originalPrice={item.originalPrice}
                        image={item.image}
                        sellerCount={1}
                        stock={item.stock}
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
            </TabsContent>

            <TabsContent value="ratings">
              <SellerReviews sellerId={id!} />
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SellerStore;
