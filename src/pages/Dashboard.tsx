import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const checkUserApproval = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserEmail(session.user.email || "");

      // Check if user is approved
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('approved')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        setIsApproved(false);
      } else {
        setIsApproved(profile?.approved || false);
      }
      
      setLoading(false);
    };

    checkUserApproval();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => { 
      if (!session) {
        navigate("/auth");
      } else {
        checkUserApproval();
      }
    });
    
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    sessionStorage.setItem('explicit_logout', 'true');
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ variant: "destructive", title: "Erreur lors de la déconnexion" });
    } else {
      toast({ title: "Déconnexion réussie" });
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-foreground text-xl">Chargement...</p>
      </div>
    );
  }

  if (isApproved === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Compte en attente d'approbation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-center">
              Votre compte ({userEmail}) a été créé avec succès mais est en attente d'approbation par l'administrateur.
            </p>
            <p className="text-muted-foreground text-center text-sm">
              Vous recevrez une notification une fois votre compte approuvé.
            </p>
            <Button 
              onClick={handleLogout} 
              variant="outline" 
              className="w-full"
            >
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-8">
        <h1 className="text-6xl md:text-8xl font-black text-white">
          En cours
        </h1>
        <p className="text-xl text-white/60">
          Cette section est en construction
        </p>
        <Button 
          onClick={handleLogout} 
          variant="outline" 
          className="mt-8 border-white/30 text-white hover:bg-white/10"
        >
          Se déconnecter
        </Button>
      </div>
    </div>
  );
};

export default Dashboard;
