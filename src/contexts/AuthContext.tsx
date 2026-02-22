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
  const sessionRef = useRef<Session | null>(null); // garde la dernière session connue

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      
      if (event === "SIGNED_OUT") {
        // Ne déconnecter que si c'est explicitement demandé par l'utilisateur
        const isExplicit = localStorage.getItem("explicit_logout");
        if (!isExplicit) {
          // Refresh silencieux au lieu de déconnecter
          supabase.auth.refreshSession().then(({ data }) => {
            if (data.session) {
              sessionRef.current = data.session;
              setSession(data.session);
              setUser(data.session.user);
            }
            // Si pas de session après refresh, on garde la dernière session connue
            // pour éviter la boucle — l'utilisateur devra se reconnecter manuellement
            // seulement si le refresh échoue plusieurs fois
          }).catch(() => {});
          return; // Ne pas mettre à jour l'état avec null
        }
        localStorage.removeItem("explicit_logout");
        sessionRef.current = null;
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        sessionRef.current = newSession;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
        return;
      }

      // Pour les autres events, mettre à jour normalement
      if (newSession) {
        sessionRef.current = newSession;
        setSession(newSession);
        setUser(newSession.user);
      }
      setLoading(false);
    });

    // Récupérer la session existante au démarrage
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (existing) {
        sessionRef.current = existing;
        setSession(existing);
        setUser(existing.user);
        setLoading(false);
      } else {
        supabase.auth.refreshSession().then(({ data }) => {
          if (data.session) {
            sessionRef.current = data.session;
            setSession(data.session);
            setUser(data.session.user);
          }
        }).finally(() => setLoading(false));
      }
    });

    const timeout = setTimeout(() => setLoading(false), 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
