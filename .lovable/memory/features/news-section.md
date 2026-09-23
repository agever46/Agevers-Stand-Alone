---
name: News section
description: SEO-first News module with categories, NewsArticle JSON-LD, OG tags, related products widget, separate Google News sitemap-news-xml (last 48h), and admin manager with AI draft generator
type: feature
---
**Pages**
- `/news` — landing grid with category pills, ItemList JSON-LD
- `/news/category/:slug` — category archive
- `/news/:slug` — article with H1 headline, H2 subheaders (Markdown ##), NewsArticle JSON-LD (headline, datePublished, dateModified, author, image, publisher Agever's), OG/Twitter meta, Related Products widget (manual override + auto-suggest by tags/title keywords, max 6)

**Sitemaps**
- `sitemap-news-xml` edge function — Google News spec, only articles published in last 48h, includes news:publication, news:title, news:keywords. 5min cache.
- Main `sitemap-xml` extended to include `/news`, all news category and article URLs.
- Both sitemaps registered in `public/robots.txt`.

**Admin**
- `/admin/news` (component `AdminNews.tsx`) — categories CRUD + articles CRUD with image upload, OG image, tags, author, SEO meta, Markdown editor, AI draft generator (uses `generate-descriptions` edge fn with `mode: "news_article"`), related-products picker (search + add up to 6).
- Wired in `AdminNavButtons` under Marketing group.

**DB**
- Tables: `news_categories`, `news_articles` (slug, content, image_url, og_image_url, meta_*, author_name, tags[], is_published, published_at auto-set on first publish, view_count), `news_related_products` (manual link with display_order).
- RLS: public read on active categories / published articles, admin manage all.

**Navbar**: News added as top-level nav item via `nav_menu_items` insert.

**Note**: AI draft generator expects `generate-descriptions` edge function to handle `mode: "news_article"` — may need to extend that function to return `{ title, excerpt, content, meta_title, meta_description, tags }` for news prompts.
