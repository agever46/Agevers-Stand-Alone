# Fix the new-account 24h limit behaviour

Two separate problems, verified against the live data and code.

## What I found

1. **The silent check can almost never clear a new account.**
   The user who registered today (08:12 UTC) has `new_account_limit_exempt = false` and no fraud flag. The risk cache shows only an **email** check for that signup at 08:13:57 — no IP check at all. The silent check requires *both* a clean email **and** a real IP signal; when the IP can't be resolved from the request headers it silently gives up and leaves the account restricted. That is exactly what happened, so the account still sees the yellow banner and the €20 cap.

2. **Buy Now / Add to Cart look clickable but do nothing.**
   The gating UI that used to grey out purchase buttons for restricted accounts was removed. Enforcement now lives only inside the cart: the click is accepted, the cart silently refuses the item and only a toast fires (which is easy to miss), so the buttons feel dead.

## What will be built

### A. Make the silent check work

- Harden IP resolution in the signup pre-check: try all proxy headers in order (`cf-connecting-ip`, `true-client-ip`, `x-real-ip`, `x-forwarded-for`, `fly-client-ip`, `x-envoy-external-address`, `forwarded`), and if none is usable, resolve the caller IP through a lookup instead of skipping the check.
- Keep the security bar unchanged: clearance still requires a real IP signal that is clean (no Tor/bot/very-high fraud score) **plus** a clean email. VPN/proxy alone still does not disqualify.
- Record the outcome either way (a low-severity flag with the resolved IP and the reason), so it is visible in the Fraud dashboard why an account was or wasn't auto-cleared.
- Run the pre-check on **all** signup paths, not just email+OTP: also after Google/Apple sign-in for accounts younger than 24h that have not been evaluated yet, and once on login if it never ran.
- After the check returns, refresh the client-side limit state so the yellow banner and the buttons unlock immediately, without needing a re-login.

### B. Correct UI for accounts that really are restricted

- Restore explicit gating in `GameCard`, `ProductDetail` and `GameGroupPage`: when the account is limited and the product (or the resulting cart total) exceeds €20, **Add to Cart and Buy Now render greyed out and non-clickable**, with a short tooltip explaining the 24h new-account limit.
- The product tile itself stays clickable — the shopper can still open the product page and read all details; the purchase buttons there are greyed out with the same tooltip.
- No navigation to checkout ever happens when the item was refused, and no false "Added to cart" toast.
- The yellow banner keeps showing only while the account is genuinely limited, and disappears as soon as the account is cleared.

## Technical notes

- Edge function: `supabase/functions/fraud-check/index.ts`, action `auto_precheck_new_account` (IP resolution, flag logging, unchanged clearance criteria).
- Client: `src/hooks/useNewAccountLimit.ts` (expose a refresh + a `loaded` state so gating never flashes), `src/hooks/useCart.tsx` (already exposes `canAddItem`, kept as the source of truth), `src/components/GameCard.tsx`, `src/pages/ProductDetail.tsx`, `src/pages/GameGroupPage.tsx`, `src/components/NewAccountLimitBanner.tsx`, `src/pages/Auth.tsx` (pre-check on OAuth/login paths).
- Server-side enforcement in `fraud-check` at purchase time is unchanged — the UI work is only about showing the same rule earlier and honestly.
- The fraud-check function must be redeployed after the change.
