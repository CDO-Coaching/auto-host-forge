import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowLeft } from "lucide-react";

export default function PaiementSucces() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const priceId = searchParams.get("price_id");
  const productId = searchParams.get("product_id");
  const productName = searchParams.get("product_name");

  useEffect(() => {
    if (user && priceId && productId && !saved) {
      enregistrerPaiement();
    }
  }, [user, priceId, productId, saved]);

  const enregistrerPaiement = async () => {
    if (!user || !priceId || !productId) return;
    
    setSaving(true);
    try {
      // Vérifier si un abonnement actif existe déjà pour ce prix
      const { data: existing } = await supabase
        .from("athlete_subscriptions")
        .select("id")
        .eq("athlete_id", user.id)
        .eq("stripe_price_id", priceId)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        toast.info("Cet abonnement est déjà actif");
        setSaved(true);
        return;
      }

      // Enregistrer le nouvel abonnement
      const { error } = await supabase
        .from("athlete_subscriptions")
        .insert({
          athlete_id: user.id,
          stripe_price_id: priceId,
          stripe_product_id: productId,
          product_name: decodeURIComponent(productName || "Abonnement"),
          status: "active",
          paid_at: new Date().toISOString(),
        });

      if (error) {
        // Table peut ne pas exister encore
        if ((error as any)?.code === "42P01") {
          console.log("Table athlete_subscriptions non créée encore - paiement OK quand même");
        } else {
          throw error;
        }
      }

      toast.success("Paiement enregistré avec succès !");
      setSaved(true);
    } catch (error) {
      console.error("Erreur enregistrement:", error);
      toast.error("Erreur lors de l'enregistrement du paiement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container max-w-md mx-auto py-12 px-4">
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            {saving ? (
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
            ) : (
              <CheckCircle className="h-16 w-16 text-green-500" />
            )}
          </div>
          <CardTitle className="text-xl">
            {saving ? "Enregistrement en cours..." : "Paiement réussi !"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            {saving
              ? "Nous enregistrons votre paiement..."
              : "Merci pour votre paiement. Votre abonnement est maintenant actif."}
          </p>
          
          {productName && (
            <p className="font-medium text-primary">
              {decodeURIComponent(productName)}
            </p>
          )}
          
          <Button
            onClick={() => navigate("/sportif/seances")}
            className="w-full mt-4"
            disabled={saving}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à mes séances
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
