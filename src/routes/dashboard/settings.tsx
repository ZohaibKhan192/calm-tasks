import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({
    meta: [
      { title: "Workspace settings · Task CRM" },
      {
        name: "description",
        content: "Rename your Task CRM workspace, copy the invite code, or delete the workspace.",
      },
      { property: "og:title", content: "Workspace settings · Task CRM" },
      {
        property: "og:description",
        content: "Rename your Task CRM workspace, copy the invite code, or delete the workspace.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { org } = useOrg();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(org?.name ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwner = org?.role === "OWNER";

  useEffect(() => setName(org?.name ?? ""), [org?.name]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ name: name.trim() })
      .eq("id", org!.id);
    if (updateError) {
      setError("We couldn't save your changes.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["orgs"] });
    setStatus("Saved.");
  };

  const destroy = async () => {
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await supabase.from("organizations").delete().eq("id", org!.id);
    if (deleteError) {
      setConfirmDelete(false);
      setDeleting(false);
      setError("We couldn't delete this workspace.");
      return;
    }
    window.localStorage.removeItem("taskcrm.orgId");
    await qc.invalidateQueries({ queryKey: ["orgs"] });
    void navigate({ to: "/setup" });
  };

  return (
    <div className="max-w-[600px]">
      <h1 className="text-2xl font-semibold text-foreground">Settings</h1>

      <form onSubmit={save} className="mt-8 flex flex-col gap-4">
        <div>
          <label htmlFor="orgname" className="mb-2 block text-xs text-muted-foreground">
            Workspace name
          </label>
          <input
            id="orgname"
            className="field"
            value={name}
            disabled={!isOwner}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {isOwner && (
          <button type="submit" className="btn-base btn-primary w-40">
            Save changes
          </button>
        )}
      </form>

      <div className="mt-8">
        <p className="mb-2 text-xs text-muted-foreground">Workspace code</p>
        <code className="block rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground">
          {org?.id}
        </code>
      </div>

      <div className="mt-8">
        <p className="mb-2 text-xs text-muted-foreground">Your role</p>
        <p className="text-sm text-foreground">{org?.role}</p>
      </div>

      {status && <p className="mt-4 text-xs text-muted-foreground">{status}</p>}
      {error && <p className="mt-4 text-xs text-destructive">{error}</p>}

      {isOwner && (
        <div className="mt-12 border-t border-border pt-6">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="btn-base btn-danger"
          >
            Delete workspace
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            This permanently removes the workspace and all of its tasks.
          </p>
        </div>
      )}

      {confirmDelete && (
        <Modal title="Delete workspace" onClose={() => setConfirmDelete(false)} width={380}>
          <p className="text-sm text-foreground">Delete {org?.name}?</p>
          <p className="mt-2 text-xs text-muted-foreground">
            This permanently removes the workspace, its tasks, and every membership. It cannot be
            undone.
          </p>
          <div className="mt-6 flex gap-4">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="btn-base btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void destroy()}
              className="btn-base flex-1 border-transparent bg-destructive text-white"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
