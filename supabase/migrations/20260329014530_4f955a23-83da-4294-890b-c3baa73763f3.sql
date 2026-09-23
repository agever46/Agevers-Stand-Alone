
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS buyer_country text,
  ADD COLUMN IF NOT EXISTS buyer_city text,
  ADD COLUMN IF NOT EXISTS code_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_held boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS held_until timestamptz,
  ADD COLUMN IF NOT EXISTS held_reason text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;
