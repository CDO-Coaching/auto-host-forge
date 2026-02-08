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
        // Si on perd le réseau et que Supabase tente un refresh qui échoue,
        // il envoie SIGNED_OUT. On ignore cette déconnexion si on est hors ligne
        // pour éviter de perdre la session de l'utilisateur.
        if (event === 'SIGNED_OUT' && !navigator.onLine) {
          console.log('Ignoring SIGNED_OUT event while offline');
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    // Quand on revient en ligne, tenter de rafraîchir la session silencieusement
    const handleOnline = () => {
      supabase.auth.getSession().then(({ data: { session: refreshedSession } }) => {
        if (refreshedSession) {
          setSession(refreshedSession);
          setUser(refreshedSession.user);
        }
      });
    };
    window.addEventListener('online', handleOnline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
