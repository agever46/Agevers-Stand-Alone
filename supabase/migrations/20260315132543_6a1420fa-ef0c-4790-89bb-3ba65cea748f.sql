
-- Add screenshot_url column to support_tickets
ALTER TABLE public.support_tickets ADD COLUMN screenshot_url text;

-- Create storage bucket for ticket screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-screenshots', 'ticket-screenshots', true);

-- Allow authenticated users to upload to ticket-screenshots
CREATE POLICY "Authenticated users can upload ticket screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ticket-screenshots');

-- Allow anyone to read ticket screenshots
CREATE POLICY "Anyone can view ticket screenshots"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'ticket-screenshots');
