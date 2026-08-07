import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useCreateOrg,
  useJoinByCode,
  useMyOrgs,
  useMyPendingRequests,
  useOrg,
  type Visibility,
} from "@/lib/org";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Create your workspace · Task CRM" },
      {
        name: "description",
        content: "Name your Task CRM workspace and start tracking your team's work.",
      },
      { property: "og:title", content: "Create your workspace · Task CRM" },
      {
        property: "og:description",
        content: "Name your Task CRM workspace and start tracking your team's work.",
      },
    ],
  }),
  component: SetupPage,
});

const VISIBILITY_HELP: Record<Visibility, string> = {
  PRIVATE: "People who have the code must be approved by an owner or admin before they join.",
  PUBLIC: "Anyone who has the code joins immediately, with no approval step.",
};

function SetupPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const { data: orgs, isLoading: orgsLoading } = useMyOrgs();
  const { data: pending } = useMyPendingRequests();
  const { setOrgId } = useOrg();
  const createOrg = useCreateOrg();
  const joinOrg = useJoinByCode();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!orgsLoading && orgs && orgs.length > 0 && !manual) {
      void navigate({ to: "/dashboard/tasks" });
    }
  }, [orgs, orgsLoading, manual, navigate]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("new=1")) setManual(true);
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a workspace name.");
      return;
    }
    setError(null);
    try {
      const id = await createOrg.mutateAsync({ name: name.trim(), visibility });
      setOrgId(id);
      void navigate({ to: "/dashboard/tasks" });
    } catch {
      setError("We couldn't create the workspace. Please try again.");
    }
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRequested(false);
    try {
      const { status, orgId } = await joinOrg.mutateAsync(code.trim());
      if (status === "PENDING") {
        setRequested(true);
        setCode("");
        return;
      }
      if (orgId) setOrgId(orgId);
      void navigate({ to: "/dashboard/tasks" });
    } catch {
      setError("That workspace code doesn't look right.");
    }
  };

  if (loading || orgsLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center border-b border-border px-6">
        <span className="text-sm font-semibold text-foreground">Task CRM</span>
      </header>
      <div className="mx-auto mt-12 w-full max-w-[500px] px-6">
        <h1 className="text-2xl font-semibold text-foreground">Create your workspace</h1>
        <form onSubmit={create} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="ws" className="mb-2 block text-xs text-muted-foreground">
              Workspace name
            </label>
            <input
              id="ws"
              className="field"
              placeholder="e.g., Acme Corp"
              value={name}
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

          <button
            type="submit"
            disabled={createOrg.isPending}
            className="btn-base btn-primary w-full"
          >
            Create workspace
          </button>
        </form>

        <div className="mt-12 border-t border-border pt-6">
          <h2 className="text-sm font-semibold text-foreground">Join an existing workspace</h2>
          <form onSubmit={join} className="mt-4 flex flex-col gap-4">
            <div>
              <label htmlFor="code" className="mb-2 block text-xs text-muted-foreground">
                Workspace code
              </label>
              <input
                id="code"
                className="field"
                placeholder="Paste the code you were sent"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={!code.trim() || joinOrg.isPending}
              className="btn-base btn-ghost w-full"
            >
              {joinOrg.isPending ? "Requesting…" : "Join workspace"}
            </button>
          </form>
        </div>

        {requested && (
          <p className="mt-4 text-xs text-muted-foreground">
            Request sent. An owner or admin has to approve it before you can see the workspace.
          </p>
        )}
        {error && <p className="mt-4 text-xs text-destructive">{error}</p>}

        {pending && pending.length > 0 && (
          <div className="mt-12 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-foreground">Waiting for approval</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {pending.map((p) => (
                <li
                  key={p.id}
                  className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
                >
                  {p.org_name ?? p.org_id}
                  <span className="mt-1 block text-xs text-muted-foreground">Pending</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
