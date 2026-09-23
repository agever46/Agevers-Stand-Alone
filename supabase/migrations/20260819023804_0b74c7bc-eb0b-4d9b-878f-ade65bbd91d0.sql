-- Update the verification message in the database trigger to include phone mismatch
CREATE OR REPLACE FUNCTION public.handle_held_order_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_user_email TEXT;
    v_first_name TEXT;
    v_full_name TEXT;
    v_request_id UUID;
    v_msg TEXT;
BEGIN
    -- Only trigger if status changed to 'held'
    IF NEW.status = 'held' AND (TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status != 'held') THEN
        -- Get user info
        SELECT email, (raw_user_meta_data->>'first_name'), (raw_user_meta_data->>'full_name')
        INTO v_user_email, v_first_name, v_full_name
        FROM auth.users
        WHERE id = NEW.user_id;

        IF v_user_email IS NOT NULL THEN
            -- 1. Create/Find support request
            SELECT id INTO v_request_id
            FROM public.live_support_requests
            WHERE user_id = NEW.user_id AND status = 'pending'
            LIMIT 1;

            IF v_request_id IS NULL THEN
                INSERT INTO public.live_support_requests (user_id, user_email, status)
                VALUES (NEW.user_id, v_user_email, 'pending')
                RETURNING id INTO v_request_id;
            END IF;

            -- 2. Send chat message (Updated text to mention phone mismatch)
            v_msg := 'Hi! Your order is currently under a routine security review because your account details (email or phone) don''t match your PayPal payment information. To protect your account and complete the delivery, could you please confirm that you authorized this payment? A screenshot of your PayPal transaction confirmation would help us release the code immediately. Thank you for your patience!';
            
            -- Insert as admin role from system UUID
            INSERT INTO public.live_chat_messages (request_id, sender_id, sender_role, content)
            VALUES (v_request_id, '00000000-0000-0000-0000-000000000000', 'admin', v_msg);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
