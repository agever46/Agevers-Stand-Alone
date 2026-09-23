
CREATE TABLE public.paraphrase_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allowed_product_id uuid NOT NULL REFERENCES public.allowed_products(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_paraphrase_queue_status ON public.paraphrase_queue(status);
CREATE INDEX idx_paraphrase_queue_batch ON public.paraphrase_queue(batch_id);

ALTER TABLE public.paraphrase_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage paraphrase queue"
ON public.paraphrase_queue
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage paraphrase queue"
ON public.paraphrase_queue
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
