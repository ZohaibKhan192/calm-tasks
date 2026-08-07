import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Task CRM · Minimal team task tracker" },
      {
        name: "description",
        content:
          "Task CRM is a clean, minimal kanban task tracker for small teams: workspaces, roles and drag-and-drop tasks.",
      },
      { property: "og:title", content: "Task CRM · Minimal team task tracker" },
      {
        property: "og:description",
        content:
          "Task CRM is a clean, minimal kanban task tracker for small teams: workspaces, roles and drag-and-drop tasks.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    void navigate({ to: session ? "/dashboard/tasks" : "/login" });
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
