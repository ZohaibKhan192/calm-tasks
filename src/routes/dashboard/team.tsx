import { createFileRoute } from "@tanstack/react-router";
import { Avatar } from "@/components/Avatar";
import { Skeleton } from "@/components/Skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMembers, useOrg, type Role } from "@/lib/org";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/dashboard/team")({
  head: () => ({
    meta: [
      { title: "Team · Task CRM" },
      {
        name: "description",
        content: "See everyone in your Task CRM workspace and manage their roles.",
      },
      { property: "og:title", content: "Team · Task CRM" },
      {
        property: "og:description",
        content: "See everyone in your Task CRM workspace and manage their roles.",
      },
    ],
  }),
  component: TeamPage,
});

const ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER"];

function TeamPage() {
  const { org } = useOrg();
  const { user } = useAuth();
  const { data: members, isLoading } = useMembers(org?.id);
  const qc = useQueryClient();
  const isManager = org?.role === "OWNER" || org?.role === "ADMIN";

  const changeRole = async (id: string, role: Role) => {
    await supabase.from("memberships").update({ role }).eq("id", id);
    await qc.invalidateQueries({ queryKey: ["members"] });
    await qc.invalidateQueries({ queryKey: ["orgs"] });
  };

  const remove = async (id: string) => {
    await supabase.from("memberships").delete().eq("id", id);
    await qc.invalidateQueries({ queryKey: ["members"] });
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Team</h1>
      <p className="mt-2 text-xs text-muted-foreground">People in {org?.name}</p>

      <div className="mt-8 rounded-md border border-border">
        {isLoading ? (
          <div className="flex flex-col gap-4 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          (members ?? []).map((m, i) => (
            <div
              key={m.id}
              className={`flex items-center justify-between gap-4 p-4 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <Avatar name={m.name} email={m.email} url={m.avatar_url} size={32} />
                <div>
                  <p className="text-sm text-foreground">{m.name || m.email}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {isManager && m.user_id !== org?.owner_id ? (
                  <select
                    aria-label={`Role for ${m.name || m.email}`}
                    className="field w-36"
                    value={m.role}
                    onChange={(e) => void changeRole(m.id, e.target.value as Role)}
                  >
                    {ROLES.filter((r) => r !== "OWNER").map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-muted-foreground">{m.role}</span>
                )}
                {isManager && m.user_id !== org?.owner_id && m.user_id !== user?.id && (
                  <button
                    type="button"
                    onClick={() => void remove(m.id)}
                    className="text-xs font-medium text-destructive hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
