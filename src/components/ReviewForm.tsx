import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ReviewFormProps {
  orderId: string;
  sellerId: string;
  gameTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const StarRating = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) => {
  const [hover, setHover] = useState(0);

  return (
    <div>
      <label className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
        {label}
      </label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                star <= (hover || value)
                  ? "text-neon-gold fill-neon-gold"
                  : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

const ReviewForm = ({ orderId, sellerId, gameTitle, open, onOpenChange, onSuccess }: ReviewFormProps) => {
  const { user } = useAuth();
  const [ratingProduct, setRatingProduct] = useState(0);
  const [ratingShipping, setRatingShipping] = useState(0);
  const [ratingService, setRatingService] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please log in to leave a review");
      return;
    }
    if (ratingProduct < 1 || ratingShipping < 1 || ratingService < 1) {
      toast.error("Please rate all categories (1-5 stars)");
      return;
    }
    if (!comment.trim()) {
      toast.error("Please write a comment");
      return;
    }
    if (comment.trim().length > 1000) {
      toast.error("Comment must be under 1000 characters");
      return;
    }

    setSubmitting(true);

    // Resolve allowed_product_id from order's game_title for product-page reviews
    let allowedProductId: string | null = null;
    try {
      const { data: order } = await supabase
        .from("orders")
        .select("game_title")
        .eq("id", orderId)
        .maybeSingle();
      if (order?.game_title) {
        const { data: ap } = await supabase
          .from("allowed_products")
          .select("id")
          .ilike("title", order.game_title.trim())
          .maybeSingle();
        allowedProductId = ap?.id || null;
      }
    } catch {
      // non-fatal — review still saved without product link
    }

    const { error } = await supabase.from("reviews" as any).insert({
      order_id: orderId,
      seller_id: sellerId,
      buyer_id: user.id,
      allowed_product_id: allowedProductId,
      rating_product: ratingProduct,
      rating_shipping: ratingShipping,
      rating_service: ratingService,
      comment: comment.trim(),
    } as any);
    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("You already reviewed this order");
      } else {
        toast.error(error.message || "Failed to submit review");
      }
      return;
    }

    toast.success("Review submitted! Thank you for your feedback.");
    onOpenChange(false);
    setRatingProduct(0);
    setRatingShipping(0);
    setRatingService(0);
    setComment("");
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">Leave a Review</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Share your experience with <span className="text-foreground font-semibold">{gameTitle}</span>
        </p>
        <div className="space-y-4 pt-2">
          <StarRating label="Product Quality" value={ratingProduct} onChange={setRatingProduct} />
          <StarRating label="Delivery Speed" value={ratingShipping} onChange={setRatingShipping} />
          <StarRating label="Seller Service" value={ratingService} onChange={setRatingService} />

          <div>
            <label className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Comment
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell others about your experience..."
              maxLength={1000}
              rows={4}
            />
            <span className="text-[11px] text-muted-foreground mt-1 block text-right">
              {comment.length}/1000
            </span>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full font-display tracking-wider gap-2"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Submitting..." : "Submit Review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewForm;
