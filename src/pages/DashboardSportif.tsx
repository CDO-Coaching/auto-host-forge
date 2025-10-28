import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default function DashboardSportif() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Vérifier que l'utilisateur est bien un sportif approuvé
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("approved, role, email")
        .eq("id", session.user.id)
        .single();

      if (error || !profile) {
        toast.error("Erreur lors du chargement du profil");
        navigate("/auth");
        return;
      }

      if (!profile.approved) {
        navigate("/en-attente");
        return;
      }

      if (profile.role === "coach") {
        navigate("/dashboard-coach");
        return;
      }

      setEmail(profile.email);
      setLoading(false);
    };

    checkAccess();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Dashboard Sportif</h1>
            <Button onClick={handleLogout} variant="outline">
              Se déconnecter
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Bienvenue Sportif</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Email: {email}</p>
              <p className="mt-4">Espace réservé aux sportifs - Contenu à venir</p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
