---
name: Receipts via Invoice Maven
description: Tax-exempt receipts (עוסק פטור) generated through Invoice Maven, with global on/off toggle and Sandbox test mode at /admin/receipts
type: feature
---
מערכת הקבלות מבוססת Invoice Maven API לעוסק פטור (doc_type: 400, no_vat: 1, currency: EUR=3). המרה לשקלים לדיווח מס נעשית בצד Invoice Maven אוטומטית.

**ניהול:** `/admin/receipts` (קישור "Receipts" בתפריט הניווט של האדמין).
- **Toggle הפעלה/כיבוי**: עמודת `site_settings.receipts_enabled` (boolean, ברירת מחדל false). כשכבוי - כפתור "Receipt" מוסתר ממשתמשים וה-edge function מחזירה 503.
- **Sandbox Mode**: כפתור "Test" לכל הזמנה שמוחזרת ושדה להזנת Order ID ידני. שולח `test: true` ל-edge function שמתרגם ל-`test: 1` בקריאה ל-Invoice Maven. עוקף את ה-cache, עוקף את ה-toggle (אדמין בלבד), ו-Invoice Maven לא שומרים את המסמך.

**Edge Function:** `generate-receipt` שולח `paypal_transaction_number` מ-`paypal_order_id` לתיעוד מדויק. Cache בטבלת `order_invoices` עם `is_test=false` בלבד (טסטים אינם מקושטים).
