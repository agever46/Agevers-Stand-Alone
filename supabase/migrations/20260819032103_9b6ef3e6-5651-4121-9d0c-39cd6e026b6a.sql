GRANT SELECT ON public.free_gift_claims TO authenticated;
GRANT SELECT ON public.free_gift_claims TO anon;

CREATE POLICY "Allow anyone to read claim counts" 
ON public.free_gift_claims 
FOR SELECT 
TO public 
USING (true);
