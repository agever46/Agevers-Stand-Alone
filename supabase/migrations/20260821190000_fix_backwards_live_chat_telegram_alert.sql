-- The "Customer is waiting for a live agent" Telegram alert fires on every
-- INSERT into live_support_requests, including the ones admins create
-- themselves (AdminOrders "chat with buyer", AdminTickets "start live chat",
-- and the automated held-order verification flow) — making it look like a
-- customer is waiting when actually the admin just started the conversation.
-- Track who initiated the request and only alert for genuine customer-side
-- ones (the column defaults to 'customer' so the real customer-facing
-- insert in HelpChatWidget needs no code change).

ALTER TABLE public.live_support_requests
  ADD COLUMN IF NOT EXISTS initiated_by text NOT NULL DEFAULT 'customer';

CREATE OR REPLACE FUNCTION public.tg_telegram_new_live_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.initiated_by = 'customer' THEN
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
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.handle_held_order_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email TEXT;
  v_user_first_name TEXT;
  v_user_full_name TEXT;
  v_request_id UUID;
  v_verification_message TEXT;
BEGIN
  -- Only trigger on HELD status
  IF (TG_OP = 'UPDATE' AND OLD.status != 'held' AND NEW.status = 'held') OR (TG_OP = 'INSERT' AND NEW.status = 'held') THEN

    -- Get user email and name
    SELECT email, (raw_user_meta_data->>'first_name'), (raw_user_meta_data->>'full_name')
    INTO v_user_email, v_user_first_name, v_user_full_name
    FROM auth.users
    WHERE id = NEW.user_id;

    IF v_user_email IS NOT NULL THEN
      -- 1. Ensure a support request exists
      SELECT id INTO v_request_id
      FROM public.live_support_requests
      WHERE user_id = NEW.user_id AND status = 'pending'
      LIMIT 1;

      IF v_request_id IS NULL THEN
        INSERT INTO public.live_support_requests (user_id, user_email, status, initiated_by)
        VALUES (NEW.user_id, v_user_email, 'pending', 'admin')
        RETURNING id INTO v_request_id;
      END IF;

      -- 2. Define the English verification message
      v_verification_message := 'Hi! Your order is currently under a routine security review because your account details (email or phone) don''t match your PayPal payment information. To protect your account and complete the delivery, could you please confirm that you authorized this payment? A screenshot of your PayPal transaction confirmation would help us release the code immediately. Thank you for your patience!';

      -- 3. Insert chat message (System/Admin)
      INSERT INTO public.live_chat_messages (request_id, sender_id, sender_role, content)
      VALUES (v_request_id, '00000000-0000-0000-0000-000000000000', 'admin', v_verification_message);

      -- 4. Note: The fulfill-order function handles the initial email,
      -- but this trigger ensures the chat message is always added.
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
