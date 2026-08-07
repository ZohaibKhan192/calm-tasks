import { createFileRoute } from "@tanstack/react-router";
import { ListChecks, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import { TaskCard } from "@/components/TaskCard";
import { DeleteTaskDialog, TaskModal } from "@/components/TaskModal";
import { useAuth } from "@/lib/auth";
import { useMembers, useOrg } from "@/lib/org";
import {
  PAGE_SIZE,
  useCreateTask,
  useDeleteTask,
  useTasks,
  useUpdateTask,
  type Status,
  type Task,
} from "@/lib/tasks";

export const Route = createFileRoute("/dashboard/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks board · Task CRM" },
      {
        name: "description",
        content: "Track your team's work on a simple Todo, In progress and Done kanban board.",
      },
      { property: "og:title", content: "Tasks board · Task CRM" },
      {
        property: "og:description",
        content: "Track your team's work on a simple Todo, In progress and Done kanban board.",
      },
    ],
  }),
  component: TasksPage,
});

const COLUMNS: { status: Status; label: string }[] = [
  { status: "TODO", label: "TODO" },
  { status: "IN_PROGRESS", label: "IN PROGRESS" },
  { status: "DONE", label: "DONE" },
];

function TasksPage() {
  const { user } = useAuth();
  const { org } = useOrg();
  const [page, setPage] = useState(0);
  const { data, isLoading, error } = useTasks(org?.id, page);
  const { data: members } = useMembers(org?.id);
  const createTask = useCreateTask(org?.id);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const total = data?.total ?? 0;
  const isManager = org?.role === "OWNER" || org?.role === "ADMIN";

  const canEdit = (task: Task) => isManager || task.created_by === user?.id;

  const onDrop = (status: Status) => {
    const task = tasks.find((t) => t.id === dragId);
    setDragId(null);
    if (!task || task.status === status || !canEdit(task)) return;
    updateTask.mutate({ id: task.id, status });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {total} {total === 1 ? "task" : "tasks"} in {org?.name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-base btn-primary"
        >
          <Plus size={16} />
          New task
        </button>
      </div>

      {error && (
        <p className="mt-8 text-sm text-destructive">
          We couldn't load your tasks. Please refresh the page.
        </p>
      )}

      {isLoading ? (
        <div className="mt-8 flex gap-6">
          {COLUMNS.map((c) => (
            <div key={c.status} className="w-[340px]">
              <Skeleton className="h-5 w-24" />
              <div className="mt-4 flex flex-col gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center rounded-md border border-border py-16">
          <ListChecks size={20} className="text-muted-foreground" />
          <p className="mt-4 text-sm text-foreground">No tasks yet</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn-base btn-ghost mt-6"
          >
            Create your first task
          </button>
        </div>
      ) : (
        <div className="mt-8 flex items-start gap-6 overflow-x-auto">
          {COLUMNS.map((column) => {
            const items = tasks.filter((t) => t.status === column.status);
            return (
              <section
                key={column.status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(column.status)}
                className="max-h-[calc(100vh-220px)] min-w-[320px] max-w-[400px] flex-1 overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h2 className="text-sm font-semibold text-foreground">{column.label}</h2>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="mt-4 flex flex-col gap-4">
                  {items.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      members={members ?? []}
                      onOpen={() => setEditing(task)}
                      onDragStart={() => setDragId(task.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-8 flex items-center gap-4">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="btn-base btn-ghost"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          <button
            type="button"
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
            className="btn-base btn-ghost"
          >
            Next
          </button>
        </div>
      )}

      {creating && (
        <TaskModal
          members={members ?? []}
          canDelete={false}
          saving={createTask.isPending}
          onClose={() => setCreating(false)}
          onSave={(input) => {
            createTask.mutate(input, { onSuccess: () => setCreating(false) });
          }}
        />
      )}

      {editing && (
        <TaskModal
          task={editing}
          members={members ?? []}
          canDelete={canEdit(editing)}
          saving={updateTask.isPending}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            if (!canEdit(editing)) {
              setEditing(null);
              return;
            }
            updateTask.mutate({ id: editing.id, ...input }, { onSuccess: () => setEditing(null) });
          }}
          onDelete={() => {
            setDeleting(editing);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <DeleteTaskDialog
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteTask.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
          }}
        />
      )}
    </div>
  );
}
