CREATE TABLE public.free_gift_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    allowed_product_id uuid REFERENCES public.allowed_products(id) ON DELETE CASCADE NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.free_gift_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_gift_products TO authenticated;
GRANT ALL ON public.free_gift_products TO service_role;

ALTER TABLE public.free_gift_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view free gift products" ON public.free_gift_products
    FOR SELECT USING (true);

CREATE POLICY "Admins manage free gift products" ON public.free_gift_products
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.free_gift_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    allowed_product_id uuid NOT NULL REFERENCES public.allowed_products(id) ON DELETE CASCADE,
    paypal_order_id text UNIQUE NOT NULL,
    order_id uuid,
    claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX free_gift_claims_one_per_user ON public.free_gift_claims (user_id);

GRANT SELECT ON public.free_gift_claims TO authenticated;
GRANT ALL ON public.free_gift_claims TO service_role;

ALTER TABLE public.free_gift_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own claims" ON public.free_gift_claims
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all claims" ON public.free_gift_claims
    FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));