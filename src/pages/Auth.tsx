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

  // Champs supplémentaires pour inscription
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");

  const navigate = useNavigate();
  const { session, loading } = useAuth();

  // Quand l'utilisateur est connecté → on insère / met à jour le profil depuis user_metadata
  useEffect(() => {
    if (loading || !session) return;

    const syncProfile = async () => {
      const u = session.user;
      const m = u.user_metadata || {};

      await supabase.from("user_profiles").upsert(
        {
          id: u.id,
          first_name: m.first_name ?? null,
          last_name: m.last_name ?? null,
          date_of_birth: m.date_of_birth ?? null,
          gender: m.gender ?? null,
          role: m.role ?? "sportif",
        },
        { onConflict: "id" },
      );

      const { data: profile } = await supabase.from("user_profiles").select("approved, role").eq("id", u.id).single();

      if (!profile?.approved) navigate("/en-attente");
      else if (profile.role === "coach") navigate("/coach/programmation");
      else navigate("/sportif/seances");
    };

    syncProfile();
  }, [session, loading, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Connexion réussie" });
      } else {
        // ⬇️ ICI → on sauvegarde les données dans user_metadata
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              first_name: firstName,
              last_name: lastName,
              date_of_birth: birthDate,
              gender,
              role: "sportif",
            },
          },
        });
        if (error) throw error;

        // Notification (facultatif, inchangé)
        await supabase.functions
          .invoke("notify-signup", {
            body: { email, signupDate: new Date().toISOString() },
          })
          .catch(() => {});

        toast({
          title: "Inscription réussie",
          description: "Confirme ton email avant connexion. Ton compte devra ensuite être approuvé.",
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
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

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

            {!isLogin && (
              <>
                <div>
                  <Label>Prénom</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>

                <div>
                  <Label>Nom</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>

                <div>
                  <Label>Date de naissance</Label>
                  <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
                </div>

                <div>
                  <Label>Genre</Label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    required
                    className="w-full rounded-md border bg-transparent px-3 py-2"
                  >
                    <option value="">Sélectionne</option>
                    <option value="Homme">Homme</option>
                    <option value="Femme">Femme</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </>
            )}

            <Button type="submit" variant="hero" className="w-full">
              {isLogin ? "Se connecter" : "S'inscrire"}
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
