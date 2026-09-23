
-- Add token columns to orders for buyer upload link (works for guests too)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS id_proof_token text,
  ADD COLUMN IF NOT EXISTS id_proof_token_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_id_proof_token_key
  ON public.orders (id_proof_token) WHERE id_proof_token IS NOT NULL;

-- Verifications table
CREATE TABLE IF NOT EXISTS public.order_id_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  uploader_ip text,
  uploader_user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_id_verifications_order_idx
  ON public.order_id_verifications(order_id, created_at DESC);

GRANT SELECT ON public.order_id_verifications TO authenticated;
GRANT ALL ON public.order_id_verifications TO service_role;

ALTER TABLE public.order_id_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "id_verifications_admin_read" ON public.order_id_verifications
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "id_verifications_admin_delete" ON public.order_id_verifications
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
);

-- Storage policies for private bucket id-verification (path: <order_id>/<file>)
DROP POLICY IF EXISTS "id_verification_admin_read" ON storage.objects;
DROP POLICY IF EXISTS "id_verification_admin_delete" ON storage.objects;

CREATE POLICY "id_verification_admin_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'id-verification' AND (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  )
);

CREATE POLICY "id_verification_admin_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'id-verification' AND (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  )
);
