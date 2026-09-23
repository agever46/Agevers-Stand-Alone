-- Reset stuck paraphrasing items back to idle
UPDATE allowed_products 
SET paraphrase_status = 'idle', paraphrase_locked_at = NULL 
WHERE paraphrase_status = 'processing';
