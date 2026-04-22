import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function AthleteSfmsRequestBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("sfms_questionnaire_requests")
        .select("id")
        .eq("athlete_id", user.id)
        .eq("status", "pending")
        .limit(1);
      if (!active) return;
      if (!error && data && data.length > 0) {
        setHasPending(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  if (!user || !hasPending) return null;

  return (
    <Alert className="border-primary/50 bg-primary/10">
      <ClipboardList className="h-5 w-5" />
      <AlertTitle className="font-semibold">
        Ton coach te demande de remplir le questionnaire de surentraînement
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm">
          Cela ne prend que quelques minutes. Tes réponses aideront ton coach à adapter ton entraînement.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => navigate("/sportif/questionnaire-surentrainement")}
          >
            Remplir maintenant
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
