import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
      if (next?.user) {
        const u = next.user;
        setTimeout(async () => {
          try {
            const { error } = await supabase.from("profiles").upsert(
              {
                id: u.id,
                email: u.email ?? null,
                name:
                  (u.user_metadata?.["full_name"] as string) ??
                  (u.user_metadata?.["name"] as string) ??
                  u.email ??
                  "User",
                avatar_url: (u.user_metadata?.["avatar_url"] as string) ?? null,
              },
              { onConflict: "id" },
            );
            if (error) {
              console.error("Failed to create/update profile:", error);
            }
          } catch (err) {
            console.error("Profile creation error:", err);
          }
        }, 0);
      }
    });

    // getSession() only reads localStorage, so a deleted or banned user keeps a
    // "valid" session until their stateless JWT expires -- up to an hour of the
    // app happily re-creating their profile row. getUser() asks the server, so
    // the session is dropped on the next load instead.
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.getUser();
      if (error) {
        await supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(data.session);
      }
      setLoading(false);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
