CREATE OR REPLACE FUNCTION public.enqueue_all_unparaphrased()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inserted_count integer;
  batch uuid := gen_random_uuid();
BEGIN
  INSERT INTO paraphrase_queue (allowed_product_id, batch_id, status)
  SELECT ap.id, batch, 'pending'
  FROM allowed_products ap
  WHERE ap.description_paraphrased = false
    AND ap.description IS NOT NULL
    AND ap.description != ''
    AND NOT EXISTS (
      SELECT 1 FROM paraphrase_queue pq
      WHERE pq.allowed_product_id = ap.id
        AND pq.status IN ('pending', 'processing')
    );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;