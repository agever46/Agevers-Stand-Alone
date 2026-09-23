
ALTER TABLE public.support_tickets 
  ADD COLUMN IF NOT EXISTS resolution_type TEXT,
  ADD COLUMN IF NOT EXISTS seller_response TEXT;

-- Update existing admin policies don't need changes since admin can already view/update all
