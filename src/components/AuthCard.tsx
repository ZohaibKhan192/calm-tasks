import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyOrgs } from "@/lib/org";

/** Google's standard mark, for the light button treatment in their guidelines. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H1.96v2.33A8.99 8.99 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H1.96A8.99 8.99 0 0 0 1 9c0 1.45.35 2.82.96 4.05l2.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A8.99 8.99 0 0 0 1.96 4.95l2.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/**
 * Shell shared by /login and /signup.
 *
 * Google OAuth makes the two operations identical -- Supabase creates the
 * account on first callback -- so the pages differ only in wording. Keeping the
 * behaviour in one place stops them drifting into two subtly different flows.
 */
export function AuthCard({
  heading,
  subheading,
  buttonLabel,
  footer,
}: {
  heading: string;
  subheading: string;
  buttonLabel: string;
  footer: ReactNode;
}) {
  const { session, loading } = useAuth();
  const { data: orgs, isLoading: orgsLoading } = useMyOrgs();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in: skip straight past. New accounts have no workspace yet.
  useEffect(() => {
    if (!loading && session && !orgsLoading) {
      void navigate({ to: orgs && orgs.length > 0 ? "/dashboard/tasks" : "/setup" });
    }
  }, [loading, session, orgsLoading, orgs, navigate]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser leaves for Google, so this only runs on failure.
    if (err) {
      setError("We couldn't reach Google just now. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-[400px]">
        <Link to="/" className="text-sm font-semibold text-foreground">
          Task CRM
        </Link>

        <h1 className="mt-8 text-2xl font-semibold text-foreground">{heading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subheading}</p>

        <button
          type="button"
          onClick={() => void signIn()}
          disabled={busy}
          className="btn-base btn-ghost mt-6 w-full"
        >
          {busy ? (
            "Redirecting…"
          ) : (
            <>
              <GoogleMark />
              {buttonLabel}
            </>
          )}
        </button>

        {error && <p className="mt-4 text-xs text-destructive">{error}</p>}

        <div className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
          {footer}
        </div>
      </div>
    </div>
  );
}
