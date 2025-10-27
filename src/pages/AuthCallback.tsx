import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
          toast({ 
            title: "Email confirmé", 
            description: "Votre compte est en attente d'approbation par l'administrateur." 
          });
          navigate("/dashboard");
        } else {
          navigate("/auth");
        }
      } catch (error: any) {
        toast({ 
          variant: "destructive", 
          title: "Erreur", 
          description: error.message 
        });
        navigate("/auth");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Vérification de votre email...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
