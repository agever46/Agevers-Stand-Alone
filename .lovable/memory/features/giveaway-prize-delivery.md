---
name: Giveaway Prize Delivery
description: מערכת מסירת פרסי הגרלות עם תמיכה ב-multi-winner/multi-code, עריכת הגרלה קיימת, רכישה אוטומטית מ-Kinguin או הזנה ידנית, ומייל אוטומטי לכל זוכה
type: feature
---
Multi-prize: שדה prize_count ב-giveaways (1-50) קובע כמה קודים מחולקים. הטבלה giveaway_prizes מאפשרת כעת מספר שורות לכל giveaway_id (ה-Unique הקודם בוטל; הוחלף ב-unique (giveaway_id, game_code)). כל זוכה יכול לקבל יותר מקוד אחד.

Edit dialog: כפתור Pencil בכל הגרלה פותח דיאלוג עריכה לכל השדות (title, description, prize_image_url, allowed_product_id, ends_at, prize_count). לא ניתן להפחית prize_count מתחת לכמות שכבר נמסרה.

Seeded fake winners: עמודת giveaways.seeded_winners (jsonb, [{email, entries, bonus}]). בדיאלוג העריכה באדמין יש Textarea (שורה לכל זוכה: email[:entries[:bonus]]). giveaway-auto-finalize מזריק אותם ככניסות is_fake (UUID אקראי) אם האימייל עוד לא קיים, ומוכתר כל הכניסות המזויפות כזוכי פרסים (game_code SEEDED-<id8>-<n>, source manual, email_status skipped) — בלי רכישת Kinguin ובלי מיילים. גם כשהזוכה הראשי אמיתי. פרס הזוכה האמיתי נשמר ב-INSERT (לא upsert) ועדכון email_status ממוקד לשורת הזוכה בלבד.

Delivery flow: Crown מ-Entries → אם אין winner ראשי, הוא נקבע; אחרת רק נוסף ל-giveaway_prizes. כפתור Deliver זמין כל עוד prizes_delivered < prize_count. Edge function giveaway-deliver-prize מקבל winner_user_id/winner_email אופציונליים, סופר prizes קיימים ובולם חריגה, ומשתמש ב-INSERT (לא upsert).
