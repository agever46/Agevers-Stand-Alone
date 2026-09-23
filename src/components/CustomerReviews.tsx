import { useEffect, useState, useRef } from "react";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Review {
  id: string;
  comment: string;
  rating_product: number;
  rating_service: number;
  created_at: string;
}

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-3.5 w-3.5 ${i < rating ? "text-[hsl(var(--neon-gold))] fill-[hsl(var(--neon-gold))]" : "text-muted-foreground/30"}`}
      />
    ))}
  </div>
);

const CustomerReviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("reviews_public")
        .select("id, comment, rating_product, rating_service, created_at")
        .gte("rating_product", 4)
        .not("comment", "eq", "")
        .order("created_at", { ascending: false })
        .limit(40);

      if (data) setReviews(data.filter((r) => r.comment && r.comment.length > 10) as Review[]);
    };
    load();
  }, []);

  if (reviews.length === 0) return null;

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--neon-gold))] flex items-center justify-center">
              <Star className="h-4 w-4 text-black" />
            </div>
            <h2 className="font-display text-xl md:text-2xl font-bold text-foreground tracking-wide">
              CUSTOMER REVIEWS
            </h2>
          </div>
          <div className="hidden md:flex gap-2">
            <button
              onClick={() => scroll(-1)}
              className="h-8 w-8 rounded-full bg-secondary hover:bg-muted flex items-center justify-center text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll(1)}
              className="h-8 w-8 rounded-full bg-secondary hover:bg-muted flex items-center justify-center text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="glass rounded-xl p-5 min-w-[280px] max-w-[320px] flex-shrink-0 flex flex-col gap-3 relative group hover:border-primary/30 transition-colors"
            >
              <Quote className="h-6 w-6 text-primary/20 absolute top-3 right-3" />
              <StarRating rating={review.rating_product} />
              <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 font-body">
                "{review.comment}"
              </p>
              <div className="mt-auto flex items-center gap-2 pt-2 border-t border-border/30">
                <div className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-primary-foreground">✓</span>
                </div>
                <div>
                  <p className="text-xs font-display text-foreground/60 tracking-wide">VERIFIED BUYER</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CustomerReviews;
