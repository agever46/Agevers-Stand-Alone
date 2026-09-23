ALTER TABLE public.allowed_products
ADD COLUMN metadata_sync_status text DEFAULT NULL;

COMMENT ON COLUMN public.allowed_products.metadata_sync_status IS 'Metadata sync result: null=not synced, full=complete, partial_kinguin=Kinguin missing data, partial_error=other error';

CREATE INDEX idx_allowed_products_sync_status ON public.allowed_products (metadata_sync_status);