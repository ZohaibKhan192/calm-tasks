-- Workspace logo.
--
-- Two halves: a logo_url column on organizations, and a storage bucket to hold
-- the file. Both have to agree that OWNER and ADMIN may write and everyone else
-- may only look.
--
-- orgs_update is deliberately owner-only (name, visibility and owner_id all live
-- on that table), so admins cannot be given a blanket UPDATE. set_org_logo() is
-- the narrow door: it writes exactly one column and checks is_org_manager first.

-- IF NOT EXISTS so a partial first run can be repaired by re-running the file.
-- Without it, a re-run aborts on this line and nothing below it applies.
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_url text;

-- Storage. -------------------------------------------------------------------

-- Public bucket: a logo is not a secret, and public reads are served straight
-- from the CDN without a signed URL per render. Writes are still policy-gated.
-- Some projects deny writes to storage.buckets from the SQL editor. That must not
-- abort the policies below, so it is caught: create the bucket in the dashboard
-- instead and everything else still applies.
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'org-logos',
    'org-logos',
    true,
    2097152, -- 2 MB
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  )
  ON CONFLICT (id) DO UPDATE
    SET public = true,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'Could not write storage.buckets; create the org-logos bucket in the dashboard (public, 2 MB).';
END;
$$;

-- Objects live at <org_id>/logo, so the first path segment is the org. A file
-- uploaded with a non-uuid first segment must not raise 22P02 out of a policy,
-- so the cast is done defensively and returns NULL instead.
CREATE OR REPLACE FUNCTION public.org_id_from_path(_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  RETURN (split_part(_name, '/', 1))::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;
-- Called inside storage policies on the caller's behalf, so authenticated needs
-- EXECUTE. SECURITY DEFINER governs a function body, never the right to call it.
GRANT EXECUTE ON FUNCTION public.org_id_from_path(text) TO anon, authenticated;

DROP POLICY IF EXISTS "org_logos_insert" ON storage.objects;
DROP POLICY IF EXISTS "org_logos_update" ON storage.objects;
DROP POLICY IF EXISTS "org_logos_delete" ON storage.objects;

CREATE POLICY "org_logos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-logos'
    AND public.is_org_manager(public.org_id_from_path(name))
  );
CREATE POLICY "org_logos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND public.is_org_manager(public.org_id_from_path(name))
  )
  WITH CHECK (
    bucket_id = 'org-logos'
    AND public.is_org_manager(public.org_id_from_path(name))
  );
CREATE POLICY "org_logos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND public.is_org_manager(public.org_id_from_path(name))
  );

-- Writing the column. --------------------------------------------------------

-- _url NULL clears the logo. The value is only ever read back into an <img src>,
-- so reject anything that is not one of our own public storage URLs -- otherwise
-- an admin could point every member's browser at an arbitrary host.
CREATE OR REPLACE FUNCTION public.set_org_logo(_org uuid, _url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_org_manager(_org) THEN
    RAISE EXCEPTION 'Only an owner or admin can change the workspace logo';
  END IF;
  IF _url IS NOT NULL AND position('/storage/v1/object/public/org-logos/' IN _url) = 0 THEN
    RAISE EXCEPTION 'Logo must be an uploaded file';
  END IF;
  UPDATE public.organizations SET logo_url = _url WHERE id = _org;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_org_logo(uuid, text) TO authenticated;
