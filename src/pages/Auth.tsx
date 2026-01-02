import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import cdoLogo from "@/assets/cdo-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { Mail } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    // Ne pas rediriger si on vient du callback ou de la confirmation d'email
    const fromCallback = sessionStorage.getItem('from_callback');
    const justConfirmed = sessionStorage.getItem('just_confirmed_email');
    
    if (fromCallback || justConfirmed) {
      sessionStorage.removeItem('from_callback');
      sessionStorage.removeItem('just_confirmed_email');
      return;
    }

    if (session) {
      const redirectUser = async () => {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("approved, role, first_name, last_name")
          .eq("id", session.user.id)
          .single();

        // Vérifier si le profil est complet
        if (!profile?.first_name || !profile?.last_name) {
          navigate("/sportif/profil", { replace: true });
        } else if (!profile?.approved) {
          navigate("/en-attente", { replace: true });
        } else if (profile.role === "coach") {
          navigate("/coach/mes-clients", { replace: true });
        } else {
          navigate("/sportif/seances", { replace: true });
        }
      };

      redirectUser();
    }
  }, [session, loading, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        toast({ title: "Connexion réussie" });
        
        // Redirection explicite après connexion
        if (data.user) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("approved, role, first_name, last_name")
            .eq("id", data.user.id)
            .single();

          // Vérifier si le profil est complet
          if (!profile?.first_name || !profile?.last_name) {
            navigate("/sportif/profil");
          } else if (!profile?.approved) {
            navigate("/en-attente");
          } else if (profile.role === "coach") {
            navigate("/coach/mes-clients");
          } else {
            navigate("/sportif/seances");
          }
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;

        const userId = data.user?.id;

        // Création du profil utilisateur avec seulement le rôle
        await supabase.from("user_profiles").insert({
          id: userId,
          email: email,
          role: "sportif",
          approved: false,
        });

        // Notification webhook
        await supabase.functions
          .invoke("notify-signup", {
            body: { email, signupDate: new Date().toISOString() },
          })
          .catch(() => {});

        setShowEmailDialog(true);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AlertDialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-2xl">
              Vérifie ton email !
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-base space-y-3 pt-2">
              <p>
                Nous t'avons envoyé un email de confirmation à <strong>{email}</strong>
              </p>
              <p>
                Clique sur le lien dans l'email pour valider ton compte et compléter ton profil.
              </p>
              <p className="text-destructive font-medium">
                ⚠️ N'oublie pas de vérifier tes spams !
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => setShowEmailDialog(false)} className="w-full">
              J'ai compris
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={cdoLogo} alt="CDO Coaching" className="h-20 w-20 mx-auto mb-4" />
          {isLogin ? (
            <CardTitle>Connexion</CardTitle>
          ) : (
            <div className="space-y-2">
              <CardTitle className="text-2xl">Bienvenue ! 👋</CardTitle>
              <p className="text-muted-foreground text-sm">
                Content de te voir ici ! J'espère que tu as déjà échangé avec Corentin avant de t'inscrire.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {/* Email */}
            <div>
              <Label>{isLogin ? "Email" : "Ton adresse email"}</Label>
              <Input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder={isLogin ? "" : "exemple@email.com"}
                required 
              />
            </div>

            {/* Mot de passe */}
            <div>
              <Label>{isLogin ? "Mot de passe" : "Choisis un mot de passe"}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? "" : "Minimum 6 caractères"}
                required
                minLength={6}
              />
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Chargement..." : isLogin ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline text-sm">
              {isLogin ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
            </button>
          </div>

          <Link to="/" className="block text-center mt-4 text-sm text-muted-foreground">
            ← Retour
          </Link>
        </CardContent>
      </Card>
    </div>
    </>
  );
};

export default Auth;
