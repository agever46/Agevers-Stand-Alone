DELETE FROM product_keys WHERE seller_id NOT IN (SELECT id FROM auth.users);
DELETE FROM seller_sales WHERE seller_id NOT IN (SELECT id FROM auth.users);
DELETE FROM orders WHERE user_id NOT IN (SELECT id FROM auth.users);