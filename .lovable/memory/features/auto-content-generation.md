---
name: auto-content-generation
description: מערכת ייצור תוכן אוטומטית - מאמר חדשות יומי (Cron 09:00 UTC) ומחולל מדריכי קנייה למוצרים פופולריים, שניהם דרך Lovable AI עם פלט SEO מובנה
type: feature
---
# Auto Content Generation

## Daily News (`auto-generate-news`)
- Cron job `auto-generate-news-daily` runs at 09:00 UTC.
- Pulls a fresh trending topic from public gaming RSS feeds (IGN, GameSpot, Eurogamer, PC Gamer, Rock Paper Shotgun). Picks 2 random feeds per run, then a random recent item.
- Generates 500-800 word article via `google/gemini-2.5-flash` with structured tool-calling output (title/excerpt/content/meta/tags).
- Auto-publishes into `news_articles` under category slug `industry` and pings IndexNow.
- Manual trigger: "Auto-Generate Today's News" button in `AdminNews`.
- Body params (all optional): `category_slug`, `topic` (custom override), `auto_publish` (default true).

## Buying Guides (`auto-generate-guide`)
- Cron job `auto-generate-guide-daily` runs at 12:00 UTC and generates 1 new guide for the top-selling product without an existing guide.
- Also triggerable manually from `AdminGuides` "Auto-Generate Guides" button with count input (1-20).
- If `product_ids` not given, picks top `limit` products by `sold_count` whose title doesn't already match an existing guide.
- Generates 600-900 word buying guide per product via Gemini with H2 sections (What is X, Worth buying in 2025, How to redeem, Final verdict).
- Auto-publishes into `guide_articles` under category slug `buying-guides` and pings IndexNow.
- 600ms delay between products to avoid rate limits.

## Notes
- Both functions require `LOVABLE_API_KEY` (auto-provisioned).
- Both use Gemini structured outputs via `tool_choice` for reliable JSON.
- Slugs are auto-deduplicated against existing rows.