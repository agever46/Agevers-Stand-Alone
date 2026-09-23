
INSERT INTO public.giveaways (title, description, ends_at, prize_image_url, status)
VALUES (
  '100 EUR Agever''s Gift Card',
  'Win a 100 EUR gift card to spend on anything at Agever''s! Games, Software, Subscriptions - the choice is yours.',
  NOW() + INTERVAL '5 days',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=2070',
  'active'
);
