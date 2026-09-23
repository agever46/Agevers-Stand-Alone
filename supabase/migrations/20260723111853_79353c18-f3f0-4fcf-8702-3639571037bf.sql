DELETE FROM public.news_related_products WHERE article_id = 'b1c8913e-6313-4718-8df3-fefb169107ec';

INSERT INTO public.news_articles (title, slug, excerpt, content, category_id, image_url, og_image_url, author_name, published_at, is_published, tags)
SELECT
  'EA Sports FC 27 revealed: Kylian Mbappé is the Ultimate Edition cover star, gameplay reveal set for July 23',
  'ea-sports-fc-27-mbappe-cover-reveal',
  'Electronic Arts has confirmed Kylian Mbappé as the cover athlete for EA Sports FC 27 Ultimate Edition — his first solo cover in four years — ahead of the official gameplay reveal on July 23.',
  E'## Mbappé is back on the cover of EA Sports FC\n\nElectronic Arts has officially revealed **Kylian Mbappé** as the cover athlete of **EA Sports FC 27 Ultimate Edition**. It marks the French forward''s return to the franchise cover for the first time in four years, and EA confirmed the reveal across its official social channels.\n\n## What EA has officially confirmed\n\n- **Cover athlete:** Kylian Mbappé on the Ultimate Edition of EA Sports FC 27.\n- **Gameplay reveal:** Scheduled for **Thursday, July 23**, when EA is expected to unveil the game''s new features in full.\n- **Editions:** Ultimate Edition confirmed; additional editions are expected to be detailed at the reveal event.\n\n## What is still unconfirmed\n\nAt the time of writing, EA has **not** officially confirmed the following, despite widespread reporting and speculation:\n\n- The final list of supported platforms.\n- The exact release date (the franchise traditionally launches in late September).\n- Specific gameplay systems, modes, or engine changes.\n- Pricing for Standard and Ultimate editions.\n\nAll of the above are expected to be addressed during the **July 23 reveal**.\n\n## Why the reveal matters\n\nMbappé''s return as a solo cover athlete signals a more traditional marketing cycle for EA Sports FC 27 after the multi-athlete covers used in recent years. With the World Cup cycle behind it, EA is positioning FC 27 as a headline release for the football calendar.\n\nAgever''s will cover the July 23 reveal as soon as the official announcements go live.',
  (SELECT category_id FROM public.news_articles WHERE id = 'b1c8913e-6313-4718-8df3-fefb169107ec'),
  (SELECT image_url FROM public.news_articles WHERE id = 'b1c8913e-6313-4718-8df3-fefb169107ec'),
  (SELECT og_image_url FROM public.news_articles WHERE id = 'b1c8913e-6313-4718-8df3-fefb169107ec'),
  'Agever''s Editorial',
  now(),
  true,
  ARRAY['EA Sports FC 27','Football','Mbappé','Trending']
WHERE NOT EXISTS (SELECT 1 FROM public.news_articles WHERE slug = 'ea-sports-fc-27-mbappe-cover-reveal');

DELETE FROM public.news_articles WHERE id = 'b1c8913e-6313-4718-8df3-fefb169107ec';