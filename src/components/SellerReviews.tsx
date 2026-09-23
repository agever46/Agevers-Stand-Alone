import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, ShieldCheck, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Review {
  id: string;
  rating_product: number;
  rating_shipping: number;
  rating_service: number;
  comment: string;
  created_at: string;
  buyerName: string;
  buyerAvatar: string | null;
  sellerResponse?: string | null;
}

interface SellerStats {
  avg_product: number;
  avg_shipping: number;
  avg_service: number;
  avg_overall: number;
  review_count: number;
}

interface SellerReviewsProps {
  sellerId: string;
  compact?: boolean;
}

type SortOption = "newest" | "oldest" | "rating-high" | "rating-low";
type StarFilter = "all" | "5" | "4" | "3" | "2" | "1";

const StarDisplay = ({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) => {
  const sizeClass = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= Math.round(rating)
              ? "text-neon-gold fill-neon-gold"
              : "text-muted-foreground/20"
          }`}
        />
      ))}
    </div>
  );
};

const OFFICIAL_STORE_ID = "0efdf045-36a2-408e-905e-bcc877742db9";
const REVIEWS_PER_PAGE = 6;

const FAKE_NAMES = [
  "Alex M.", "Jordan K.", "Chris W.", "Taylor S.", "Morgan P.", "Casey R.", "Riley T.", "Jamie L.",
  "Sam D.", "Drew H.", "Blake N.", "Quinn F.", "Avery B.", "Dakota G.", "Skyler J.", "Reese C.",
  "Parker V.", "Hayden E.", "Logan Z.", "Cameron X.", "Jesse A.", "Emery O.", "Rowan I.", "Finley U.",
  "Phoenix Y.", "Sage Q.", "River M.", "Elliot K.", "Harley W.", "Kai S.", "Nova P.", "Zion R.",
  "Eden T.", "Remy L.", "Milan D.", "Jules H.", "Arden N.", "Briar F.", "Lane B.", "Scout G.",
];

const FAKE_COMMENTS = [
  "Key worked instantly, great service!", "Fast delivery, no issues at all.", "Perfect, activated without problems.",
  "Excellent store, highly recommend!", "Got my key in seconds, amazing.", "Very professional and reliable seller.",
  "Best prices I've found anywhere.", "Smooth transaction, will buy again.", "Key was valid and worked first try.",
  "Super fast delivery, thank you!", "Great experience, 5 stars deserved.", "Legitimate key, activated perfectly.",
  "Quick and easy, very satisfied.", "Outstanding service and fast delivery.", "Will definitely purchase again!",
  "Everything went perfectly, no complaints.", "Received key immediately after payment.", "Trustworthy seller, great prices.",
  "Instant delivery and genuine key.", "Amazing service, very happy customer.", "Key activated without any issues whatsoever.",
  "Bought multiple keys, all worked.", "Fastest delivery I've ever experienced.", "Very reliable, bought here many times.",
  "Excellent value for the price.", "Professional service from start to finish.", "No problems at all, recommended!",
  "The key worked on first attempt.", "Great store with competitive pricing.", "Couldn't be happier with this purchase.",
  "Instant key delivery, worked perfectly.", "Top-notch service, very impressed.", "Will recommend to all my friends.",
  "Genuine product at a great price.", "Fast, reliable, and trustworthy.", "Another great purchase from this store.",
  "Key delivered and activated in minutes.", "Very satisfied with this transaction.", "Best seller on the platform!",
  "Quick delivery, product as described.", "Seamless buying experience overall.", "Already bought 3 times, never disappointed.",
];

function generateFakeReviews(count: number, seed: number = 42): Review[] {
  const reviews: Review[] = [];
  let rng = seed;
  const nextRng = () => { rng = (rng * 1664525 + 1013904223) & 0x7fffffff; return rng / 0x7fffffff; };

  for (let i = 0; i < count; i++) {
    const isFiveStar = i < Math.round(count * 0.9);
    let rp: number, rs: number, rv: number;
    if (isFiveStar) {
      rp = 5; rs = 5; rv = 5;
      if (nextRng() < 0.15) { rs = 4; rv = 5; rp = 5; }
    } else {
      rp = nextRng() < 0.5 ? 4 : 5;
      rs = nextRng() < 0.6 ? 4 : 5;
      rv = nextRng() < 0.5 ? 4 : 3;
    }

    const nameIdx = Math.floor(nextRng() * FAKE_NAMES.length);
    const commentIdx = Math.floor(nextRng() * FAKE_COMMENTS.length);
    const daysAgo = Math.floor(nextRng() * 730);
    const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    reviews.push({
      id: `fake-${i}`,
      rating_product: rp,
      rating_shipping: rs,
      rating_service: rv,
      comment: FAKE_COMMENTS[commentIdx],
      created_at: date.toISOString(),
      buyerName: FAKE_NAMES[nameIdx],
      buyerAvatar: null,
    });
  }

  reviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return reviews;
}

const ReviewCard = ({ review }: { review: Review }) => {
  const avgRating = (review.rating_product + review.rating_shipping + review.rating_service) / 3;
  return (
    <div className="glass rounded-xl p-4 border border-border/30 flex flex-col h-full min-w-0">
      <div className="flex items-center gap-2 mb-3">
        {review.buyerAvatar ? (
          <img src={review.buyerAvatar} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">
              {review.buyerName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <span className="font-display text-sm font-bold text-foreground block truncate">{review.buyerName}</span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(review.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <StarDisplay rating={avgRating} />
        <span className="inline-flex items-center gap-0.5 text-[9px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-neon-green/15 text-neon-green">
          <ShieldCheck className="h-2.5 w-2.5" /> Verified
        </span>
      </div>
      <p className="text-sm text-muted-foreground flex-1 line-clamp-3">{review.comment}</p>
      {review.sellerResponse && (
        <div className="mt-3 pl-3 border-l-2 border-primary/30">
          <p className="text-[10px] font-display font-bold text-primary uppercase tracking-wider mb-0.5">Seller Response</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{review.sellerResponse}</p>
        </div>
      )}
    </div>
  );
};

const SellerReviews = ({ sellerId, compact = false }: SellerReviewsProps) => {
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [starFilter, setStarFilter] = useState<StarFilter>("all");
  const isOfficialStore = sellerId === OFFICIAL_STORE_ID;

  useEffect(() => {
    fetchData();
  }, [sellerId]);

  const fetchData = async () => {
    if (isOfficialStore) {
      const fakeReviews = generateFakeReviews(967);
      const totalProduct = fakeReviews.reduce((s, r) => s + r.rating_product, 0) / 967;
      const totalShipping = fakeReviews.reduce((s, r) => s + r.rating_shipping, 0) / 967;
      const totalService = fakeReviews.reduce((s, r) => s + r.rating_service, 0) / 967;
      const overall = (totalProduct + totalShipping + totalService) / 3;

      setStats({
        avg_product: totalProduct,
        avg_shipping: totalShipping,
        avg_service: totalService,
        avg_overall: Math.round(overall * 100) / 100,
        review_count: 967,
      });
      setReviews(fakeReviews);
      setLoading(false);
      return;
    }

    const { data: statsData } = await supabase.rpc("get_seller_avg_ratings", { _seller_id: sellerId });

    if (statsData && (statsData as any[]).length > 0) {
      const s = (statsData as any[])[0];
      setStats({
        avg_product: Number(s.avg_product) || 0,
        avg_shipping: Number(s.avg_shipping) || 0,
        avg_service: Number(s.avg_service) || 0,
        avg_overall: Number(s.avg_overall) || 0,
        review_count: Number(s.review_count) || 0,
      });
    }

    const { data: reviewsData } = await supabase.rpc("get_public_reviews" as any, {
      _seller_id: sellerId,
      _limit: compact ? 3 : 50,
    });

    if (reviewsData && (reviewsData as any[]).length > 0) {
      const mapped: Review[] = (reviewsData as any[]).map((r: any) => ({
        id: r.id,
        rating_product: r.rating_product,
        rating_shipping: r.rating_shipping,
        rating_service: r.rating_service,
        comment: r.comment,
        created_at: r.created_at,
        buyerName: r.buyer_display_name || "Buyer",
        buyerAvatar: r.buyer_avatar_url || null,
        sellerResponse: r.seller_response || null,
      }));
      setReviews(mapped);
    }

    setLoading(false);
  };

  const filteredAndSorted = useMemo(() => {
    let items = [...reviews];

    // Star filter
    if (starFilter !== "all") {
      const target = parseInt(starFilter);
      items = items.filter((r) => {
        const avg = (r.rating_product + r.rating_shipping + r.rating_service) / 3;
        return Math.round(avg) === target;
      });
    }

    // Sort
    switch (sortBy) {
      case "newest":
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "oldest":
        items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "rating-high":
        items.sort((a, b) => {
          const avgA = (a.rating_product + a.rating_shipping + a.rating_service) / 3;
          const avgB = (b.rating_product + b.rating_shipping + b.rating_service) / 3;
          return avgB - avgA;
        });
        break;
      case "rating-low":
        items.sort((a, b) => {
          const avgA = (a.rating_product + a.rating_shipping + a.rating_service) / 3;
          const avgB = (b.rating_product + b.rating_shipping + b.rating_service) / 3;
          return avgA - avgB;
        });
        break;
    }

    return items;
  }, [reviews, sortBy, starFilter]);

  const totalPages = Math.ceil(filteredAndSorted.length / REVIEWS_PER_PAGE);
  const paginatedReviews = filteredAndSorted.slice(
    (currentPage - 1) * REVIEWS_PER_PAGE,
    currentPage * REVIEWS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, starFilter]);

  if (loading) return null;
  if (!stats || stats.review_count === 0) {
    if (compact) return null;
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No reviews yet for this seller.
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <StarDisplay rating={stats.avg_overall} />
        <span className="text-[11px] font-bold text-foreground">{stats.avg_overall.toFixed(2)}</span>
        <span className="text-[11px] text-muted-foreground">({stats.review_count})</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Average ratings summary */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <span className="font-display text-4xl font-black text-foreground">
              {stats.avg_overall.toFixed(1)}
            </span>
            <StarDisplay rating={stats.avg_overall} size="md" />
            <p className="text-xs text-muted-foreground mt-1">{stats.review_count} review{stats.review_count !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20">Product</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-neon-gold rounded-full" style={{ width: `${(stats.avg_product / 5) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-foreground w-8">{stats.avg_product.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20">Delivery</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-neon-gold rounded-full" style={{ width: `${(stats.avg_shipping / 5) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-foreground w-8">{stats.avg_shipping.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20">Service</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-neon-gold rounded-full" style={{ width: `${(stats.avg_service / 5) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-foreground w-8">{stats.avg_service.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[160px] h-9 text-xs font-display uppercase tracking-wider bg-card border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="rating-high">Highest rated</SelectItem>
            <SelectItem value="rating-low">Lowest rated</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-1.5">
          {(["all", "5", "4", "3", "2", "1"] as StarFilter[]).map((sf) => (
            <button
              key={sf}
              onClick={() => setStarFilter(sf)}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-colors border ${
                starFilter === sf
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border/50 hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {sf === "all" ? "All" : (
                <span className="flex items-center gap-1">
                  {sf} <Star className="h-3 w-3 fill-current" />
                </span>
              )}
            </button>
          ))}
        </div>

        <span className="text-xs text-muted-foreground ml-auto">
          {filteredAndSorted.length} review{filteredAndSorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Horizontal review cards grid */}
      {filteredAndSorted.length === 0 ? (
        <div className="text-center py-12 glass rounded-xl">
          <p className="text-muted-foreground text-sm">No reviews match this filter.</p>
        </div>
      ) : (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentPage}-${sortBy}-${starFilter}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {paginatedReviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="ghost"
                size="icon"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) {
                  page = i + 1;
                } else if (currentPage <= 4) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  page = totalPages - 6 + i;
                } else {
                  page = currentPage - 3 + i;
                }
                return (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={`font-display min-w-[36px] text-xs ${
                      page === currentPage ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {page}
                  </Button>
                );
              })}

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
  );
};

export default SellerReviews;
