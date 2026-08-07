import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Status = "TODO" | "IN_PROGRESS" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type Task = {
  id: string;
  org_id: string;
  created_by: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export const COLUMN_PAGE_SIZE = 50;

/**
 * One query per column.
 *
 * The board used to fetch a single page of all statuses and split it clientside,
 * which silently dropped tasks: with more tasks than fit one page, a column
 * showed only those that happened to fall inside it, and the counts lied.
 * Filtering in the query means each column's total is its real total.
 */
export function useColumnTasks(orgId: string | undefined, status: Status, limit: number) {
  return useQuery({
    queryKey: ["tasks", orgId, status, limit],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("tasks")
        .select("*", { count: "exact" })
        .eq("org_id", orgId!)
        .eq("status", status)
        .order("created_at", { ascending: false })
        .range(0, limit - 1);
      if (error) throw error;
      return { tasks: (data ?? []) as Task[], total: count ?? 0 };
    },
  });
}

/** Org-wide total, for the header count and the empty state. */
export function useTaskCount(orgId?: string) {
  return useQuery({
    queryKey: ["tasks", orgId, "count"],
    enabled: !!orgId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId!);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export type TaskInput = {
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  priority: Priority;
};

export function useCreateTask(orgId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskInput) => {
      const { error } = await supabase
        .from("tasks")
        .insert({ ...input, org_id: orgId!, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
