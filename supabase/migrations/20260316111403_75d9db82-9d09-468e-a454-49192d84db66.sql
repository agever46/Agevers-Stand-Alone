-- Fix search_path on the function
CREATE OR REPLACE FUNCTION public.protect_ticket_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    NEW.admin_note := OLD.admin_note;
    NEW.status := OLD.status;
    NEW.resolution_type := OLD.resolution_type;
    NEW.buyer_email := OLD.buyer_email;
    NEW.buyer_id := OLD.buyer_id;
    NEW.seller_id := OLD.seller_id;
    NEW.order_id := OLD.order_id;
    NEW.issue_type := OLD.issue_type;
    NEW.message := OLD.message;
    NEW.screenshot_url := OLD.screenshot_url;
  END IF;
  RETURN NEW;
END;
$$;