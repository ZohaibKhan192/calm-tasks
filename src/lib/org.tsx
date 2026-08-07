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
  role: Role;
};

/** Result of join_org(): straight in, or waiting on a manager. */
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
        .select("id, name, owner_id, visibility")
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

/** Asks to join. PUBLIC orgs return "JOINED"; PRIVATE ones file a request. */
export function useJoinOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orgId: string): Promise<JoinOutcome> => {
      const { data, error } = await supabase.rpc("join_org", { _org: orgId });
      if (error) throw error;
      return data === "JOINED" ? "JOINED" : "PENDING";
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["orgs"] });
      await qc.invalidateQueries({ queryKey: ["my-join-requests"] });
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
