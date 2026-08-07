import { createFileRoute } from "@tanstack/react-router";
import { ListChecks, Plus } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import { TaskCard } from "@/components/TaskCard";
import { DeleteTaskDialog, TaskModal } from "@/components/TaskModal";
import { useAuth } from "@/lib/auth";
import { useMembers, useOrg, type Member } from "@/lib/org";
import {
  COLUMN_PAGE_SIZE,
  useColumnTasks,
  useCreateTask,
  useDeleteTask,
  useTaskCount,
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

/**
 * Owns its own query and page size, so a long column pages independently instead
 * of competing with the others for one shared page of rows.
 */
function Column({
  status,
  label,
  orgId,
  members,
  canDrag,
  onOpen,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  status: Status;
  label: string;
  orgId: string | undefined;
  members: Member[];
  canDrag: (task: Task) => boolean;
  onOpen: (task: Task) => void;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
  onDrop: (status: Status) => void;
}) {
  const [limit, setLimit] = useState(COLUMN_PAGE_SIZE);
  const [over, setOver] = useState(false);
  const { data, isLoading } = useColumnTasks(orgId, status, limit);
  const tasks = data?.tasks ?? [];
  const total = data?.total ?? 0;

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        if (!over) setOver(true);
      }}
      // dragleave also fires when the cursor moves onto a child, so only clear
      // once the pointer has actually left the column.
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={() => {
        setOver(false);
        onDrop(status);
      }}
      className={`flex max-h-[calc(100vh-220px)] min-h-[320px] min-w-[320px] max-w-[400px] flex-1 flex-col overflow-y-auto rounded-md ${
        over ? "bg-surface" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
        <span className="text-xs text-muted-foreground">{total}</span>
      </div>
      {/* flex-1 makes the empty area below the cards part of the drop target,
          otherwise a column with no tasks is only droppable on its header. */}
      <div className="mt-4 flex flex-1 flex-col gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              members={members}
              draggable={canDrag(task)}
              onOpen={() => onOpen(task)}
              onDragStart={() => onDragStart(task)}
              onDragEnd={onDragEnd}
            />
          ))
        )}
        {!isLoading && tasks.length === 0 && (
          <p className="text-xs text-muted-foreground">Drop a task here</p>
        )}
        {tasks.length < total && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + COLUMN_PAGE_SIZE)}
            className="btn-base btn-ghost w-full"
          >
            Show more ({total - tasks.length} left)
          </button>
        )}
      </div>
    </section>
  );
}

function TasksPage() {
  const { user } = useAuth();
  const { org } = useOrg();
  const { data: members } = useMembers(org?.id);
  const { data: totalTasks, isLoading: countLoading } = useTaskCount(org?.id);
  const createTask = useCreateTask(org?.id);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [dragged, setDragged] = useState<Task | null>(null);

  const total = totalTasks ?? 0;
  const isManager = org?.role === "OWNER" || org?.role === "ADMIN";
  const canEdit = (task: Task) => isManager || task.created_by === user?.id;

  const onDrop = (status: Status) => {
    const task = dragged;
    setDragged(null);
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
        <button type="button" onClick={() => setCreating(true)} className="btn-base btn-primary">
          <Plus size={16} />
          New task
        </button>
      </div>

      {!countLoading && total === 0 ? (
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
          {COLUMNS.map((column) => (
            <Column
              key={column.status}
              status={column.status}
              label={column.label}
              orgId={org?.id}
              members={members ?? []}
              canDrag={canEdit}
              onOpen={setEditing}
              onDragStart={setDragged}
              onDragEnd={() => setDragged(null)}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}

      {creating && (
        <TaskModal
          members={members ?? []}
          canEdit
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
          canEdit={canEdit(editing)}
          saving={updateTask.isPending}
          onClose={() => setEditing(null)}
          onSave={(input) => {
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
