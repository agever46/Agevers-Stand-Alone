-- Update the trigger function to include the English verification message in the email notification flow
-- and ensure it's sent whenever an order is held.

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
        INSERT INTO public.live_support_requests (user_id, user_email, status)
        VALUES (NEW.user_id, v_user_email, 'pending')
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
