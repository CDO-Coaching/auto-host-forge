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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Ignorer les déconnexions non intentionnelles
        // (hors ligne, token refresh échoué, visibilité changée)
        if (event === 'SIGNED_OUT') {
          // Si on est hors ligne, on ignore totalement
          if (!navigator.onLine) {
            console.log('Ignoring SIGNED_OUT event while offline');
            return;
          }
          // Si c'est un sign-out explicite (pas de session backup), on accepte
          const wasExplicitLogout = sessionStorage.getItem('explicit_logout');
          if (!wasExplicitLogout) {
            // Vérifier si on a une session sauvegardée - c'est probablement
            // un token refresh qui a échoué, pas un vrai logout
            const backupKey = `sb-session-backup`;
            const backup = localStorage.getItem(backupKey);
            if (backup) {
              console.log('Ignoring unexpected SIGNED_OUT, will retry refresh');
              // Tenter un refresh silencieux
              supabase.auth.refreshSession().then(({ data }) => {
                if (data.session) {
                  setSession(data.session);
                  setUser(data.session.user);
                }
              }).catch(() => {});
              return;
            }
          }
          sessionStorage.removeItem('explicit_logout');
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        // Sauvegarder la session en backup pour résister aux déconnexions
        if (newSession) {
          localStorage.setItem('sb-session-backup', JSON.stringify({
            userId: newSession.user.id,
            email: newSession.user.email,
            timestamp: Date.now(),
          }));
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem('sb-session-backup');
          localStorage.removeItem('last_route');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (existingSession) {
        setSession(existingSession);
        setUser(existingSession.user);
        setLoading(false);
      } else {
        // Si pas de session mais qu'on a un backup, tenter un refresh
        const backup = localStorage.getItem('sb-session-backup');
        if (backup) {
          supabase.auth.refreshSession().then(({ data }) => {
            if (data.session) {
              setSession(data.session);
              setUser(data.session.user);
            } else {
              // Le refresh a répondu mais sans session valide
              // Ne PAS déconnecter si on est hors ligne
              if (!navigator.onLine) {
                console.log('Offline + no session refresh, keeping backup state');
              } else {
                // Vraiment plus de session valide, nettoyer
                localStorage.removeItem('sb-session-backup');
              }
            }
            setLoading(false);
          }).catch(() => {
            // Erreur réseau sur le refresh - garder l'état "connecté" en attente
            console.log('Network error on refreshSession, keeping loading until online');
            // Ne pas setLoading(false) si hors ligne - on attend le retour réseau
            if (navigator.onLine) {
              setLoading(false);
            }
          });
        } else {
          setLoading(false);
        }
      }
    }).catch(() => {
      // En cas d'erreur réseau, ne pas déconnecter
      const backup = localStorage.getItem('sb-session-backup');
      if (backup) {
        console.log('Network error on getSession, keeping session from backup');
        // Ne pas setLoading(false) si hors ligne - attendre la reconnexion
        if (navigator.onLine) {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    // Timeout de sécurité : si loading est toujours true après 5s, débloquer
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    // Quand on revient en ligne, tenter de rafraîchir la session silencieusement
    const handleOnline = () => {
      supabase.auth.refreshSession().then(({ data }) => {
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
        }
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    };
    window.addEventListener('online', handleOnline);

    // Quand l'app revient au premier plan (mobile), refresh la session
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.refreshSession().then(({ data }) => {
          if (data.session) {
            setSession(data.session);
            setUser(data.session.user);
          }
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscription.unsubscribe();
      clearTimeout(loadingTimeout);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
