import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · Task CRM" },
      {
        name: "description",
        content: "Sign in to Task CRM with your Google account to manage your team's tasks.",
      },
      { property: "og:title", content: "Sign in · Task CRM" },
      {
        property: "og:description",
        content: "Sign in to Task CRM with your Google account to manage your team's tasks.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/setup" });
  }, [loading, session, navigate]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("We couldn't sign you in. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/setup" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-[400px]">
        <p className="text-sm font-semibold text-foreground">Task CRM</p>
        <h1 className="mt-8 text-2xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in with your Google account</p>
        <button
          type="button"
          onClick={() => void signIn()}
          disabled={busy}
          className="btn-base btn-primary mt-6 w-full"
        >
          {busy ? "Signing in…" : "Sign in with Google"}
        </button>
        {error && <p className="mt-4 text-xs text-destructive">{error}</p>}
        <p className="mt-8 text-xs text-muted-foreground">
          By continuing you agree to keep your workspace data tidy.
        </p>
      </div>
    </div>
  );
}
