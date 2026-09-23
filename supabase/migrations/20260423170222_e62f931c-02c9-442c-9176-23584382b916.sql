CREATE TABLE public.title_correction_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern TEXT NOT NULL,
  replacement TEXT NOT NULL,
  type_hint TEXT,
  example_old TEXT,
  example_new TEXT,
  hits INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX title_correction_rules_pattern_key ON public.title_correction_rules (pattern);
CREATE INDEX title_correction_rules_active_idx ON public.title_correction_rules (is_active) WHERE is_active = true;

ALTER TABLE public.title_correction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage title correction rules"
ON public.title_correction_rules
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));