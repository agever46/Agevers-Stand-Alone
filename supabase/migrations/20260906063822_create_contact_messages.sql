-- Fixes the Contact Us form, which currently has no submit handler at all
-- (onSubmit={(e) => e.preventDefault()} — every "Send Message" click does
-- nothing). This form must work for logged-out visitors too (it's a general
-- contact page, not tied to an account), so it can't go through
-- send-transactional-email directly from the client — that function
-- requires a resolvable authenticated user even with a valid anon-role JWT,
-- which a logged-out visitor doesn't have. Same pattern already used
-- elsewhere in this project (e.g. tg_admin_email_new_order): a public,
-- RLS-permitted insert, notified server-side by a SECURITY DEFINER trigger
-- using the internal-notify-token from Vault.

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone (including logged-out visitors) can submit — same pattern as
-- page_views ("Anyone can log page views").
CREATE POLICY "Anyone can submit a contact message"
  ON public.contact_messages
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view contact messages"
  ON public.contact_messages
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can update contact messages"
  ON public.contact_messages
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Notify admin by email whenever a new message comes in.
CREATE OR REPLACE FUNCTION public.tg_notify_admin_contact_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _url text := 'https://ppernxjnicippytjuxpz.supabase.co';
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXJueGpuaWNpcHB5dGp1eHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzE3MTQsImV4cCI6MjA4ODcwNzcxNH0.K8ZQ9lUfEoJ5xeFT-o710RRsyEI9KkLPBM8erXOI_dc';
  _token text;
BEGIN
  SELECT decrypted_secret INTO _token
  FROM vault.decrypted_secrets WHERE name = 'internal_notify_token' LIMIT 1;

  PERFORM net.http_post(
    url := _url || '/functions/v1/send-transactional-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon,
      'x-internal-token', _token
    ),
    body := jsonb_build_object(
      'templateName', 'contact-form-message',
      'recipientEmail', 'admin@agevers.com',
      'idempotencyKey', 'contact-message-' || NEW.id::text,
      'templateData', jsonb_build_object(
        'name', NEW.name,
        'email', NEW.email,
        'message', NEW.message
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'tg_notify_admin_contact_message failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_contact_message ON public.contact_messages;
CREATE TRIGGER trg_notify_admin_contact_message
AFTER INSERT ON public.contact_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_admin_contact_message();

-- Note: this trigger depends on the 'internal_notify_token' Vault secret
-- created by the earlier fix_hardcoded_internal_token.sql migration — run
-- that one first if you haven't already.
