-- Fix SECURITY DEFINER Views (Lint 0010)
ALTER VIEW public.products_public SET (security_invoker = true);
ALTER VIEW public.public_profiles SET (security_invoker = true);
ALTER VIEW public.product_reviews_public SET (security_invoker = true);
ALTER VIEW public.reviews_public SET (security_invoker = true);

-- Fix Function Search Path Mutable (Lint 0011)
ALTER FUNCTION public.handle_held_order_notification() SET search_path = public;
