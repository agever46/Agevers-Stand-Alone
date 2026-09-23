
ALTER TABLE public.product_keys 
ADD COLUMN allowed_product_id uuid REFERENCES public.allowed_products(id) ON DELETE SET NULL;

-- RLS: Allow admins to manage keys with allowed_product_id
-- (existing admin policy already covers ALL on product_keys)
