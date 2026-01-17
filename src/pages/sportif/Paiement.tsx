import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Check, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getPaymentLinkWithParams, getProductByPriceId } from "@/lib/stripeConfig";

interface AssignedSubscription {
  id: string;
  stripe_price_id: string;
  stripe_product_id: string;
  product_name: string;
  price_amount: number;
  price_currency: string;
  is_recurring: boolean;
  recurring_interval: string | null;
}

interface ActiveSubscription {
  id: string;
  stripe_price_id: string;
  stripe_product_id: string;
  product_name: string;
  status: string;
  paid_at: string;
}

export default function Paiement() {
  const { user } = useAuth();
  const [assignedSubscriptions, setAssignedSubscriptions] = useState<AssignedSubscription[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState<ActiveSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingSubscription, setCheckingSubscription] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadAssignedSubscriptions(),
        loadActiveSubscriptions(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignedSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from("athlete_assigned_subscriptions")
        .select("*")
        .eq("athlete_id", user?.id)
        .eq("is_active", true);

      if (error) throw error;
      setAssignedSubscriptions(data || []);
    } catch (error) {
      console.error("Erreur chargement abonnements assignés:", error);
    }
  };

  const loadActiveSubscriptions = async () => {
    setCheckingSubscription(true);
    try {
      const { data, error } = await supabase
        .from("athlete_subscriptions")
        .select("*")
        .eq("athlete_id", user?.id)
        .eq("status", "active");

      if (error) {
        // Table peut ne pas exister
        if ((error as any)?.code === "42P01") {
          console.log("Table athlete_subscriptions non créée");
          return;
        }
        throw error;
      }
      
      setActiveSubscriptions(data || []);
    } catch (error) {
      console.error("Erreur vérification abonnement:", error);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handlePayment = (subscription: AssignedSubscription) => {
    const product = getProductByPriceId(subscription.stripe_price_id);
    
    if (!product?.paymentLink) {
      toast.error("Lien de paiement non configuré pour ce produit");
      return;
    }

    // Construire l'URL de succès avec les paramètres
    const successUrl = `${window.location.origin}/sportif/paiement-succes?price_id=${subscription.stripe_price_id}&product_id=${subscription.stripe_product_id}&product_name=${encodeURIComponent(subscription.product_name)}`;
    
    // Ajouter l'email pré-rempli si disponible
    const paymentUrl = getPaymentLinkWithParams(product.paymentLink, {
      prefillEmail: user?.email,
      clientReferenceId: user?.id,
    });

    // Ouvrir le Payment Link Stripe dans un nouvel onglet
    window.open(paymentUrl, "_blank");
    
    toast.info("Redirection vers Stripe...", {
      description: "Complétez votre paiement puis revenez ici."
    });
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const isSubscriptionActive = (priceId: string) => {
    return activeSubscriptions.some(sub => sub.stripe_price_id === priceId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (assignedSubscriptions.length === 0) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Aucune formule disponible</h2>
            <p className="text-muted-foreground text-center">
              Votre coach n'a pas encore configuré de formule de paiement pour vous.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            Mes paiements
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez vos abonnements et paiements
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={checkingSubscription}
        >
          {checkingSubscription ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Abonnements actifs */}
      {activeSubscriptions.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Abonnements actifs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSubscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{sub.product_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Payé le {formatDate(sub.paid_at)}
                  </p>
                </div>
                <Badge variant="default" className="bg-green-500">
                  Actif
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Formules disponibles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formules disponibles</CardTitle>
          <CardDescription>
            Choisissez la formule qui vous convient
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {assignedSubscriptions.map((subscription) => {
            const isActive = isSubscriptionActive(subscription.stripe_price_id);

            return (
              <div
                key={subscription.id}
                className={`p-4 rounded-lg border transition-colors ${
                  isActive
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{subscription.product_name}</span>
                      {subscription.is_recurring ? (
                        <Badge variant="outline" className="text-xs">
                          Mensuel
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Paiement unique
                        </Badge>
                      )}
                    </div>
                    <p className="text-lg font-bold text-primary mt-1">
                      {formatPrice(subscription.price_amount, subscription.price_currency)}
                      {subscription.is_recurring && (
                        <span className="text-sm font-normal text-muted-foreground">
                          /mois
                        </span>
                      )}
                    </p>
                  </div>
                  {isActive ? (
                    <Badge className="bg-green-500">
                      <Check className="h-3 w-3 mr-1" />
                      Payé
                    </Badge>
                  ) : (
                    <Button onClick={() => handlePayment(subscription)}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {subscription.is_recurring ? "S'abonner" : "Payer"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
