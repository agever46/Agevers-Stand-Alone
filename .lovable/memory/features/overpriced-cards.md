---
name: Overpriced cards system
description: Flag overpriced gift cards via is_overpriced column on kinguin_products; stays hidden across syncs
type: feature
---
- `kinguin_products` has `is_overpriced` boolean + `overpriced_marked_at` timestamp.
- Admin disabling a card via `/admin/overpriced-cards` (single or bulk) sets `is_active=false` AND `is_overpriced=true`.
- Re-enabling clears `is_overpriced=false` and nulls `overpriced_marked_at`.
- `kinguin-stock-sync` only iterates `is_active=true` rows, so overpriced (inactive) cards are never reactivated by sync.
- `kinguin-bulk-import` only inserts new links when no existing row, so re-imports won't override the flag.
- Backfill (2026-06): all 2,367 gift cards that were previously deactivated were marked `is_overpriced=true`.
- Price-drop recovery: `recheck-overpriced-cards` edge function re-fetches live Kinguin prices for `is_overpriced=true` rows (oldest `last_stock_check` first, batch limit 200), recomputes sell price with the top-ups pricing ruleset, refreshes stored price/stock, and reports cards whose markup now fits the tier cap. `autoApply:true` clears the flag and reactivates (if stock > 0), source `overpriced-recheck`.
- Admin UI: "Price-drop recovery" panel in `/admin/overpriced-cards` with "Re-check prices" (dry run) and "Check & auto-restore", plus per-row / bulk Restore.
