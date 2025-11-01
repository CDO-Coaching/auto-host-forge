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
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    // Attendre que le contexte d'auth ait fini de charger
    if (loading) return;

    // Si déjà connecté, rediriger
    if (session) {
      const redirectUser = async () => {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("approved, role")
          .eq("id", session.user.id)
          .single();

        if (!profile?.approved) {
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
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Connexion réussie" });
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { 
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { email }
          }
        });
        if (error) throw error;
        toast({ 
          title: "Inscription réussie", 
          description: "Veuillez confirmer votre email avant de vous connecter. En attente d'approbation par l'administrateur."
        });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
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
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div><Label>Mot de passe</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></div>
            <Button type="submit" variant="hero" className="w-full">{isLogin ? "Se connecter" : "S'inscrire"}</Button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline text-sm">
              {isLogin ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
            </button>
          </div>
          <Link to="/" className="block text-center mt-4 text-sm text-muted-foreground">← Retour</Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
