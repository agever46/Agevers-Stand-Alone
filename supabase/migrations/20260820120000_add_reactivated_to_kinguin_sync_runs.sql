ALTER TABLE public.kinguin_sync_runs
  ADD COLUMN IF NOT EXISTS reactivated integer NOT NULL DEFAULT 0;
