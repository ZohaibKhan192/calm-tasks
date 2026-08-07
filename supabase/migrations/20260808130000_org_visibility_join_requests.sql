-- Public vs private workspaces.
--
-- Until now the workspace UUID acted as a bearer token: anyone holding it could
-- call join_org() and be a member instantly. Now each org declares a visibility:
--
--   PUBLIC  -> holding the code is enough, join_org() adds the membership
--   PRIVATE -> join_org() files a request an OWNER/ADMIN must approve
--
-- Existing orgs default to PRIVATE, so open joining stops until an owner opts in.

CREATE TYPE public.org_visibility AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE public.join_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE public.organizations
  ADD COLUMN visibility public.org_visibility NOT NULL DEFAULT 'PRIVATE';

CREATE TABLE public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status public.join_request_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  UNIQUE (org_id, user_id)
);
CREATE INDEX join_requests_org_status_idx ON public.join_requests(org_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.join_requests TO authenticated;
GRANT ALL ON public.join_requests TO service_role;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "join_requests_select" ON public.join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_manager(org_id));
CREATE POLICY "join_requests_insert_own" ON public.join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "join_requests_update_manager" ON public.join_requests FOR UPDATE TO authenticated
  USING (public.is_org_manager(org_id)) WITH CHECK (public.is_org_manager(org_id));
CREATE POLICY "join_requests_delete" ON public.join_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_org_manager(org_id));

-- A pending requester is not a member yet, so orgs_select hid the workspace from
-- them entirely and the "waiting for approval" screen had no name to show.
DROP POLICY "orgs_select" ON public.organizations;
CREATE POLICY "orgs_select" ON public.organizations FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_org_member(id)
    OR EXISTS (
      SELECT 1 FROM public.join_requests r
      WHERE r.org_id = organizations.id AND r.user_id = auth.uid()
    )
  );

-- Same problem in reverse: a requester shares no org with the manager reviewing
-- them, so shares_org() was false and the approval list showed blank names.
DROP POLICY "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.shares_org(id)
    OR EXISTS (
      SELECT 1 FROM public.join_requests r
      WHERE r.user_id = profiles.id
        AND r.status = 'PENDING'
        AND public.is_org_manager(r.org_id)
    )
  );

-- Return type changes from uuid to text, so the old signature has to go first.
DROP FUNCTION IF EXISTS public.join_org(uuid);

CREATE OR REPLACE FUNCTION public.join_org(_org uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_visibility public.org_visibility;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT o.visibility INTO v_visibility FROM public.organizations o WHERE o.id = _org;
  IF v_visibility IS NULL THEN RAISE EXCEPTION 'Workspace not found'; END IF;

  -- Already in: idempotent, so a stale invite link is harmless.
  IF EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.org_id = _org AND m.user_id = auth.uid()
  ) THEN
    RETURN 'JOINED';
  END IF;

  IF v_visibility = 'PUBLIC' THEN
    INSERT INTO public.memberships (org_id, user_id, role)
    VALUES (_org, auth.uid(), 'MEMBER')
    ON CONFLICT (user_id, org_id) DO NOTHING;
    DELETE FROM public.join_requests WHERE org_id = _org AND user_id = auth.uid();
    RETURN 'JOINED';
  END IF;

  -- A previously rejected user may ask again; approval is the only way in.
  INSERT INTO public.join_requests (org_id, user_id, status)
  VALUES (_org, auth.uid(), 'PENDING')
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET status = 'PENDING', created_at = now(), decided_at = NULL, decided_by = NULL;
  RETURN 'PENDING';
END; $$;

CREATE OR REPLACE FUNCTION public.approve_join_request(_request uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT r.org_id, r.user_id INTO v_org, v_user
  FROM public.join_requests r
  WHERE r.id = _request AND r.status = 'PENDING';
  IF v_org IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF NOT public.is_org_manager(v_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  INSERT INTO public.memberships (org_id, user_id, role)
  VALUES (v_org, v_user, 'MEMBER')
  ON CONFLICT (user_id, org_id) DO NOTHING;

  UPDATE public.join_requests
  SET status = 'APPROVED', decided_at = now(), decided_by = auth.uid()
  WHERE id = _request;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_join_request(_request uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT r.org_id INTO v_org
  FROM public.join_requests r
  WHERE r.id = _request AND r.status = 'PENDING';
  IF v_org IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF NOT public.is_org_manager(v_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  UPDATE public.join_requests
  SET status = 'REJECTED', decided_at = now(), decided_by = auth.uid()
  WHERE id = _request;
END; $$;

-- The policies above call these three, and a policy expression is evaluated as
-- the invoking role -- so without EXECUTE, enabling RLS on join_requests makes
-- the approval list unreadable and the "waiting for approval" screen blank.
-- 20260808120000 grants these too; repeated here so this migration stands alone.
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_org(uuid) TO authenticated;

-- These are called from the browser, so authenticated needs EXECUTE. Revoking it
-- is what broke every RLS policy in 20260807150433.
REVOKE EXECUTE ON FUNCTION public.join_org(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_join_request(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_join_request(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.join_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_join_request(uuid) TO authenticated;
