import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      if (!session) navigate("/auth"); 
      setLoading(false); 
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => { 
      if (!session) navigate("/auth"); 
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-xl">Chargement...</p>
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
