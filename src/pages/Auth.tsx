import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import cdoLogo from "@/assets/cdo-logo.png";
import { useAuth } from "@/contexts/AuthContext";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (session) {
      const redirectUser = async () => {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("approved, role, first_name, last_name")
          .eq("id", session.user.id)
          .single();

        // Vérifier si le profil est complet
        if (!profile?.first_name || !profile?.last_name) {
          navigate("/sportif/profil");
        } else if (!profile?.approved) {
          navigate("/en-attente");
        } else if (profile.role === "coach") {
          navigate("/coach/programmation");
        } else {
          navigate("/sportif/seances");
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
            navigate("/coach/programmation");
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

        toast({
          title: "Inscription réussie",
          description: "Confirme ton email pour compléter ton profil.",
        });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={cdoLogo} alt="CDO Coaching" className="h-20 w-20 mx-auto mb-4" />
          <CardTitle>{isLogin ? "Connexion" : "Inscription"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {/* Email */}
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            {/* Mot de passe */}
            <div>
              <Label>Mot de passe</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Chargement..." : isLogin ? "Se connecter" : "S'inscrire"}
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
  );
};

export default Auth;
