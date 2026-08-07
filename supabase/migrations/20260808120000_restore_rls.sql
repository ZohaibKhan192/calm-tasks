-- Fixes the 403s that forced RLS to be disabled.
--
-- Migration 20260807150433 revoked EXECUTE on the three helper functions from
-- `authenticated`. But the policies created in 20260807150412 call those same
-- helpers, and an RLS policy expression is evaluated with the privileges of the
-- role running the query -- SECURITY DEFINER governs the function body, not the
-- right to call it. So `authenticated` lost the ability to evaluate any policy
-- referencing them, and every read/write through those policies failed:
--
--   GET  /rest/v1/memberships          -> memberships_select -> is_org_member()
--   POST /rest/v1/organizations?select -> orgs_select        -> is_org_member()
--   INSERT/UPDATE/DELETE on tasks      -> tasks_*            -> is_org_member()
--
-- Re-grant EXECUTE to authenticated. `anon` stays revoked, which was the part of
-- 20260807150433 that was actually worth keeping.
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_org(uuid) TO authenticated;

-- Turn row-level security back on. Without this the publishable key -- which
-- ships in the browser bundle and is readable by anyone -- grants full read and
-- write over every org's data.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
