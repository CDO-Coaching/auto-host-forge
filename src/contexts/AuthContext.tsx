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

/** Returns true when the JWT expires in less than `marginMs` milliseconds. */
const isTokenExpiringSoon = (session: Session | null, marginMs = 5 * 60 * 1000): boolean => {
  if (!session?.expires_at) return true;
  const expiresAtMs = session.expires_at * 1000;
  return Date.now() > expiresAtMs - marginMs;
};

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
  const recoveryFailureCountRef = useRef(0);
  const currentSessionRef = useRef<Session | null>(null);

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

    currentSessionRef.current = nextSession;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (nextSession) {
      localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(nextSession));
    } else {
      localStorage.removeItem(SESSION_BACKUP_KEY);
    }
  }, []);

  const restoreBackupSession = useCallback(() => {
    const backup = localStorage.getItem(SESSION_BACKUP_KEY);
    if (!backup) return false;

    try {
      const parsed = JSON.parse(backup) as Session;
      if (parsed?.access_token && parsed?.user) {
        setAuthState(parsed);
        return true;
      }
    } catch {
      localStorage.removeItem(SESSION_BACKUP_KEY);
    }

    return false;
  }, [setAuthState]);

  const tryRecoverSession = useCallback(async (_forceRefresh = false) => {
    if (refreshingRef.current) return false;

    refreshingRef.current = true;
    try {
      // 1. ALWAYS try getSession() first – reads from local storage, no network call
      const { data: localData } = await supabase.auth.getSession();
      const localSession = localData.session;

      if (localSession && !isTokenExpiringSoon(localSession)) {
        // Token still valid – use it, do NOT call refreshSession()
        recoveryFailureCountRef.current = 0;
        setAuthState(localSession);
        return true;
      }

      // 2. We have a session but token is expiring soon – try to refresh
      //    Save reference BEFORE refreshing so we can fall back
      const fallbackSession = localSession || currentSessionRef.current;

      if (localSession) {
        try {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData.session) {
            recoveryFailureCountRef.current = 0;
            setAuthState(refreshData.session);
            return true;
          }
        } catch (e) {
          console.warn("refreshSession() failed (server error), keeping existing session:", e);
        }

        // refreshSession() failed – keep using the existing session if still usable
        if (fallbackSession?.access_token && fallbackSession?.user) {
          // Re-set it to make sure it stays in state
          setAuthState(fallbackSession);
          return true;
        }
      }

      // 3. No local session at all – try restoring from our backup
      return restoreBackupSession();
    } catch {
      return restoreBackupSession();
    } finally {
      refreshingRef.current = false;
    }
  }, [restoreBackupSession, setAuthState]);

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

        // If offline, ignore completely
        if (!navigator.onLine) {
          return;
        }

        // If we have a known session, the SIGNED_OUT was likely spurious (failed refresh)
        // → restore from backup instead of clearing
        const hasKnownSession = !!currentSessionRef.current || !!localStorage.getItem(SESSION_BACKUP_KEY);
        if (hasKnownSession) {
          if (recoveryTimeoutRef.current) {
            window.clearTimeout(recoveryTimeoutRef.current);
          }
          recoveryTimeoutRef.current = window.setTimeout(() => {
            void tryRecoverSession();
          }, 500);
          return;
        }

        // Genuinely no session – clear state
        recoveryFailureCountRef.current += 1;
        if (recoveryFailureCountRef.current >= 5) {
          setAuthState(null);
        }

        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        recoveryFailureCountRef.current = 0;
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
          // Only refresh if token is expiring soon
          if (isTokenExpiringSoon(existing)) {
            void tryRecoverSession();
          }
          return;
        }

        if (navigator.onLine) {
          const recovered = await tryRecoverSession();
          if (recovered) return;
        }

        if (restoreBackupSession()) {
          return;
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    const recoverOnVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        // Only refresh if token is expiring soon, otherwise just validate from cache
        void tryRecoverSession();
      }
    };

    const recoverOnOnline = () => {
      void tryRecoverSession();
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
  }, [clearExplicitLogoutFlag, isExplicitLogout, restoreBackupSession, setAuthState, tryRecoverSession]);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
