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
  const refreshRetryCount = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persistent retry: exponential backoff from 2s up to 5 minutes, NO max retries limit.
  // The session stays in memory and we keep trying until the server comes back.
  const retryRefresh = () => {
    if (!isMounted.current) return;

    // Clear any existing retry timer to avoid duplicates
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // Backoff: 2s, 4s, 8s, 16s, 32s, 60s, 120s, 300s (5min max)
    const delay = Math.min(2000 * Math.pow(2, refreshRetryCount.current), 5 * 60 * 1000);
    refreshRetryCount.current++;
    console.log(`[Auth] Retry refresh #${refreshRetryCount.current} in ${Math.round(delay / 1000)}s`);

    retryTimerRef.current = setTimeout(async () => {
      if (!isMounted.current) return;

      try {
        const { data } = await supabase.auth.refreshSession();
        if (isMounted.current && data.session) {
          setSession(data.session);
          setUser(data.session.user);
          refreshRetryCount.current = 0;
          console.log("[Auth] Refresh retry succeeded ✓");
        } else {
          // No session returned — keep retrying
          retryRefresh();
        }
      } catch {
        // Server still down — keep retrying
        retryRefresh();
      }
    }, delay);
  };

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

          // Non-explicit SIGNED_OUT (e.g. refresh_token 500):
          // Keep current session in memory and retry indefinitely
          console.warn("[Auth] Non-explicit SIGNED_OUT ignored — keeping session, retrying indefinitely");
          retryRefresh();
          return;
        }

        if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
          refreshRetryCount.current = 0;
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
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
              refreshRetryCount.current = 0;
              if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
              }
              setSession(data.session);
              setUser(data.session.user);
            }
          })
          .catch(() => {
            if (isMounted.current) retryRefresh();
          });
      }
    }, 10 * 60 * 1000);

    // Safety timeout for initial loading
    const timeout = setTimeout(() => {
      if (isMounted.current) setLoading(false);
    }, 5000);

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
      clearTimeout(timeout);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
