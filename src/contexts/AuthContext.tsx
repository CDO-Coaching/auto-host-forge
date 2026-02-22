import { createContext, useContext, useEffect, useState } from "react";
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

  useEffect(() => {
    // 1. Écouter les changements d'auth en premier
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      // On ignore les SIGNED_OUT non explicites (token refresh échoué, réseau, etc.)
      if (event === "SIGNED_OUT") {
        const isExplicit = localStorage.getItem("explicit_logout");
        if (!isExplicit) return; // Pas de logout explicite → on ignore
        localStorage.removeItem("explicit_logout");
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    // 2. Récupérer la session existante
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (existing) {
        setSession(existing);
        setUser(existing.user);
        setLoading(false);
      } else {
        // Tenter un refresh au cas où le token est expiré mais récupérable
        supabase.auth
          .refreshSession()
          .then(({ data }) => {
            if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
            }
          })
          .finally(() => setLoading(false));
      }
    });

    // Timeout de sécurité si tout échoue
    const timeout = setTimeout(() => setLoading(false), 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return <AuthContext.Provider value={{ session, user, loading }}>{children}</AuthContext.Provider>;
};
