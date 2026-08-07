import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { supabase } from "@/integrations/supabase/client";
import {
  useMembers,
  useOrg,
  useRotateInviteCode,
  useTransferOwnership,
  type Visibility,
} from "@/lib/org";

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

const VISIBILITY_HELP: Record<Visibility, string> = {
  PRIVATE: "People who have the code must be approved by an owner or admin before they join.",
  PUBLIC: "Anyone who has the code joins immediately, with no approval step.",
};

function SettingsPage() {
  const { org } = useOrg();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(org?.name ?? "");
  const [visibility, setVisibility] = useState<Visibility>(org?.visibility ?? "PRIVATE");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwner = org?.role === "OWNER";
  const isManager = isOwner || org?.role === "ADMIN";

  const { data: members } = useMembers(org?.id);
  const rotate = useRotateInviteCode();
  const transfer = useTransferOwnership();
  const [transferTo, setTransferTo] = useState("");
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  // Everyone except the current owner, who cannot receive their own workspace.
  const transferCandidates = (members ?? []).filter((m) => m.user_id !== org?.owner_id);
  const transferTarget = transferCandidates.find((m) => m.user_id === transferTo);

  const rotateCode = () => {
    setStatus(null);
    setError(null);
    rotate.mutate(org!.id, {
      onSuccess: () => setStatus("New code generated. The old one no longer works."),
      onError: () => setError("We couldn't generate a new code."),
    });
  };

  const doTransfer = () => {
    setStatus(null);
    setError(null);
    transfer.mutate(
      { orgId: org!.id, toUserId: transferTo },
      {
        onSuccess: () => {
          setConfirmTransfer(false);
          setTransferTo("");
          setStatus("Ownership transferred. You are now an admin.");
        },
        onError: () => {
          setConfirmTransfer(false);
          setError("We couldn't transfer ownership.");
        },
      },
    );
  };

  useEffect(() => setName(org?.name ?? ""), [org?.name]);
  useEffect(() => setVisibility(org?.visibility ?? "PRIVATE"), [org?.visibility]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ name: name.trim(), visibility })
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
        <div>
          <span className="mb-2 block text-xs text-muted-foreground">Who can join</span>
          <div className="flex flex-col gap-2">
            {(["PRIVATE", "PUBLIC"] as Visibility[]).map((v) => (
              <label key={v} className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="visibility"
                  value={v}
                  checked={visibility === v}
                  disabled={!isOwner}
                  onChange={() => setVisibility(v)}
                  className="mt-1"
                />
                <span>
                  {v === "PRIVATE" ? "Private" : "Public"}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {VISIBILITY_HELP[v]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {isOwner && (
          <button type="submit" className="btn-base btn-primary w-40">
            Save changes
          </button>
        )}
      </form>

      <div className="mt-8">
        <p className="mb-2 text-xs text-muted-foreground">Invite code</p>
        <div className="flex items-center gap-4">
          <code className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground">
            {org?.invite_code}
          </code>
          {isManager && (
            <button
              type="button"
              disabled={rotate.isPending}
              onClick={rotateCode}
              className="btn-base btn-ghost"
            >
              {rotate.isPending ? "Generating…" : "Regenerate"}
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {org?.visibility === "PUBLIC"
            ? "Anyone with this code joins immediately. Regenerate it to cut off everyone who has the old one."
            : "People with this code have to be approved on the Team page."}
        </p>
      </div>

      <div className="mt-8">
        <p className="mb-2 text-xs text-muted-foreground">Your role</p>
        <p className="text-sm text-foreground">{org?.role}</p>
      </div>

      {isOwner && (
        <div className="mt-8">
          <p className="mb-2 text-xs text-muted-foreground">Transfer ownership</p>
          {transferCandidates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Invite someone else to this workspace first — ownership can only go to an existing
              member.
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <select
                aria-label="New owner"
                className="field"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
              >
                <option value="">Choose a member</option>
                {transferCandidates.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name || m.email}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!transferTo}
                onClick={() => setConfirmTransfer(true)}
                className="btn-base btn-ghost"
              >
                Transfer
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            They become the owner and you become an admin. Only the owner can rename, change who
            can join, or delete a workspace.
          </p>
        </div>
      )}

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

      {confirmTransfer && (
        <Modal title="Transfer ownership" onClose={() => setConfirmTransfer(false)} width={380}>
          <p className="text-sm text-foreground">
            Make {transferTarget?.name || transferTarget?.email} the owner?
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            You will be demoted to admin and will no longer be able to rename, change visibility on,
            or delete this workspace. Only the new owner can transfer it back.
          </p>
          <div className="mt-6 flex gap-4">
            <button
              type="button"
              onClick={() => setConfirmTransfer(false)}
              className="btn-base btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={transfer.isPending}
              onClick={doTransfer}
              className="btn-base btn-primary flex-1"
            >
              {transfer.isPending ? "Transferring…" : "Transfer"}
            </button>
          </div>
        </Modal>
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
