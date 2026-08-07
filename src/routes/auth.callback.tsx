import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMyOrgs } from "@/lib/org";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

/**
 * A denied or failed consent comes back as error params rather than a session.
 * Depending on the flow they land in the query string or the hash, so check
 * both -- otherwise the redirect below just bounces the user to /login with no
 * indication of what went wrong.
 */
function readOAuthError(): string | null {
  if (typeof window === "undefined") return null;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const description = search.get("error_description") ?? hash.get("error_description");
  const code = search.get("error") ?? hash.get("error");
  if (!description && !code) return null;
  return description ?? code;
}

function AuthCallback() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { data: orgs, isLoading: orgsLoading } = useMyOrgs();
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => setOauthError(readOAuthError()), []);

  useEffect(() => {
    if (oauthError || loading) return;
    if (!session) {
      void navigate({ to: "/login" });
      return;
    }
    // Send established users to the board instead of flashing through /setup.
    if (!orgsLoading) {
      void navigate({ to: orgs && orgs.length > 0 ? "/dashboard/tasks" : "/setup" });
    }
  }, [oauthError, loading, session, orgsLoading, orgs, navigate]);

  if (oauthError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-[400px]">
          <span className="text-sm font-semibold text-foreground">Task CRM</span>
          <h1 className="mt-8 text-2xl font-semibold text-foreground">
            Sign in didn&apos;t finish
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Google didn&apos;t complete the sign in. You can try again.
          </p>
          <code className="mt-4 block rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
            {oauthError}
          </code>
          <Link to="/login" className="btn-base btn-primary mt-6 w-full">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
