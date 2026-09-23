import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Star, ShieldCheck, MessageSquare, Send } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import AgeversLoader from "@/components/AgeversLoader";

interface Review {
  id: string;
  rating_product: number;
  rating_shipping: number;
  rating_service: number;
  comment: string;
  seller_response: string | null;
  seller_responded_at: string | null;
  created_at: string;
  buyerName: string;
  buyerAvatar: string | null;
}

interface Stats {
  avg_overall: number;
  avg_product: number;
  avg_shipping: number;
  avg_service: number;
  review_count: number;
}

const StarDisplay = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`h-3.5 w-3.5 ${
          star <= Math.round(rating) ? "text-neon-gold fill-neon-gold" : "text-muted-foreground/20"
        }`}
      />
    ))}
  </div>
);

const SellerReviewsManager = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    const [statsRes, reviewsRes] = await Promise.all([
      supabase.rpc("get_seller_avg_ratings", { _seller_id: user.id }),
      supabase
        .from("reviews")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (statsRes.data && (statsRes.data as any[]).length > 0) {
      const s = (statsRes.data as any[])[0];
      setStats({
        avg_overall: Number(s.avg_overall) || 0,
        avg_product: Number(s.avg_product) || 0,
        avg_shipping: Number(s.avg_shipping) || 0,
        avg_service: Number(s.avg_service) || 0,
        review_count: Number(s.review_count) || 0,
      });
    }

    if (reviewsRes.data && reviewsRes.data.length > 0) {
      const buyerIds = [...new Set(reviewsRes.data.map((r: any) => r.buyer_id))];
      const { data: profiles } = await supabase
        .from("public_profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", buyerIds);

      const mapped: Review[] = reviewsRes.data.map((r: any) => {
        const profile = profiles?.find((p) => p.user_id === r.buyer_id);
        return {
          id: r.id,
          rating_product: r.rating_product,
          rating_shipping: r.rating_shipping,
          rating_service: r.rating_service,
          comment: r.comment,
          seller_response: r.seller_response,
          seller_responded_at: r.seller_responded_at,
          created_at: r.created_at,
          buyerName: profile?.display_name || profile?.username || "Buyer",
          buyerAvatar: profile?.avatar_url || null,
        };
      });
      setReviews(mapped);
    }

    setLoading(false);
  };

  const handleSubmitResponse = async (reviewId: string) => {
    if (!responseText.trim()) {
      toast({ title: "Please enter a response", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc("seller_respond_to_review" as any, {
      _review_id: reviewId,
      _response: responseText.trim(),
    } as any);

    if (error) {
      toast({ title: "Failed to submit response", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Response submitted successfully!" });
      setRespondingTo(null);
      setResponseText("");
      fetchData();
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <AgeversLoader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-black tracking-wider text-foreground">MY REVIEWS</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage and respond to buyer feedback</p>
      </div>

      {/* Stats summary */}
      {stats && stats.review_count > 0 && (
        <div className="glass rounded-xl p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Overall</p>
              <p className="font-display text-3xl font-black text-foreground">{stats.avg_overall.toFixed(1)}</p>
              <StarDisplay rating={stats.avg_overall} />
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Product</p>
              <p className="font-display text-2xl font-bold text-foreground">{stats.avg_product.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Delivery</p>
              <p className="font-display text-2xl font-bold text-foreground">{stats.avg_shipping.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Service</p>
              <p className="font-display text-2xl font-bold text-foreground">{stats.avg_service.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total</p>
              <p className="font-display text-2xl font-bold text-foreground">{stats.review_count}</p>
              <p className="text-[10px] text-muted-foreground">reviews</p>
            </div>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-xl font-bold text-foreground mb-2">NO REVIEWS YET</h3>
          <p className="text-muted-foreground text-sm">Reviews from buyers will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review, idx) => {
            const avgRating = (review.rating_product + review.rating_shipping + review.rating_service) / 3;
            const isResponding = respondingTo === review.id;

            return (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="glass rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  {review.buyerAvatar ? (
                    <img src={review.buyerAvatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{review.buyerName.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-sm font-bold text-foreground">{review.buyerName}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-neon-green/15 text-neon-green">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <StarDisplay rating={avgRating} />
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{review.comment}</p>

                    {/* Existing seller response */}
                    {review.seller_response && (
                      <div className="mt-3 ml-2 pl-3 border-l-2 border-primary/30">
                        <p className="text-[11px] font-display font-bold text-primary uppercase tracking-wider mb-1">Your Response</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{review.seller_response}</p>
                        {review.seller_responded_at && (
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {new Date(review.seller_responded_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Respond button / form */}
                    {!review.seller_response && !isResponding && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs"
                        onClick={() => { setRespondingTo(review.id); setResponseText(""); }}
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1" />
                        Respond
                      </Button>
                    )}

                    {isResponding && (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          placeholder="Write your response to this review..."
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          className="min-h-[80px] text-sm"
                          maxLength={1000}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSubmitResponse(review.id)}
                            disabled={submitting || !responseText.trim()}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            {submitting ? "Sending..." : "Submit Response"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setRespondingTo(null); setResponseText(""); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SellerReviewsManager;
