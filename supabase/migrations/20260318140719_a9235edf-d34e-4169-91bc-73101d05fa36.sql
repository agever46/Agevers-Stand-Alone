
ALTER TABLE public.user_coins 
  ALTER COLUMN balance TYPE numeric USING balance::numeric,
  ALTER COLUMN total_earned TYPE numeric USING total_earned::numeric,
  ALTER COLUMN total_spent TYPE numeric USING total_spent::numeric;
