
-- 1. Delete orphaned fraud_scores (users no longer in auth.users)
DELETE FROM public.fraud_scores
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 2. Delete orphaned fraud_flags
DELETE FROM public.fraud_flags
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 3. Add FK with CASCADE on fraud_scores.user_id
ALTER TABLE public.fraud_scores
  ADD CONSTRAINT fraud_scores_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Add FK with CASCADE on fraud_flags.user_id
ALTER TABLE public.fraud_flags
  ADD CONSTRAINT fraud_flags_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
