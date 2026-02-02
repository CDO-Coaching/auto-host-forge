import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowLeft, Calendar, Repeat } from "lucide-react";
import { STRIPE_PRODUCTS } from "@/lib/stripeConfig";

export default function PaiementSuccesStandalone() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const priceId = searchParams.get("price_id");
  const productId = searchParams.get("product_id");
  const productName = searchParams.get("product_name");

  // Récupérer les infos du produit depuis la config
  const productConfig = STRIPE_PRODUCTS.find(p => p.priceId === priceId);
  const isRecurring = productConfig?.isRecurring ?? false;

  // Attendre que la session soit restaurée (après retour Stripe)
  useEffect(() => {
    const checkSession = async () => {
      // Attendre un peu pour que la session soit restaurée
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        setWaitingForAuth(false);
      } else {
        // Si pas de session après 2 secondes, on attend encore un peu
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession?.user) {
            setUser(retrySession.user);
            setWaitingForAuth(false);
          } else {
            // Toujours pas de session, rediriger vers login
            toast.error("Session expirée, veuillez vous reconnecter");
            navigate("/auth", { replace: true });
          }
        }, 2000);
      }
    };

    checkSession();

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          setWaitingForAuth(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Enregistrer le paiement une fois l'utilisateur authentifié
  useEffect(() => {
    if (user && priceId && productId && !saved && !waitingForAuth) {
      enregistrerPaiement();
    }
  }, [user, priceId, productId, saved, waitingForAuth]);

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

      // Calculer la date d'expiration (1 mois)
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

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
          is_recurring: isRecurring,
          expires_at: expiresAt.toISOString(),
          coach_notified: false, // Pour que le coach soit notifié
        });

      if (error) {
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

  const decodedProductName = productName ? decodeURIComponent(productName) : "Abonnement";

  // Afficher un loader pendant l'attente de la session
  if (waitingForAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Vérification de votre session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-green-500/30 bg-green-500/5">
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
            <div className="p-4 rounded-lg bg-background border">
              <p className="font-semibold text-lg text-primary">
                {decodedProductName}
              </p>
              {isRecurring ? (
                <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Repeat className="h-4 w-4" />
                  <span>Abonnement mensuel renouvelé automatiquement</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Accès valable pendant 1 mois</span>
                </div>
              )}
            </div>
          )}

          <div className="bg-green-500/10 p-3 rounded-lg">
            <p className="text-sm">
              {isRecurring 
                ? "✓ Tu es maintenant abonné mensuellement ! Tu peux t'entraîner sans limite."
                : "✓ Tu as accès à un mois complet d'entraînement !"}
            </p>
          </div>
          
          <Button
            onClick={() => navigate("/sportif/paiement")}
            variant="outline"
            className="w-full"
            disabled={saving}
          >
            Voir mes paiements
          </Button>
          
          <Button
            onClick={() => navigate("/sportif/seances")}
            className="w-full"
            disabled={saving}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Aller à mes séances
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
