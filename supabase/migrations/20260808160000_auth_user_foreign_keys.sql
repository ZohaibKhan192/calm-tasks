-- Tie the app's user columns to auth.users.
--
-- Until now nothing referenced auth.users, so deleting a user in the dashboard
-- left every profile, membership, join request and task pointing at a uuid that
-- no longer existed. Two visible symptoms of that:
--
--   * a deleted user's profile row survived, and the client re-upserted it on
--     the next auth state change (their JWT stays valid for up to an hour after
--     deletion -- it is stateless, deletion does not revoke it), so signing up
--     again produced a SECOND profile with the same email and a new uuid
--   * orphaned memberships kept granting access to workspaces
--
-- Deletion policy per column:
--   profiles.id            CASCADE   the mirror row has no meaning without the user
--   memberships.user_id    CASCADE   membership is the user's, nobody else's
--   join_requests.user_id  CASCADE   ditto
--   join_requests.decided_by SET NULL  keep the decision, lose the decider
--   tasks.assigned_to      SET NULL  task survives, becomes unassigned
--   tasks.created_by       SET NULL  task survives, loses attribution
--   organizations.owner_id RESTRICT  refuse the delete instead of silently
--                                    destroying a workspace and all its tasks;
--                                    transfer ownership first, deliberately

-- Orphans must go before the constraints can be validated. -------------------

-- A duplicate profile is always the orphaned one: profiles.id has no matching
-- auth.users row. Deleting by that condition cannot touch a live user.
DELETE FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

DELETE FROM public.memberships m
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.user_id);

DELETE FROM public.join_requests r
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.user_id);

UPDATE public.join_requests r SET decided_by = NULL
WHERE decided_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.decided_by);

UPDATE public.tasks t SET assigned_to = NULL
WHERE assigned_to IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.assigned_to);

-- created_by is NOT NULL today, which leaves no room for "author is gone".
ALTER TABLE public.tasks ALTER COLUMN created_by DROP NOT NULL;
UPDATE public.tasks t SET created_by = NULL
WHERE created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.created_by);

-- An org whose owner no longer exists cannot satisfy RESTRICT, and its tasks and
-- memberships are unreachable anyway, so remove it (cascades to both).
DELETE FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.owner_id);

-- Constraints. --------------------------------------------------------------

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.join_requests
  ADD CONSTRAINT join_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.join_requests
  ADD CONSTRAINT join_requests_decided_by_fkey
  FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- One email, one profile. The FK above makes duplicates impossible going
-- forward (auth enforces one user per email), but this catches any future path
-- that writes profiles directly and makes the failure loud rather than silent.
CREATE UNIQUE INDEX profiles_email_key ON public.profiles(lower(email))
  WHERE email IS NOT NULL;
