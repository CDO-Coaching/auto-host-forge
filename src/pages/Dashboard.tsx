import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (!session) navigate("/auth"); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => { if (!session) navigate("/auth"); });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast({ variant: "destructive", title: "Erreur" });
    else { toast({ title: "Déconnexion réussie" }); navigate("/"); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>Chargement...</p></div>;

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 pt-32 pb-16 text-center">
        <h1 className="text-5xl font-bold mb-8">Espace <span className="text-primary">Coaché</span></h1>
        <div className="min-h-[400px] flex items-center justify-center border-2 border-dashed border-border rounded-lg mb-8">
          <p className="text-2xl text-muted-foreground">À remplir</p>
        </div>
        <Button onClick={handleLogout} variant="outline">Se déconnecter</Button>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
