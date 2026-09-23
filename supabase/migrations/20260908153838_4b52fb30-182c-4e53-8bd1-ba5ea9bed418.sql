REVOKE EXECUTE ON FUNCTION public.spend_coins(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spend_coins(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_coins(uuid, integer) TO service_role;