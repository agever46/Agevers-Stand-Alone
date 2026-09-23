---
name: Cart Abandonment Emails
description: Cart snapshots persisted to abandoned_carts table; cron sends one email after 4h
type: feature
---
משתמשים מחוברים — הסל מסונכרן ל-abandoned_carts (debounced 1.5s) דרך useCart.tsx.
Edge function process-abandoned-carts רץ כל שעה (cron), שולח מייל דרך template cart-abandonment למשתמשים עם updated_at בין 4h ל-24h ו-email_sent=false. ה-FBT RPC get_frequently_bought_together נוצרה בנוסף לשימוש עתידי.
