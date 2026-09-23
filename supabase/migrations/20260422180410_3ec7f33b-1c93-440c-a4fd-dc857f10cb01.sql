CREATE TABLE public.kinguin_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  mode text NOT NULL DEFAULT 'batched',
  batch_size integer NOT NULL DEFAULT 0,
  total_processed integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  deactivated integer NOT NULL DEFAULT 0,
  price_changed integer NOT NULL DEFAULT 0,
  expired integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kinguin_sync_runs_started_at ON public.kinguin_sync_runs(started_at DESC);

ALTER TABLE public.kinguin_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync runs"
  ON public.kinguin_sync_runs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert sync runs"
  ON public.kinguin_sync_runs FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update sync runs"
  ON public.kinguin_sync_runs FOR UPDATE
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');