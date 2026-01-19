import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmationState = "loading" | "success" | "error";

const EmailConfirmation = () => {
  const [state, setState] = useState<ConfirmationState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const token = searchParams.get('token');
        const type = searchParams.get('type');

        // Si c'est un lien de récupération de mot de passe, rediriger vers la page de reset
        if (type === 'recovery') {
          // Vérifier le token et laisser Supabase créer la session
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token || '',
            type: 'recovery'
          });

          if (error) {
            setErrorMessage(error.message);
            setState("error");
            return;
          }

          // Rediriger vers la page de réinitialisation de mot de passe
          navigate("/reinitialiser-mot-de-passe", { replace: true });
          return;
        }

        if (!token || type !== 'signup') {
          setErrorMessage("Lien de confirmation invalide.");
          setState("error");
          return;
        }

        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'signup'
        });

        if (error) {
          setErrorMessage(error.message);
          setState("error");
          return;
        }

        // Email confirmé avec succès
        setState("success");
      } catch (err: any) {
        setErrorMessage(err.message || "Une erreur est survenue.");
        setState("error");
      }
    };

    confirmEmail();
  }, [searchParams, navigate]);

  const handleGoToLogin = () => {
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {state === "loading" && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">
              Vérification en cours...
            </h1>
            <p className="text-muted-foreground">
              Nous confirmons votre adresse email.
            </p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">
              Email confirmé !
            </h1>
            <p className="text-muted-foreground">
              Ton adresse email a été vérifiée avec succès.
            </p>
            <p className="text-muted-foreground mt-2">
              Attends que Corentin valide ton profil pour y avoir accès. 🏋️
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">
              Erreur de confirmation
            </h1>
            <p className="text-muted-foreground">
              {errorMessage}
            </p>
            <Button onClick={handleGoToLogin} variant="outline" className="mt-4">
              Retour à la connexion
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailConfirmation;
