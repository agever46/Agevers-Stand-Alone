ALTER TABLE kinguin_products DROP CONSTRAINT kinguin_products_allowed_product_id_fkey;
ALTER TABLE kinguin_products ADD CONSTRAINT kinguin_products_allowed_product_id_fkey
  FOREIGN KEY (allowed_product_id) REFERENCES allowed_products(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION delete_allowed_products_bulk(product_ids UUID[])
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM products WHERE title IN (
    SELECT title FROM allowed_products WHERE id = ANY(product_ids)
  );
  DELETE FROM allowed_products WHERE id = ANY(product_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;