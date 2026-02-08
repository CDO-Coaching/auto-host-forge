import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function EnAttente() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      setEmail(session.user.email || "");

      // Vérifier le statut d'approbation
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("approved, role, first_name, last_name")
        .eq("id", session.user.id)
        .single();

      // Si le profil n'existe pas (compte supprimé), déconnecter proprement
      if (error || !profile) {
        await supabase.auth.signOut();
        navigate("/auth", { replace: true });
        return;
      }

      // Vérifier si le profil est complet
      if (!profile.first_name || !profile.last_name) {
        navigate("/sportif/profil", { replace: true });
        return;
      }

      if (profile.approved) {
        // Si approuvé, rediriger vers le bon dashboard
        if (profile.role === "coach") {
          navigate("/coach/programmation", { replace: true });
        } else {
          navigate("/sportif/dashboard", { replace: true });
        }
      }
    };

    checkUser();
  }, [navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erreur lors de la déconnexion");
    } else {
      toast.success("Déconnexion réussie");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Compte en attente</CardTitle>
            <CardDescription>
              Ton compte est en attente de validation par l'administrateur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Email: <span className="font-medium text-foreground">{email}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Tu recevras un email dès que ton compte sera validé.
              </p>
            </div>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
