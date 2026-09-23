
-- Restrict seller UPDATEs on reviews to only seller_response / seller_responded_at
CREATE OR REPLACE FUNCTION public.enforce_reviews_seller_update_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  -- If the acting user is the seller (not the buyer), restrict mutable columns
  IF auth.uid() = OLD.seller_id AND auth.uid() IS DISTINCT FROM OLD.user_id THEN
    IF NEW.rating_product   IS DISTINCT FROM OLD.rating_product
    OR NEW.rating_service   IS DISTINCT FROM OLD.rating_service
    OR NEW.rating_shipping  IS DISTINCT FROM OLD.rating_shipping
    OR NEW.comment          IS DISTINCT FROM OLD.comment
    OR NEW.user_id          IS DISTINCT FROM OLD.user_id
    OR NEW.seller_id        IS DISTINCT FROM OLD.seller_id
    OR NEW.product_id       IS DISTINCT FROM OLD.product_id
    OR NEW.order_id         IS DISTINCT FROM OLD.order_id THEN
      RAISE EXCEPTION 'Sellers may only update seller_response fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_reviews_seller_update_columns_trg ON public.reviews;
CREATE TRIGGER enforce_reviews_seller_update_columns_trg
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.enforce_reviews_seller_update_columns();


-- Restrict seller UPDATEs on support_tickets to only seller_response
CREATE OR REPLACE FUNCTION public.enforce_support_tickets_seller_update_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.seller_id AND auth.uid() IS DISTINCT FROM OLD.user_id THEN
    IF NEW.status           IS DISTINCT FROM OLD.status
    OR NEW.admin_note       IS DISTINCT FROM OLD.admin_note
    OR NEW.buyer_email      IS DISTINCT FROM OLD.buyer_email
    OR NEW.resolution_type  IS DISTINCT FROM OLD.resolution_type
    OR NEW.user_id          IS DISTINCT FROM OLD.user_id
    OR NEW.seller_id        IS DISTINCT FROM OLD.seller_id
    OR NEW.subject          IS DISTINCT FROM OLD.subject
    OR NEW.message          IS DISTINCT FROM OLD.message THEN
      RAISE EXCEPTION 'Sellers may only update seller_response';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_support_tickets_seller_update_columns_trg ON public.support_tickets;
CREATE TRIGGER enforce_support_tickets_seller_update_columns_trg
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.enforce_support_tickets_seller_update_columns();
