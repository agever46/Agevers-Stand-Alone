-- Fix region for Steam Wallet products with country codes incorrectly marked Global

UPDATE allowed_products SET region = 'Bhutan'
WHERE LOWER(store) = 'steam' AND title ~ 'Gift Card Bt -' AND region = 'Global';

UPDATE allowed_products SET region = 'Sri Lanka'
WHERE LOWER(store) = 'steam' AND title ~ 'Gift Card Lk -' AND region = 'Global';

UPDATE allowed_products SET region = 'Maldives'
WHERE LOWER(store) = 'steam' AND title ~ 'Gift Card MV -' AND region = 'Global';

UPDATE allowed_products SET region = 'Uruguay'
WHERE LOWER(store) = 'steam' AND title ~ 'Gift Card Uy -' AND region = 'Global';