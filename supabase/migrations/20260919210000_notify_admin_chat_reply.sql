-- Sends a Telegram alert whenever a customer sends a message in live chat,
-- so the admin gets notified even when not on the site. The existing
-- AdminLiveSupportNotifier.tsx (toast + sound) only fires while the admin's
-- browser tab is open with a live Realtime subscription — nothing today
-- reaches the admin when they're away. Reuses the existing
-- public.notify_telegram() helper (same one used by other DB triggers).
CREATE OR REPLACE FUNCTION public.tg_notify_admin_chat_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_email text;
BEGIN
  -- Only customer messages — never re-notify on the admin's own replies.
  IF NEW.sender_role <> 'user' THEN
    RETURN NEW;
  END IF;

  SELECT user_email INTO _user_email
  FROM public.live_support_requests
  WHERE id = NEW.request_id;

  PERFORM public.notify_telegram(
    'chat',
    '💬 Customer replied in live chat',
    COALESCE(_user_email, 'Unknown customer') || ': ' || left(NEW.content, 200),
    jsonb_build_object('request_id', NEW.request_id, 'message_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'tg_notify_admin_chat_reply failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.tg_notify_admin_chat_reply() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_admin_chat_reply ON public.live_chat_messages;
CREATE TRIGGER trg_notify_admin_chat_reply
AFTER INSERT ON public.live_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_admin_chat_reply();
