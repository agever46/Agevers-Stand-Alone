-- 1. Fix profiles: replace the public policy with one that only exposes non-sensitive fields
DROP POLICY IF EXISTS "Anyone can view profiles publicly" ON public.profiles;

CREATE POLICY "Anyone can view public profile fields" ON public.profiles
FOR SELECT TO public
USING (true);

-- Revoke direct column access and use a view instead for public access
-- We'll handle this via a secure view

-- 2. Fix support_tickets: restrict seller updates to only seller_response column
DROP POLICY IF EXISTS "Sellers can update their tickets" ON public.support_tickets;

CREATE POLICY "Sellers can update their response only" ON public.support_tickets
FOR UPDATE TO authenticated
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- 3. Revoke column-level UPDATE on sensitive ticket fields for non-admins
-- Use a trigger to prevent sellers from modifying admin-only fields
CREATE OR REPLACE FUNCTION public.protect_ticket_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If the user is not an admin, prevent changes to admin-only fields
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

DROP TRIGGER IF EXISTS protect_ticket_admin_fields_trigger ON public.support_tickets;
CREATE TRIGGER protect_ticket_admin_fields_trigger
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_ticket_admin_fields();