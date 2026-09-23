---
name: New Account €20/24h Limit Disclosure
description: Where the €20/24h new-account purchase limit is communicated to users (banner, FAQ, verification email)
type: feature
---
The fraud-check rule that blocks new accounts from purchases >€20 in the first 24h is disclosed proactively in 3 places:

1. **Account Overview banner** (`src/components/account/AccountOverview.tsx`) — Blue banner with live countdown (hours+minutes) shown only while user is <24h old. Auto-hides after 24h. Links to /contact for manual review.
2. **FAQ entry** (`src/pages/FAQ.tsx`) — "Why can't my new account purchase more than €20 in the first 24 hours?" — explains the rule + how to request manual review.
3. **Verification email** (`supabase/functions/_shared/transactional-email-templates/email-verification.tsx`) — Blue info box right after the amber 3-day verification warning. First email a user gets.
4. **Checkout block** (`src/pages/Checkout.tsx`) — When the rule actually fires, shows clean explanation + Live Chat button (if `isHumanAvailable()`) or Email Us mailto fallback. Edge function returns reason prefixed with `NEW_ACCOUNT_LIMIT|` so frontend can render the friendly version.
