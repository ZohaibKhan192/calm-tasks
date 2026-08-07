-- Ownership transfer, and invite codes that can be rotated.
--
-- Two problems this fixes:
--
--   1. owner_id could never change, so if the owner left, nobody could rename,
--      change visibility on, or delete the workspace -- permanently.
--   2. The invite code WAS the org's primary key, so a leaked code could not be
--      revoked without breaking every foreign key pointing at the org.

-- Invite codes -------------------------------------------------------------

-- md5/random are core, so this needs no extension. 48 bits is far beyond
-- guessable for an invite code, and a UNIQUE index catches any collision.
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
$$;

ALTER TABLE public.organizations ADD COLUMN invite_code text;

-- generate_invite_code() is VOLATILE, so this evaluates per row.
UPDATE public.organizations SET invite_code = public.generate_invite_code()
WHERE invite_code IS NULL;

ALTER TABLE public.organizations ALTER COLUMN invite_code SET NOT NULL;
ALTER TABLE public.organizations
  ALTER COLUMN invite_code SET DEFAULT public.generate_invite_code();
CREATE UNIQUE INDEX organizations_invite_code_key ON public.organizations(invite_code);

CREATE OR REPLACE FUNCTION public.rotate_invite_code(_org uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- False for a workspace that does not exist, so this covers that case too.
  IF NOT public.is_org_manager(_org) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  LOOP
    v_code := public.generate_invite_code();
    BEGIN
      UPDATE public.organizations SET invite_code = v_code WHERE id = _org;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Collision: draw again.
    END;
  END LOOP;

  RETURN v_code;
END; $$;

-- Joining ------------------------------------------------------------------

-- Replaces join_org(uuid). That version took the org's primary key, which means
-- anyone who ever learned the UUID could still join after a rotation -- exactly
-- what rotation is supposed to prevent. It has to go, not just be superseded.
DROP FUNCTION IF EXISTS public.join_org(uuid);

CREATE OR REPLACE FUNCTION public.join_by_code(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_visibility public.org_visibility;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT o.id, o.visibility INTO v_org, v_visibility
  FROM public.organizations o
  WHERE o.invite_code = upper(trim(_code));
  IF v_org IS NULL THEN RAISE EXCEPTION 'Workspace not found'; END IF;

  -- Already in: idempotent, so a stale invite is harmless.
  IF EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.org_id = v_org AND m.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('status', 'JOINED', 'org_id', v_org);
  END IF;

  IF v_visibility = 'PUBLIC' THEN
    INSERT INTO public.memberships (org_id, user_id, role)
    VALUES (v_org, auth.uid(), 'MEMBER')
    ON CONFLICT (user_id, org_id) DO NOTHING;
    DELETE FROM public.join_requests WHERE org_id = v_org AND user_id = auth.uid();
    RETURN jsonb_build_object('status', 'JOINED', 'org_id', v_org);
  END IF;

  INSERT INTO public.join_requests (org_id, user_id, status)
  VALUES (v_org, auth.uid(), 'PENDING')
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET status = 'PENDING', created_at = now(), decided_at = NULL, decided_by = NULL;
  RETURN jsonb_build_object('status', 'PENDING', 'org_id', v_org);
END; $$;

-- Ownership ----------------------------------------------------------------

-- Demotes the outgoing owner to ADMIN rather than dropping them, so they keep
-- managing members and do not lock themselves out of their own workspace.
CREATE OR REPLACE FUNCTION public.transfer_ownership(_org uuid, _to uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT o.owner_id INTO v_owner FROM public.organizations o WHERE o.id = _org;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Workspace not found'; END IF;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Only the owner can transfer ownership';
  END IF;
  IF _to = auth.uid() THEN RAISE EXCEPTION 'Already the owner'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships m WHERE m.org_id = _org AND m.user_id = _to
  ) THEN
    RAISE EXCEPTION 'That person is not a member of this workspace';
  END IF;

  UPDATE public.organizations SET owner_id = _to WHERE id = _org;
  UPDATE public.memberships SET role = 'OWNER' WHERE org_id = _org AND user_id = _to;
  UPDATE public.memberships SET role = 'ADMIN' WHERE org_id = _org AND user_id = v_owner;
END; $$;

-- Grants -------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.join_by_code(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rotate_invite_code(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.transfer_ownership(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.generate_invite_code() FROM anon, public;
-- authenticated must keep this one: it is the DEFAULT for organizations.invite_code,
-- and a column default is evaluated with the privileges of the INSERTing role.
GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_ownership(uuid, uuid) TO authenticated;
