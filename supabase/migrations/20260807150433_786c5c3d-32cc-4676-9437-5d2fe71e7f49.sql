REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_org_manager(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.shares_org(uuid) FROM anon, authenticated, public;