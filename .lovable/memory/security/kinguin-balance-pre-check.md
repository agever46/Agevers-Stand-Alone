---
name: Kinguin balance hold (security review)
description: fulfill-order holds the order with "Security Review" message when Kinguin balance < required cost (5% buffer). Payment IS captured.
type: feature
---
**Trigger:** `fulfill-order` edge function, AFTER PayPal capture succeeds, BEFORE order row is finalized.

**Logic:**
1. Only runs when `deferredKinguin` is set (item must be fulfilled via Kinguin API).
2. Fetches live balance from `https://gateway.kinguin.net/esa/api/v1/balance`.
3. If `balance < (expected_price × qty) × 1.05` → flips `_holdForBalance = true`.
4. Order saved with `is_held=true`, `status='held'`, `held_reason='Security review — manual verification required (ref: SR-XXXX)'`, `held_until = now()+1h`.
5. Telegram alert sent (type=stock, ⏸ prefix) with required amount + current balance so admin can top up.

**Critical:** Payment IS captured — this is intentional. The hold gives admin time to top up Kinguin and manually fulfill via /admin/orders. Customer sees friendly "Under Security Review" banner in `AccountOrders.tsx` (no mention of stock, balance, or supplier).

**Why this design (not pre-payment block):** Customer feels normal flow, admin gets a real sale + window to recover, no Out-of-Stock churn or chargeback exposure from refunds.
