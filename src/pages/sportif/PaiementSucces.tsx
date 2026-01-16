import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";

export default function PaiementSucces() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // On pourrait vérifier la session Stripe ici si besoin
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      console.log("Paiement confirmé, session:", sessionId);
    }
  }, [searchParams]);

  return (
    <div className="container max-w-lg mx-auto py-12 px-4">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Paiement réussi !</h1>
          <p className="text-muted-foreground mb-6">
            Merci pour votre paiement. Votre abonnement est maintenant actif.
          </p>
          <Button onClick={() => navigate("/sportif/seances")}>
            Voir mes séances
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
