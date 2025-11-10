import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let hasRedirected = false;

    const handleCallback = async () => {
      if (hasRedirected) return;

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

          // Marquer qu'on vient de confirmer l'email
          sessionStorage.setItem('just_confirmed_email', 'true');

          // Récupérer le profil pour rediriger selon le rôle
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("approved, role, first_name, last_name")
              .eq("id", session.user.id)
              .single();

            // Vérifier si le profil est complet
            if (!profile?.first_name || !profile?.last_name) {
              toast({ 
                title: "Email confirmé", 
                description: "Complète ton profil pour continuer." 
              });
              hasRedirected = true;
              navigate("/sportif/profil", { replace: true });
            } else if (!profile?.approved) {
              toast({ 
                title: "Email confirmé", 
                description: "Votre compte est en attente d'approbation par l'administrateur." 
              });
              hasRedirected = true;
              navigate("/en-attente", { replace: true });
            } else if (profile.role === "coach") {
              hasRedirected = true;
              navigate("/coach/programmation", { replace: true });
            } else {
              hasRedirected = true;
              navigate("/sportif/seances", { replace: true });
            }
          }
        } else {
          // Sinon, on vérifie la session normale
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) throw error;
          
          if (session) {
            // Marquer qu'on vient du callback
            sessionStorage.setItem('from_callback', 'true');

            // Récupérer le profil pour rediriger selon le rôle
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("approved, role, first_name, last_name")
              .eq("id", session.user.id)
              .single();

            // Vérifier si le profil est complet
            if (!profile?.first_name || !profile?.last_name) {
              toast({ 
                title: "Bienvenue", 
                description: "Complète ton profil pour continuer." 
              });
              hasRedirected = true;
              navigate("/sportif/profil", { replace: true });
            } else if (!profile?.approved) {
              toast({ 
                title: "Connexion réussie", 
                description: "Votre compte est en attente d'approbation par l'administrateur." 
              });
              hasRedirected = true;
              navigate("/en-attente", { replace: true });
            } else if (profile.role === "coach") {
              hasRedirected = true;
              navigate("/coach/programmation", { replace: true });
            } else {
              hasRedirected = true;
              navigate("/sportif/seances", { replace: true });
            }
          } else {
            hasRedirected = true;
            navigate("/auth", { replace: true });
          }
        }
      } catch (error: any) {
        toast({ 
          variant: "destructive", 
          title: "Erreur de confirmation", 
          description: error.message 
        });
        hasRedirected = true;
        navigate("/auth?error=confirmation_failed", { replace: true });
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
