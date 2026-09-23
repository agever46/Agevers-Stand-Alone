-- ===== Telegram notification triggers =====
-- Wrapper that fires the telegram-notify edge function via pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_telegram(
  _type text,
  _title text,
  _message text,
  _meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text := 'https://ppernxjnicippytjuxpz.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXJueGpuaWNpcHB5dGp1eHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzE3MTQsImV4cCI6MjA4ODcwNzcxNH0.K8ZQ9lUfEoJ5xeFT-o710RRsyEI9KkLPBM8erXOI_dc';
BEGIN
  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/telegram-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'type', _type,
      'title', _title,
      'message', _message,
      'meta', _meta
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_telegram failed: %', SQLERRM;
END;
$$;

-- 1. New order
CREATE OR REPLACE FUNCTION public.tg_telegram_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM notify_telegram(
    CASE WHEN NEW.price >= 100 THEN 'large_order' ELSE 'order' END,
    'New Order',
    COALESCE(NEW.game_title, 'Unknown product') || ' (' || COALESCE(NEW.platform, '—') || ')',
    jsonb_build_object(
      'Order ID', NEW.id,
      'Price', '€' || NEW.price::text,
      'Quantity', NEW.quantity,
      'Status', NEW.status,
      'Held', NEW.is_held
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_telegram_new_order ON public.orders;
CREATE TRIGGER trg_telegram_new_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_telegram_new_order();

-- 2. New signup (profiles)
CREATE OR REPLACE FUNCTION public.tg_telegram_new_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = NEW.user_id;
  PERFORM notify_telegram(
    'signup',
    'New User Signup',
    COALESCE(NEW.display_name, NEW.username, 'Unnamed user'),
    jsonb_build_object(
      'Username', COALESCE(NEW.username, '—'),
      'Email', COALESCE(_email, '—'),
      'User ID', NEW.user_id
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_telegram_new_signup ON public.profiles;
CREATE TRIGGER trg_telegram_new_signup
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_telegram_new_signup();

-- 3. New support ticket
CREATE OR REPLACE FUNCTION public.tg_telegram_new_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM notify_telegram(
    'ticket',
    'New Support Ticket',
    COALESCE(NEW.issue_type, 'Issue') || ' — ' || LEFT(COALESCE(NEW.message, ''), 200),
    jsonb_build_object(
      'Ticket ID', NEW.id,
      'Buyer', COALESCE(NEW.buyer_email, '—'),
      'Order ID', COALESCE(NEW.order_id::text, '—')
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_telegram_new_ticket ON public.support_tickets;
CREATE TRIGGER trg_telegram_new_ticket
AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.tg_telegram_new_ticket();

-- 4. New live chat request
CREATE OR REPLACE FUNCTION public.tg_telegram_new_live_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM notify_telegram(
    'live_chat',
    'New Live Chat Request',
    'Customer is waiting for a live agent',
    jsonb_build_object(
      'Request ID', NEW.id,
      'Email', COALESCE(NEW.user_email, '—'),
      'Status', NEW.status
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_telegram_new_live_chat ON public.live_support_requests;
CREATE TRIGGER trg_telegram_new_live_chat
AFTER INSERT ON public.live_support_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_telegram_new_live_chat();

-- 5. Negative review (1-2 stars on product rating)
CREATE OR REPLACE FUNCTION public.tg_telegram_negative_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.rating_product IS NOT NULL AND NEW.rating_product <= 2 THEN
    PERFORM notify_telegram(
      'negative_review',
      'Negative Review (' || NEW.rating_product || '★)',
      LEFT(COALESCE(NEW.comment, '(no comment)'), 300),
      jsonb_build_object(
        'Review ID', NEW.id,
        'Order ID', COALESCE(NEW.order_id::text, '—'),
        'Product rating', NEW.rating_product,
        'Service rating', COALESCE(NEW.rating_service::text, '—')
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_telegram_negative_review ON public.reviews;
CREATE TRIGGER trg_telegram_negative_review
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.tg_telegram_negative_review();

-- 6. Withdrawal/refund paid out
CREATE OR REPLACE FUNCTION public.tg_telegram_withdrawal_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND COALESCE(OLD.status, '') <> 'paid' THEN
    PERFORM notify_telegram(
      'withdrawal',
      'Withdrawal Paid Out',
      '€' || NEW.amount::text || ' via ' || COALESCE(NEW.method, '—'),
      jsonb_build_object(
        'Withdrawal ID', NEW.id,
        'Seller ID', NEW.seller_id,
        'PayPal email', COALESCE(NEW.paypal_email, '—'),
        'Payoneer email', COALESCE(NEW.payoneer_email, '—')
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_telegram_withdrawal_paid ON public.withdrawal_requests;
CREATE TRIGGER trg_telegram_withdrawal_paid
AFTER UPDATE ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_telegram_withdrawal_paid();

-- 7. Wholesale & Affiliate applications
CREATE OR REPLACE FUNCTION public.tg_telegram_wholesale_inquiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM notify_telegram(
    'wholesale',
    'New Wholesale Inquiry',
    COALESCE(NEW.company_name, 'Unknown company'),
    jsonb_build_object(
      'Email', COALESCE(NEW.contact_email, '—'),
      'Monthly volume', COALESCE(NEW.monthly_order_volume, '—'),
      'Website', COALESCE(NEW.website_url, '—')
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_telegram_wholesale_inquiry ON public.wholesale_inquiries;
CREATE TRIGGER trg_telegram_wholesale_inquiry
AFTER INSERT ON public.wholesale_inquiries
FOR EACH ROW EXECUTE FUNCTION public.tg_telegram_wholesale_inquiry();

CREATE OR REPLACE FUNCTION public.tg_telegram_affiliate_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM notify_telegram(
    'affiliate',
    'New Affiliate Application',
    COALESCE(NEW.full_name, 'Unknown applicant'),
    jsonb_build_object(
      'Email', COALESCE(NEW.email, '—'),
      'Niche', COALESCE(NEW.primary_niche, '—'),
      'Followers', COALESCE(NEW.follower_count, '—')
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_telegram_affiliate_application ON public.affiliate_applications;
CREATE TRIGGER trg_telegram_affiliate_application
AFTER INSERT ON public.affiliate_applications
FOR EACH ROW EXECUTE FUNCTION public.tg_telegram_affiliate_application();