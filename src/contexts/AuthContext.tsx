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
  const maxRetries = 3;

  // Retry refresh with exponential backoff when server returns 500
  const retryRefresh = async () => {
    if (refreshRetryCount.current >= maxRetries) {
      console.warn("[Auth] Max refresh retries reached, giving up");
      refreshRetryCount.current = 0;
      return;
    }

    const delay = Math.min(2000 * Math.pow(2, refreshRetryCount.current), 30000);
    refreshRetryCount.current++;
    console.log(`[Auth] Retry refresh #${refreshRetryCount.current} in ${delay}ms`);

    await new Promise(resolve => setTimeout(resolve, delay));

    if (!isMounted.current) return;

    try {
      const { data } = await supabase.auth.refreshSession();
      if (isMounted.current && data.session) {
        setSession(data.session);
        setUser(data.session.user);
        refreshRetryCount.current = 0;
        console.log("[Auth] Refresh retry succeeded");
      } else {
        // Retry again
        retryRefresh();
      }
    } catch {
      // Retry again
      retryRefresh();
    }
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
          // Keep current session in memory and trigger retry
          console.warn("[Auth] Non-explicit SIGNED_OUT ignored — keeping current session, scheduling retry");
          retryRefresh();
          return;
        }

        if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
          refreshRetryCount.current = 0; // Reset on success
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
              setSession(data.session);
              setUser(data.session.user);
            }
          })
          .catch(() => {
            // Server error (500) — schedule retry
            if (isMounted.current) retryRefresh();
          });
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
