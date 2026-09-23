UPDATE public.fraud_scores fs
SET total_purchases = COALESCE((
  SELECT count(*) FROM public.orders o
  WHERE o.user_id = fs.user_id AND o.status IN ('completed','delivered')
), 0);

DELETE FROM public.fraud_flags f
WHERE f.description LIKE 'Trusted customer:%'
  AND NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = f.user_id AND o.status IN ('completed','delivered')
  );