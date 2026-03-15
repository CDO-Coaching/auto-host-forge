import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    // 1. Listener for ONGOING auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted.current) return;

        if (event === "SIGNED_OUT") {
          const isExplicit =
            sessionStorage.getItem("explicit_logout") ||
            localStorage.getItem("explicit_logout");

          if (isExplicit) {
            sessionStorage.removeItem("explicit_logout");
            localStorage.removeItem("explicit_logout");
            setSession(null);
            setUser(null);
            return;
          }

          // Non-explicit SIGNED_OUT: do NOT clear state, do NOT try refreshSession.
          // autoRefreshToken handles background refreshes. Keep existing session in memory.
          console.warn("[Auth] Non-explicit SIGNED_OUT ignored — keeping current session");
          return;
        }

        if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          return;
        }

        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
        }
      }
    );

    // 2. INITIAL load
    const initializeAuth = async () => {
      try {
        const { data: { session: existing } } = await supabase.auth.getSession();
        if (!isMounted.current) return;

        if (existing) {
          setSession(existing);
          setUser(existing.user);
        }
        // If no session, user is simply not logged in. No need to force refresh.
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    initializeAuth();

    // 3. Proactive token refresh every 10 minutes as safety net
    const refreshInterval = setInterval(() => {
      if (isMounted.current) {
        supabase.auth.refreshSession()
          .then(({ data }) => {
            if (isMounted.current && data.session) {
              setSession(data.session);
              setUser(data.session.user);
            }
          })
          .catch(() => {});
      }
    }, 10 * 60 * 1000);

    // Safety timeout
    const timeout = setTimeout(() => {
      if (isMounted.current) setLoading(false);
    }, 5000);

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
