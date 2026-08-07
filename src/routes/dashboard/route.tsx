import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useOrg } from "@/lib/org";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { session, loading } = useAuth();
  const { org, loading: orgLoading } = useOrg();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!loading && session && !orgLoading && !org) void navigate({ to: "/setup" });
  }, [loading, session, orgLoading, org, navigate]);

  if (loading || orgLoading || !session || !org) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
