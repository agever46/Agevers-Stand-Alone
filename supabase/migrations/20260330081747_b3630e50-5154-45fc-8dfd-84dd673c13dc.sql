
-- Create RPC to get public reviews with buyer display names (no buyer_id exposed)
CREATE OR REPLACE FUNCTION public.get_public_reviews(_seller_id uuid, _limit integer DEFAULT 50)
RETURNS TABLE(
  id uuid,
  rating_product integer,
  rating_shipping integer,
  rating_service integer,
  comment text,
  created_at timestamptz,
  seller_response text,
  buyer_display_name text,
  buyer_avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.rating_product,
    r.rating_shipping,
    r.rating_service,
    r.comment,
    r.created_at,
    r.seller_response,
    COALESCE(p.display_name, p.username, 'Buyer') as buyer_display_name,
    p.avatar_url as buyer_avatar_url
  FROM reviews r
  LEFT JOIN public_profiles p ON p.user_id = r.buyer_id
  WHERE r.seller_id = _seller_id
  ORDER BY r.created_at DESC
  LIMIT _limit;
$$;
