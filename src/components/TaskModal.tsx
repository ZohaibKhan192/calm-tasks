import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import type { Member } from "@/lib/org";
import type { Priority, Task, TaskInput } from "@/lib/tasks";

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];

export function TaskModal({
  task,
  members,
  canDelete,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  task?: Task | null;
  members: Member[];
  canDelete: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (input: TaskInput) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "MEDIUM");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task name is required.");
      return;
    }
    setError(null);
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
      priority,
    });
  };

  return (
    <Modal title={task ? "Edit task" : "New task"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="title" className="mb-2 block text-xs text-muted-foreground">
            Task name
          </label>
          <input
            id="title"
            className="field"
            placeholder="Enter task name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="desc" className="mb-2 block text-xs text-muted-foreground">
            Description
          </label>
          <textarea
            id="desc"
            className="field h-20 resize-none"
            placeholder="Add notes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="assignee" className="mb-2 block text-xs text-muted-foreground">
            Assigned to
          </label>
          <div className="flex items-center gap-2">
            <select
              id="assignee"
              className="field"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name || m.email}
                </option>
              ))}
            </select>
            {assignedTo && (
              <Avatar
                name={members.find((m) => m.user_id === assignedTo)?.name}
                email={members.find((m) => m.user_id === assignedTo)?.email}
                url={members.find((m) => m.user_id === assignedTo)?.avatar_url}
                size={24}
              />
            )}
          </div>
        </div>

        <div>
          <label htmlFor="due" className="mb-2 block text-xs text-muted-foreground">
            Due date
          </label>
          <input
            id="due"
            type="date"
            className="field"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div>
          <span className="mb-2 block text-xs text-muted-foreground">Priority</span>
          <div className="flex items-center gap-6">
            {PRIORITIES.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="priority"
                  value={p}
                  checked={priority === p}
                  onChange={() => setPriority(p)}
                />
                {p}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex flex-col gap-4">
          <button type="submit" disabled={saving} className="btn-base btn-primary w-full">
            {task ? "Save changes" : "Create task"}
          </button>
          <button type="button" onClick={onClose} className="btn-base btn-ghost w-full">
            Cancel
          </button>
        </div>

        {task && canDelete && onDelete && (
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={onDelete}
              className="text-xs font-medium text-destructive hover:underline"
            >
              Delete
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}

export function DeleteTaskDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Delete task" onClose={onCancel} width={380}>
      <p className="text-sm text-foreground">Delete this task?</p>
      <div className="mt-6 flex gap-4">
        <button type="button" onClick={onCancel} className="btn-base btn-ghost flex-1">
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="btn-base flex-1 border-transparent bg-destructive text-white"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}
