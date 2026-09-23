-- Reset email_verified for users who registered via email provider but never used a verification token
UPDATE public.profiles p
SET email_verified = false, updated_at = now()
FROM auth.users u
WHERE p.user_id = u.id
  AND p.email_verified = true
  AND (u.raw_app_meta_data->>'provider') = 'email'
  AND NOT EXISTS (
    SELECT 1 FROM public.email_verification_tokens t
    WHERE t.user_id = u.id AND t.used = true
  );