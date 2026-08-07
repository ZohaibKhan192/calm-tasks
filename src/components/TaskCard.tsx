import { Avatar } from "@/components/Avatar";
import { dueState, formatDue } from "@/lib/format";
import type { Member } from "@/lib/org";
import type { Priority, Task } from "@/lib/tasks";

const LEFT_BORDER: Record<Task["status"], string> = {
  TODO: "#d1d5db",
  IN_PROGRESS: "#3b82f6",
  DONE: "#10b981",
};

const PRIORITY_CLASS: Record<Priority, string> = {
  HIGH: "text-destructive",
  MEDIUM: "text-warning",
  LOW: "text-muted-foreground",
};

export function PriorityLabel({ priority }: { priority: Priority }) {
  return (
    <span className={`text-xs font-medium ${PRIORITY_CLASS[priority]}`}>{priority}</span>
  );
}

export function DueDate({ value }: { value: string }) {
  const state = dueState(value);
  const cls =
    state === "overdue"
      ? "text-destructive"
      : state === "today"
        ? "font-semibold text-foreground"
        : "text-muted-foreground";
  return <span className={`text-xs ${cls}`}>{formatDue(value)}</span>;
}

export function TaskCard({
  task,
  members,
  onOpen,
  onDragStart,
}: {
  task: Task;
  members: Member[];
  onOpen: () => void;
  onDragStart: () => void;
}) {
  const assignee = members.find((m) => m.user_id === task.assigned_to);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="cursor-pointer rounded-md border border-border bg-background p-4 hover:bg-surface"
      style={{ borderLeft: `3px solid ${LEFT_BORDER[task.status]}` }}
    >
      <p className="text-sm font-semibold text-foreground">{task.title}</p>
      {task.description && (
        <p className="mt-1 truncate text-xs text-muted-foreground">{task.description}</p>
      )}
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {assignee ? (
            <Avatar
              name={assignee.name}
              email={assignee.email}
              url={assignee.avatar_url}
              size={24}
            />
          ) : (
            <span className="text-xs text-muted-foreground">Unassigned</span>
          )}
          {task.due_date && <DueDate value={task.due_date} />}
        </div>
        <PriorityLabel priority={task.priority} />
      </div>
    </div>
  );
}
