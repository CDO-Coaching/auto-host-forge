import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const token = searchParams.get('token');
        const type = searchParams.get('type');

        // Si on a un token, on confirme l'email avec verifyOtp
        if (token && type === 'signup') {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          });

          if (error) throw error;

          toast({ 
            title: "Email confirmé", 
            description: "Votre compte est en attente d'approbation par l'administrateur." 
          });
          navigate("/dashboard");
        } else {
          // Sinon, on vérifie la session normale
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
        }
      } catch (error: any) {
        toast({ 
          variant: "destructive", 
          title: "Erreur de confirmation", 
          description: error.message 
        });
        navigate("/auth?error=confirmation_failed");
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

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
