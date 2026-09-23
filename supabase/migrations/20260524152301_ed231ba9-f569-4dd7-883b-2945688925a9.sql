ALTER TABLE public.live_support_requests
  ADD COLUMN IF NOT EXISTS buyer_last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_buyer_notify_at TIMESTAMPTZ;