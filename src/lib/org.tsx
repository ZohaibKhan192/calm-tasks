import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export type Visibility = "PUBLIC" | "PRIVATE";

export type Org = {
  id: string;
  name: string;
  owner_id: string;
  visibility: Visibility;
  invite_code: string;
  logo_url: string | null;
  role: Role;
};

/** Bucket created by the org_logo migration. Public read, manager-only write. */
export const LOGO_BUCKET = "org-logos";
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

/** Result of join_by_code(): straight in, or waiting on a manager. */
export type JoinOutcome = "JOINED" | "PENDING";

export type JoinRequest = {
  id: string;
  user_id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export type PendingRequest = { id: string; org_id: string; org_name: string | null };

export type Member = {
  id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

const STORAGE_KEY = "taskcrm.orgId";

export function useMyOrgs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["orgs", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Org[]> => {
      const { data: memberships, error } = await supabase
        .from("memberships")
        .select("org_id, role")
        .eq("user_id", user!.id);
      if (error) throw error;
      const ids = (memberships ?? []).map((m) => m.org_id);
      if (ids.length === 0) return [];
      const { data: orgs, error: orgErr } = await supabase
        .from("organizations")
        .select("id, name, owner_id, visibility, invite_code, logo_url")
        .in("id", ids)
        .order("created_at", { ascending: true });
      if (orgErr) throw orgErr;
      return (orgs ?? []).map((o) => ({
        ...o,
        visibility: o.visibility as Visibility,
        role: (memberships!.find((m) => m.org_id === o.id)?.role ?? "MEMBER") as Role,
      }));
    },
  });
}

type OrgContextValue = {
  orgs: Org[];
  org: Org | null;
  loading: boolean;
  setOrgId: (id: string) => void;
};

const OrgContext = createContext<OrgContextValue>({
  orgs: [],
  org: null,
  loading: true,
  setOrgId: () => {},
});

export function OrgProvider({ children }: { children: ReactNode }) {
  const { data: orgs, isLoading } = useMyOrgs();
  const [orgId, setOrgIdState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrgIdState(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const setOrgId = (id: string) => {
    setOrgIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  };

  const list = useMemo(() => orgs ?? [], [orgs]);
  const org = list.find((o) => o.id === orgId) ?? list[0] ?? null;

  return (
    <OrgContext.Provider value={{ orgs: list, org, loading: isLoading, setOrgId }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}

export function useMembers(orgId?: string) {
  return useQuery({
    queryKey: ["members", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Member[]> => {
      const { data: memberships, error } = await supabase
        .from("memberships")
        .select("id, user_id, role, joined_at")
        .eq("org_id", orgId!)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      const ids = (memberships ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, avatar_url")
        .in("id", ids);
      return (memberships ?? []).map((m) => {
        const p = profiles?.find((x) => x.id === m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role as Role,
          joined_at: m.joined_at,
          name: p?.name ?? null,
          email: p?.email ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      });
    },
  });
}

export function useCreateOrg() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, visibility }: { name: string; visibility: Visibility }) => {
      const { data: org, error } = await supabase
        .from("organizations")
        .insert({ name, owner_id: user!.id, visibility })
        .select("id")
        .single();
      if (error) throw error;
      const { error: memberErr } = await supabase
        .from("memberships")
        .insert({ org_id: org.id, user_id: user!.id, role: "OWNER" });
      if (memberErr) throw memberErr;
      return org.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orgs"] }),
  });
}

/** Redeems an invite code. PUBLIC orgs join outright; PRIVATE ones file a request. */
export function useJoinByCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<{ status: JoinOutcome; orgId: string }> => {
      const { data, error } = await supabase.rpc("join_by_code", { _code: code });
      if (error) throw error;
      const result = data as { status?: string; org_id?: string } | null;
      return {
        status: result?.status === "JOINED" ? "JOINED" : "PENDING",
        orgId: result?.org_id ?? "",
      };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["orgs"] });
      await qc.invalidateQueries({ queryKey: ["my-join-requests"] });
    },
  });
}

/** Invalidates the old code. Managers only; enforced in the function. */
export function useRotateInviteCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("rotate_invite_code", { _org: orgId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orgs"] }),
  });
}

/**
 * Uploads a logo and points the org at it. Managers only, enforced twice: the
 * storage policies gate the file, set_org_logo() gates the column.
 *
 * The object path is fixed at <orgId>/logo so replacing a logo overwrites rather
 * than accumulating dead files. That makes the public URL stable, which the CDN
 * would happily keep serving, so a version query string busts the cache.
 */
export function useSetOrgLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, file }: { orgId: string; file: File }) => {
      const path = `${orgId}/logo`;
      const { error: uploadErr } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      const url = `${publicUrl}?v=${Date.now()}`;
      const { error } = await supabase.rpc("set_org_logo", { _org: orgId, _url: url });
      if (error) throw error;
      return url;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orgs"] }),
  });
}

/** Clears the column and removes the file, so storage does not keep the image. */
export function useRemoveOrgLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await supabase.rpc("set_org_logo", { _org: orgId, _url: null });
      if (error) throw error;
      await supabase.storage.from(LOGO_BUCKET).remove([`${orgId}/logo`]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orgs"] }),
  });
}

/** Hands the workspace to another member; the outgoing owner becomes an ADMIN. */
export function useTransferOwnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, toUserId }: { orgId: string; toUserId: string }) => {
      const { error } = await supabase.rpc("transfer_ownership", {
        _org: orgId,
        _to: toUserId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["orgs"] });
      await qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

/** Pending requests for one org — managers only, everyone else sees []. */
export function useJoinRequests(orgId?: string) {
  return useQuery({
    queryKey: ["join-requests", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<JoinRequest[]> => {
      const { data: requests, error } = await supabase
        .from("join_requests")
        .select("id, user_id, created_at")
        .eq("org_id", orgId!)
        .eq("status", "PENDING")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const ids = (requests ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, avatar_url")
        .in("id", ids);
      return (requests ?? []).map((r) => {
        const p = profiles?.find((x) => x.id === r.user_id);
        return {
          id: r.id,
          user_id: r.user_id,
          created_at: r.created_at,
          name: p?.name ?? null,
          email: p?.email ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      });
    },
  });
}

/** The current user's own outstanding requests, for the "waiting" screen. */
export function useMyPendingRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-join-requests", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<PendingRequest[]> => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("id, org_id, organizations(name)")
        .eq("user_id", user!.id)
        .eq("status", "PENDING");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        org_id: r.org_id,
        org_name: (r.organizations as { name: string } | null)?.name ?? null,
      }));
    },
  });
}

export function useDecideJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = approve
        ? await supabase.rpc("approve_join_request", { _request: id })
        : await supabase.rpc("reject_join_request", { _request: id });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["join-requests"] });
      await qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}
