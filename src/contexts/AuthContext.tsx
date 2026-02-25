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
  const refreshingRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;

    // 1. Listener for ONGOING auth changes — does NOT control loading
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

          // Non-explicit SIGNED_OUT: try silent refresh but NEVER clear state
          // The user must never be kicked out unless they explicitly log out
          if (!refreshingRef.current) {
            refreshingRef.current = true;
            setTimeout(async () => {
              try {
                const { data } = await supabase.auth.refreshSession();
                if (isMounted.current && data.session) {
                  setSession(data.session);
                  setUser(data.session.user);
                }
                // If refresh fails → keep existing session, don't clear
              } catch {
                console.warn("[Auth] Silent refresh failed, keeping current session");
              } finally {
                refreshingRef.current = false;
              }
            }, 0);
          }
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

    // 2. INITIAL load — controls loading
    const initializeAuth = async () => {
      try {
        const { data: { session: existing } } = await supabase.auth.getSession();
        if (!isMounted.current) return;

        if (existing) {
          setSession(existing);
          setUser(existing.user);
        } else {
          // No stored session — try a refresh in case the token is still valid
          try {
            const { data } = await supabase.auth.refreshSession();
            if (isMounted.current && data.session) {
              setSession(data.session);
              setUser(data.session.user);
            }
          } catch {
            // No valid session at all
          }
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    initializeAuth();

    // 3. Re-acquire session when app comes back to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !refreshingRef.current) {
        refreshingRef.current = true;
        supabase.auth.refreshSession().then(({ data }) => {
          if (isMounted.current && data.session) {
            setSession(data.session);
            setUser(data.session.user);
          }
        }).catch(() => {}).finally(() => {
          refreshingRef.current = false;
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. Proactive token refresh every 10 minutes to prevent expiry
    const refreshInterval = setInterval(() => {
      if (!refreshingRef.current && isMounted.current) {
        refreshingRef.current = true;
        supabase.auth.refreshSession()
          .then(({ data }) => {
            if (isMounted.current && data.session) {
              setSession(data.session);
              setUser(data.session.user);
            }
          })
          .catch(() => {})
          .finally(() => { refreshingRef.current = false; });
      }
    }, 10 * 60 * 1000);

    // Safety timeout
    const timeout = setTimeout(() => {
      if (isMounted.current) setLoading(false);
    }, 5000);

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
