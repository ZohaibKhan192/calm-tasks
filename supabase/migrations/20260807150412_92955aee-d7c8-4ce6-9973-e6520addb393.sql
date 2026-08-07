CREATE TYPE public.app_role AS ENUM ('OWNER','ADMIN','MEMBER');
CREATE TYPE public.task_status AS ENUM ('TODO','IN_PROGRESS','DONE');
CREATE TYPE public.task_priority AS ENUM ('LOW','MEDIUM','HIGH');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'MEMBER',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'TODO',
  priority public.task_priority NOT NULL DEFAULT 'MEDIUM',
  due_date date,
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_org_idx ON public.tasks(org_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.org_id = _org AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.org_id = _org AND m.user_id = auth.uid() AND m.role IN ('OWNER','ADMIN'));
$$;

CREATE OR REPLACE FUNCTION public.shares_org(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships a
    JOIN public.memberships b ON a.org_id = b.org_id
    WHERE a.user_id = auth.uid() AND b.user_id = _user
  );
$$;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_org(id));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "orgs_select" ON public.organizations FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_org_member(id));
CREATE POLICY "orgs_insert" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "orgs_update" ON public.organizations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "orgs_delete" ON public.organizations FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "memberships_select" ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(org_id));
CREATE POLICY "memberships_insert" ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_manager(org_id)
    OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid()))
  );
CREATE POLICY "memberships_update" ON public.memberships FOR UPDATE TO authenticated
  USING (public.is_org_manager(org_id)) WITH CHECK (public.is_org_manager(org_id));
CREATE POLICY "memberships_delete" ON public.memberships FOR DELETE TO authenticated
  USING (public.is_org_manager(org_id) OR user_id = auth.uid());

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id) AND created_by = auth.uid());
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id) AND (created_by = auth.uid() OR public.is_org_manager(org_id)))
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_org_manager(org_id));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();