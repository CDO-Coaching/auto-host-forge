import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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

const EXPLICIT_LOGOUT_KEY = "explicit_logout";
const SESSION_BACKUP_KEY = "sb-session-backup";

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
  const recoveryTimeoutRef = useRef<number | null>(null);

  const clearExplicitLogoutFlag = useCallback(() => {
    sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
    localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
  }, []);

  const isExplicitLogout = useCallback(() => {
    return !!(
      sessionStorage.getItem(EXPLICIT_LOGOUT_KEY) ||
      localStorage.getItem(EXPLICIT_LOGOUT_KEY)
    );
  }, []);

  const setAuthState = useCallback((nextSession: Session | null) => {
    if (!isMounted.current) return;

    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (nextSession) {
      localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(nextSession));
    } else {
      localStorage.removeItem(SESSION_BACKUP_KEY);
    }
  }, []);

  const tryRecoverSession = useCallback(async (forceRefresh = false) => {
    if (refreshingRef.current) return false;

    refreshingRef.current = true;
    try {
      let recoveredSession: Session | null = null;

      if (!forceRefresh) {
        const { data } = await supabase.auth.getSession();
        recoveredSession = data.session;
      }

      if (!recoveredSession) {
        const { data } = await supabase.auth.refreshSession();
        recoveredSession = data.session;
      }

      if (recoveredSession) {
        setAuthState(recoveredSession);
        return true;
      }

      return false;
    } catch {
      return false;
    } finally {
      refreshingRef.current = false;
    }
  }, [setAuthState]);

  useEffect(() => {
    isMounted.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted.current) return;

      if (event === "SIGNED_OUT") {
        if (isExplicitLogout()) {
          clearExplicitLogoutFlag();
          setAuthState(null);
          return;
        }

        if (!navigator.onLine) {
          return;
        }

        if (recoveryTimeoutRef.current) {
          window.clearTimeout(recoveryTimeoutRef.current);
        }

        recoveryTimeoutRef.current = window.setTimeout(async () => {
          const recovered = await tryRecoverSession(true);
          if (!recovered && navigator.onLine && isMounted.current) {
            setAuthState(null);
          }
        }, 400);

        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (newSession) {
          setAuthState(newSession);
        }
      }
    });

    const initializeAuth = async () => {
      try {
        const { data: { session: existing } } = await supabase.auth.getSession();
        if (!isMounted.current) return;

        if (existing) {
          setAuthState(existing);
          return;
        }

        if (navigator.onLine) {
          const recovered = await tryRecoverSession(true);
          if (recovered) return;
        }

        const backup = localStorage.getItem(SESSION_BACKUP_KEY);
        if (backup) {
          try {
            const parsed = JSON.parse(backup) as Session;
            if (parsed?.access_token && parsed?.user) {
              setAuthState(parsed);
            }
          } catch {
            localStorage.removeItem(SESSION_BACKUP_KEY);
          }
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    const recoverOnVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void tryRecoverSession(true);
      }
    };

    const recoverOnOnline = () => {
      void tryRecoverSession(true);
    };

    initializeAuth();
    document.addEventListener("visibilitychange", recoverOnVisibility);
    window.addEventListener("online", recoverOnOnline);

    const timeout = window.setTimeout(() => {
      if (isMounted.current) setLoading(false);
    }, 5000);

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", recoverOnVisibility);
      window.removeEventListener("online", recoverOnOnline);
      if (recoveryTimeoutRef.current) {
        window.clearTimeout(recoveryTimeoutRef.current);
      }
      window.clearTimeout(timeout);
    };
  }, [clearExplicitLogoutFlag, isExplicitLogout, setAuthState, tryRecoverSession]);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
