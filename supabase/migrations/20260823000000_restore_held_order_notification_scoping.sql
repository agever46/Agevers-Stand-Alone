-- Restore the held_reason scoping on handle_held_order_notification.
--
-- Migration 20260819190000 (the live-chat Telegram alert fix) accidentally
-- reverted this function back to firing unconditionally on status = 'held',
-- undoing the 20260819060000 fix that scoped it to PayPal identity-mismatch
-- holds only. That regression sat alongside fulfill-order's own (now
-- correctly-scoped) notification logic, so every held order was getting two
-- chat messages: one accurate, one always claiming a PayPal mismatch.
--
-- This restores the 20260819060000 body verbatim, with only the
-- initiated_by = 'admin' addition carried forward on the live_support_requests
-- insert (so the Telegram "customer is waiting" alert still doesn't fire for
-- this system-generated request).
CREATE OR REPLACE FUNCTION public.handle_held_order_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email TEXT;
  v_user_first_name TEXT;
  v_user_full_name TEXT;
  v_request_id UUID;
  v_verification_message TEXT;
BEGIN
  -- Fire specifically for PayPal identity-mismatch holds. Stock/fulfillment
  -- holds from reveal-and-fulfill also set is_held = true, but with a
  -- different held_reason ("Out of stock...", "Reveal-time fulfillment
  -- error...") — those need a different message entirely and are out of
  -- scope for this trigger.
  IF NEW.is_held = true
     AND NEW.held_reason LIKE 'PayPal identity mismatch%'
     AND (
       TG_OP = 'INSERT'
       OR OLD.is_held IS DISTINCT FROM true
       OR OLD.held_reason IS DISTINCT FROM NEW.held_reason
     )
  THEN
    SELECT email, (raw_user_meta_data->>'first_name'), (raw_user_meta_data->>'full_name')
    INTO v_user_email, v_user_first_name, v_user_full_name
    FROM auth.users
    WHERE id = NEW.user_id;

    IF v_user_email IS NOT NULL THEN
      -- 1. Ensure a live-support request exists for the chat message
      SELECT id INTO v_request_id
      FROM public.live_support_requests
      WHERE user_id = NEW.user_id AND status = 'pending'
      LIMIT 1;

      IF v_request_id IS NULL THEN
        INSERT INTO public.live_support_requests (user_id, user_email, status, initiated_by)
        VALUES (NEW.user_id, v_user_email, 'pending', 'admin')
        RETURNING id INTO v_request_id;
      END IF;

      v_verification_message := 'Hi! Your order is currently under a routine security review because your account details (email or phone) don''t match your PayPal payment information. To protect your account and complete the delivery, could you please confirm that you authorized this payment? A screenshot of your PayPal transaction confirmation would help us release the code immediately. Thank you for your patience!';

      -- 2. Chat message
      INSERT INTO public.live_chat_messages (request_id, sender_id, sender_role, content)
      VALUES (v_request_id, '00000000-0000-0000-0000-000000000000', 'admin', v_verification_message);

      -- 3. Email — dispatched right here so it fires atomically with the
      -- chat message the moment the hold is applied, regardless of which
      -- code path set it.
      PERFORM net.http_post(
        url := 'https://ppernxjnicippytjuxpz.supabase.co/functions/v1/send-transactional-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
        ),
        body := jsonb_build_object(
          'templateName', 'order-verification-required',
          'recipientEmail', v_user_email,
          'idempotencyKey', 'verify-required-' || NEW.id::text,
          'templateData', jsonb_build_object(
            'customerName', COALESCE(v_user_first_name, v_user_full_name),
            'productTitle', NEW.game_title,
            'orderId', NEW.id,
            'amount', '€' || to_char(NEW.price, 'FM999999990.00'),
            'verificationMessage', v_verification_message
          )
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_held_order_notification ON public.orders;
CREATE TRIGGER trg_held_order_notification
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_held_order_notification();
