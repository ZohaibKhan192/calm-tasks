CREATE OR REPLACE FUNCTION public.join_org(_org uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exists boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _org) INTO v_exists;
  IF NOT v_exists THEN RAISE EXCEPTION 'Workspace not found'; END IF;
  INSERT INTO public.memberships (org_id, user_id, role)
  VALUES (_org, auth.uid(), 'MEMBER')
  ON CONFLICT (user_id, org_id) DO NOTHING;
  RETURN _org;
END; $$;
REVOKE EXECUTE ON FUNCTION public.join_org(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.join_org(uuid) TO authenticated;