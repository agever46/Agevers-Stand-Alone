
DROP TRIGGER IF EXISTS trg_sync_email_verified ON auth.users;
DROP FUNCTION IF EXISTS public.sync_email_verified_from_auth();

-- Revert backfill: for email/password users who did NOT actually complete
-- a token-based verification, mark them as unverified again.
UPDATE public.profiles p
SET email_verified = false, updated_at = now()
FROM auth.users u
WHERE p.user_id = u.id
  AND (u.raw_app_meta_data->>'provider') = 'email'
  AND p.email_verified = true
  AND NOT EXISTS (
    SELECT 1 FROM public.email_verification_tokens t
    WHERE t.user_id = u.id AND t.used = true
  );
