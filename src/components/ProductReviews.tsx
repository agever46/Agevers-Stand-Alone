import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, MessageSquare } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ProductReview {
  id: string;
  rating_product: number;
  rating_shipping: number | null;
  rating_service: number | null;
  comment: string | null;
  created_at: string;
  reviewer_name: string;
  seller_response: string | null;
  seller_responded_at: string | null;
}

export interface ProductRatingStats {
  avg_rating: number | null;
  review_count: number;
  rating_5: number;
  rating_4: number;
  rating_3: number;
  rating_2: number;
  rating_1: number;
}

export const useProductRatingStats = (productId: string | undefined) => {
  const [stats, setStats] = useState<ProductRatingStats | null>(null);

  useEffect(() => {
    if (!productId) { setStats(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_product_rating_stats" as any, { _product_id: productId });
      if (!cancelled && data && Array.isArray(data) && data[0]) {
        const row = data[0] as any;
        setStats({
          avg_rating: row.avg_rating ? Number(row.avg_rating) : null,
          review_count: Number(row.review_count) || 0,
          rating_5: Number(row.rating_5) || 0,
          rating_4: Number(row.rating_4) || 0,
          rating_3: Number(row.rating_3) || 0,
          rating_2: Number(row.rating_2) || 0,
          rating_1: Number(row.rating_1) || 0,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  return stats;
};

const Stars = ({ rating, size = "h-4 w-4" }: { rating: number; size?: string }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`${size} ${i <= Math.round(rating) ? "text-[hsl(var(--neon-gold))] fill-[hsl(var(--neon-gold))]" : "text-muted-foreground/30"}`}
      />
    ))}
  </div>
);

export const ProductRatingSummary = ({ stats }: { stats: ProductRatingStats | null }) => {
  if (!stats || !stats.review_count || !stats.avg_rating) return null;
  return (
    <a
      href="#product-reviews"
      className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
    >
      <Stars rating={stats.avg_rating} size="h-3.5 w-3.5" />
      <span className="text-sm font-display tracking-wider text-foreground/80">
        {stats.avg_rating.toFixed(1)}
      </span>
      <span className="text-xs text-muted-foreground underline-offset-2 hover:underline">
        ({stats.review_count} {stats.review_count === 1 ? "review" : "reviews"})
      </span>
    </a>
  );
};

interface ProductReviewsProps {
  productId: string;
  productTitle: string;
  stats: ProductRatingStats | null;
}

const ProductReviews = ({ productId, productTitle, stats }: ProductReviewsProps) => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStar, setFilterStar] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    supabase
      .from("product_reviews_public" as any)
      .select("*")
      .eq("allowed_product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setReviews((data as any) || []);
        setLoading(false);
      });
  }, [productId]);

  const filtered = filterStar
    ? reviews.filter((r) => r.rating_product === filterStar)
    : reviews;
  const visible = filtered.slice(0, visibleCount);

  const total = stats?.review_count || 0;
  const breakdown = stats
    ? [
        { star: 5, count: stats.rating_5 },
        { star: 4, count: stats.rating_4 },
        { star: 3, count: stats.rating_3 },
        { star: 2, count: stats.rating_2 },
        { star: 1, count: stats.rating_1 },
      ]
    : [];

  return (
    <section id="product-reviews" className="mt-10 scroll-mt-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-8 rounded-lg bg-[hsl(var(--neon-gold))] flex items-center justify-center">
          <Star className="h-4 w-4 text-black fill-black" />
        </div>
        <h2 className="font-display text-xl md:text-2xl font-black tracking-wider text-foreground">
          CUSTOMER REVIEWS
        </h2>
      </div>

      {!stats || total === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No reviews yet for <span className="text-foreground font-semibold">{productTitle}</span>.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Be the first — purchase this product and share your experience.
          </p>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-[280px_1fr] gap-6 mb-8">
            {/* Summary card */}
            <div className="glass rounded-xl p-6 flex flex-col items-center justify-center text-center">
              <div className="text-5xl font-display font-black text-foreground">
                {stats.avg_rating?.toFixed(1)}
              </div>
              <div className="my-2">
                <Stars rating={stats.avg_rating || 0} size="h-5 w-5" />
              </div>
              <p className="text-xs text-muted-foreground tracking-wider uppercase font-display">
                {total} verified {total === 1 ? "review" : "reviews"}
              </p>
            </div>

            {/* Breakdown bars */}
            <div className="glass rounded-xl p-5 space-y-2">
              {breakdown.map(({ star, count }) => {
                const pct = total > 0 ? (count / total) * 100 : 0;
                const isActive = filterStar === star;
                return (
                  <button
                    key={star}
                    onClick={() => setFilterStar(isActive ? null : star)}
                    className={`w-full flex items-center gap-3 group hover:bg-muted/30 rounded-lg px-2 py-1.5 transition-colors ${
                      isActive ? "bg-muted/50" : ""
                    }`}
                  >
                    <span className="text-xs font-display tracking-wider text-foreground/70 w-12 text-left">
                      {star} star
                    </span>
                    <Progress value={pct} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
                      {count}
                    </span>
                  </button>
                );
              })}
              {filterStar && (
                <button
                  onClick={() => setFilterStar(null)}
                  className="text-xs text-primary hover:underline mt-2"
                >
                  Clear filter ({filterStar}★)
                </button>
              )}
            </div>
          </div>

          {/* Reviews list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 glass rounded-xl animate-pulse" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No reviews match the selected filter.
            </p>
          ) : (
            <div className="space-y-3">
              {visible.map((r) => (
                <article
                  key={r.id}
                  className="glass rounded-xl p-5 hover:border-primary/30 transition-colors"
                >
                  <header className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary-foreground">
                          {r.reviewer_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-display font-bold text-foreground tracking-wide">
                          {r.reviewer_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Verified Buyer · {new Date(r.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <Stars rating={r.rating_product} />
                  </header>
                  {r.comment && (
                    <p className="text-sm text-foreground/80 leading-relaxed font-body whitespace-pre-line">
                      {r.comment}
                    </p>
                  )}
                  {r.seller_response && (
                    <div className="mt-3 ml-12 p-3 rounded-lg bg-muted/30 border-l-2 border-primary">
                      <p className="text-[11px] font-display tracking-wider text-primary uppercase mb-1">
                        Seller response
                      </p>
                      <p className="text-xs text-foreground/70">{r.seller_response}</p>
                    </div>
                  )}
                </article>
              ))}
              {visible.length < filtered.length && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => setVisibleCount((c) => c + 6)}
                    className="text-sm font-display tracking-wider text-primary hover:underline"
                  >
                    Show more reviews ({filtered.length - visible.length} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ProductReviews;
