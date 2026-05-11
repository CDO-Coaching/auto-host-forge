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

// Backup key for persisting session tokens independently of Supabase JS internal storage
const SESSION_BACKUP_KEY = "cdo-session-backup";

// Returns true when the error signals that the refresh token is genuinely invalid
// (expired, revoked, or not found) — as opposed to a transient network/server error.
// In these cases we must NOT keep retrying; we clear the backup and sign the user out.
const isHardAuthError = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  // @supabase/supabase-js sets __isAuthError = true on AuthApiError
  if (e.__isAuthError === true) return true;
  // HTTP status codes that mean "token is definitively invalid"
  if (typeof e.status === "number" && [400, 401, 403].includes(e.status)) return true;
  // Message-based heuristics
  if (typeof e.message === "string") {
    const msg = (e.message as string).toLowerCase();
    if (
      msg.includes("invalid refresh token") ||
      msg.includes("refresh token not found") ||
      msg.includes("token has expired") ||
      msg.includes("user not found") ||
      msg.includes("invalid token")
    ) return true;
  }
  return false;
};

const saveSessionBackup = (s: Session) => {
  try {
    localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
    }));
  } catch { /* quota exceeded — ignore */ }
};

const getSessionBackup = (): { access_token: string; refresh_token: string } | null => {
  try {
    const raw = localStorage.getItem(SESSION_BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
};

const clearSessionBackup = () => {
  try { localStorage.removeItem(SESSION_BACKUP_KEY); } catch { /* ignore */ }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);
  const refreshRetryCount = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRetrying = useRef(false);

  // Persistent retry: exponential backoff from 2s up to 5 minutes, NO limit.
  // Key difference: we restore the session from our backup before each retry,
  // because Supabase JS clears its internal storage on SIGNED_OUT.
  const retryRefresh = () => {
    if (!isMounted.current) return;
    if (isRetrying.current) return; // avoid duplicate retry chains
    isRetrying.current = true;

    const scheduleNext = () => {
      if (!isMounted.current) return;

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      // Backoff: 2s, 4s, 8s, 16s, 32s, 60s, 120s, 300s (5min max)
      const delay = Math.min(2000 * Math.pow(2, refreshRetryCount.current), 5 * 60 * 1000);
      refreshRetryCount.current++;
      console.log(`[Auth] Retry refresh #${refreshRetryCount.current} in ${Math.round(delay / 1000)}s`);

      retryTimerRef.current = setTimeout(async () => {
        if (!isMounted.current) { isRetrying.current = false; return; }

        try {
          // Restore tokens from our independent backup so Supabase JS has something to refresh
          const backup = getSessionBackup();
          if (backup) {
            await supabase.auth.setSession({
              access_token: backup.access_token,
              refresh_token: backup.refresh_token,
            });
          }

          const { data, error } = await supabase.auth.refreshSession();

          // Hard auth error: token truly invalid/revoked — stop retrying immediately
          if (error && isHardAuthError(error)) {
            console.warn("[Auth] Hard auth error during retry — stopping, clearing session", error.message);
            clearSessionBackup();
            if (isMounted.current) {
              setSession(null);
              setUser(null);
            }
            isRetrying.current = false;
            return;
          }

          if (isMounted.current && data.session) {
            setSession(data.session);
            setUser(data.session.user);
            saveSessionBackup(data.session);
            refreshRetryCount.current = 0;
            isRetrying.current = false;
            console.log("[Auth] Refresh retry succeeded ✓");
            return;
          }
          // No session, no hard error (transient) — keep retrying
          scheduleNext();
        } catch (err) {
          // Hard auth error thrown (not returned) — stop retrying
          if (isHardAuthError(err)) {
            console.warn("[Auth] Hard auth error (thrown) during retry — stopping, clearing session");
            clearSessionBackup();
            if (isMounted.current) {
              setSession(null);
              setUser(null);
            }
            isRetrying.current = false;
            return;
          }
          // Transient network/server error — keep retrying
          scheduleNext();
        }
      }, delay);
    };

    scheduleNext();
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
            clearSessionBackup();
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
          isRetrying.current = false;
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
          if (newSession) {
            setSession(newSession);
            setUser(newSession.user);
            saveSessionBackup(newSession);
          }
          return;
        }

        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          saveSessionBackup(newSession);
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
          saveSessionBackup(existing);
        } else {
          // No session from Supabase JS — try our backup
          const backup = getSessionBackup();
          if (backup) {
            console.log("[Auth] No active session, restoring from backup...");
            try {
              const { data } = await supabase.auth.setSession({
                access_token: backup.access_token,
                refresh_token: backup.refresh_token,
              });
              if (isMounted.current && data.session) {
                setSession(data.session);
                setUser(data.session.user);
                saveSessionBackup(data.session);
                console.log("[Auth] Session restored from backup ✓");
              }
            } catch {
              console.warn("[Auth] Backup restore failed, starting fresh");
              clearSessionBackup();
            }
          }
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    initializeAuth();

    // 3. Proactive token refresh every 10 minutes as safety net
    const refreshInterval = setInterval(async () => {
      if (!isMounted.current || isRetrying.current) return;
      try {
        const { data, error } = await supabase.auth.refreshSession();
        // Hard auth error: token truly invalid — clear session, do NOT retry
        if (error && isHardAuthError(error)) {
          console.warn("[Auth] Hard auth error in proactive refresh — clearing session", error.message);
          clearSessionBackup();
          if (isMounted.current) { setSession(null); setUser(null); }
          return;
        }
        if (isMounted.current && data.session) {
          refreshRetryCount.current = 0;
          isRetrying.current = false;
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
          setSession(data.session);
          setUser(data.session.user);
          saveSessionBackup(data.session);
        }
      } catch (err) {
        if (isHardAuthError(err)) {
          console.warn("[Auth] Hard auth error (thrown) in proactive refresh — clearing session");
          clearSessionBackup();
          if (isMounted.current) { setSession(null); setUser(null); }
          return;
        }
        if (isMounted.current) retryRefresh();
      }
    }, 10 * 60 * 1000);

    // 4. On visibility change (user comes back to app), try a refresh
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible" || !isMounted.current) return;
      if (isRetrying.current) return; // don't interfere with retry loop

      try {
        // First restore backup in case Supabase JS lost internal state
        const backup = getSessionBackup();
        if (backup) {
          await supabase.auth.setSession({
            access_token: backup.access_token,
            refresh_token: backup.refresh_token,
          });
        }
        const { data } = await supabase.auth.refreshSession();
        if (isMounted.current && data.session) {
          setSession(data.session);
          setUser(data.session.user);
          saveSessionBackup(data.session);
          refreshRetryCount.current = 0;
        }
      } catch {
        // Will be handled by the regular retry mechanism
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Safety timeout for initial loading
    const timeout = setTimeout(() => {
      if (isMounted.current) setLoading(false);
    }, 5000);

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
