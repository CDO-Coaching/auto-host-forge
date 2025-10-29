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

          // Récupérer le profil pour rediriger selon le rôle
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("approved, role")
              .eq("id", session.user.id)
              .single();

            if (!profile?.approved) {
              toast({ 
                title: "Email confirmé", 
                description: "Votre compte est en attente d'approbation par l'administrateur." 
              });
              navigate("/en-attente");
            } else if (profile.role === "coach") {
              navigate("/coach/programmation");
            } else {
              navigate("/sportif/seances");
            }
          }
        } else {
          // Sinon, on vérifie la session normale
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) throw error;
          
          if (session) {
            // Récupérer le profil pour rediriger selon le rôle
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("approved, role")
              .eq("id", session.user.id)
              .single();

            if (!profile?.approved) {
              toast({ 
                title: "Connexion réussie", 
                description: "Votre compte est en attente d'approbation par l'administrateur." 
              });
              navigate("/en-attente");
            } else if (profile.role === "coach") {
              navigate("/coach/programmation");
            } else {
              navigate("/sportif/seances");
            }
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
