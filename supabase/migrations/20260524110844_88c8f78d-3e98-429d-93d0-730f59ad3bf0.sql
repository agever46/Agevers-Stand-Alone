-- Remove direct row access policies that expose sensitive data.
-- Winners no longer need direct row access; the masked public RPC (get_public_past_winners) handles display,
-- and admins retain full access via existing admin policies.
DROP POLICY IF EXISTS "Winners can view their own giveaway" ON public.giveaways;

-- Remove the email-based SELECT policy on stock_notifications, which let any user who
-- registered with a given email read prior anonymous subscription records for that email.
-- Admins still manage and view all rows; notification delivery is handled server-side.
DROP POLICY IF EXISTS "Users can view own stock notifications" ON public.stock_notifications;