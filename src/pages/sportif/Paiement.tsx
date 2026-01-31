import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Check, ExternalLink, Loader2, RefreshCw, Calendar, Repeat } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getPaymentLinkWithParams, getProductByPriceId, STRIPE_PRODUCTS } from "@/lib/stripeConfig";

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
  is_recurring?: boolean;
  expires_at?: string;
}

export default function Paiement() {
  const { user } = useAuth();
  const [assignedSubscriptions, setAssignedSubscriptions] = useState<AssignedSubscription[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState<ActiveSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadAssignedSubscriptions(),
        loadActiveSubscriptions(),
      ]);
      toast.success("Données actualisées");
    } finally {
      setRefreshing(false);
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
    try {
      const { data, error } = await supabase
        .from("athlete_subscriptions")
        .select("*")
        .eq("athlete_id", user?.id)
        .eq("status", "active")
        .order("paid_at", { ascending: false });

      if (error) {
        if ((error as any)?.code === "42P01") {
          console.log("Table athlete_subscriptions non créée");
          return;
        }
        throw error;
      }
      
      setActiveSubscriptions(data || []);
    } catch (error) {
      console.error("Erreur vérification abonnement:", error);
    }
  };

  const handlePayment = async (subscription: AssignedSubscription) => {
    try {
      toast.info("Redirection vers le paiement...");
      
      // Chercher le Payment Link dans la config locale
      const productConfig = STRIPE_PRODUCTS.find(
        p => p.priceId === subscription.stripe_price_id || p.id === subscription.stripe_product_id
      );
      
      if (productConfig?.paymentLink) {
        // Utiliser le Payment Link avec l'email pré-rempli
        const paymentUrl = getPaymentLinkWithParams(productConfig.paymentLink, {
          prefillEmail: user?.email,
          clientReferenceId: user?.id,
        });
        window.location.href = paymentUrl;
      } else {
        // Fallback: essayer l'Edge Function si disponible
        const { data, error } = await supabase.functions.invoke("create-checkout", {
          body: {
            priceId: subscription.stripe_price_id,
            mode: subscription.is_recurring ? "subscription" : "payment",
          },
        });

        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
        } else {
          throw new Error("URL de paiement non reçue");
        }
      }
    } catch (error) {
      console.error("Erreur création checkout:", error);
      toast.error("Erreur lors de la création du paiement. Contactez votre coach.");
    }
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

  // Vérifier si un abonnement est actif
  const isSubscriptionActive = (priceId: string) => {
    return activeSubscriptions.some(sub => sub.stripe_price_id === priceId);
  };

  // Séparer les abonnements récurrents des paiements uniques
  const recurringSubscriptions = activeSubscriptions.filter(sub => {
    const productConfig = STRIPE_PRODUCTS.find(p => p.priceId === sub.stripe_price_id);
    return productConfig?.isRecurring || sub.is_recurring;
  });

  const oneTimePayments = activeSubscriptions.filter(sub => {
    const productConfig = STRIPE_PRODUCTS.find(p => p.priceId === sub.stripe_price_id);
    return !(productConfig?.isRecurring || sub.is_recurring);
  });

  const hasActiveSubscriptions = activeSubscriptions.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Afficher même si pas de formules assignées mais des abonnements actifs
  if (assignedSubscriptions.length === 0 && !hasActiveSubscriptions) {
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
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Abonnements mensuels récurrents actifs */}
      {recurringSubscriptions.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              Abonnement mensuel actif
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recurringSubscriptions.map((sub) => (
              <div key={sub.id} className="p-4 rounded-lg border bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{sub.product_name}</span>
                      <Badge variant="default" className="bg-primary">
                        Mensuel
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Souscrit le {formatDate(sub.paid_at)}</span>
                    </div>
                    {sub.expires_at && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span>Prochain renouvellement : {formatDate(sub.expires_at)}</span>
                      </div>
                    )}
                  </div>
                  <Badge className="bg-green-500">
                    <Check className="h-3 w-3 mr-1" />
                    Actif
                  </Badge>
                </div>
                <div className="mt-3 p-3 rounded-lg bg-green-500/10">
                  <p className="text-sm">
                    ✓ Tu es abonné mensuellement ! Tu peux t'entraîner sans limite.
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Paiements uniques validés */}
      {oneTimePayments.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Paiement validé
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {oneTimePayments.map((sub) => (
              <div key={sub.id} className="p-4 rounded-lg border bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{sub.product_name}</span>
                      <Badge variant="secondary">Paiement unique</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Payé le {formatDate(sub.paid_at)}</span>
                    </div>
                    {sub.expires_at && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Valable jusqu'au {formatDate(sub.expires_at)}
                      </div>
                    )}
                  </div>
                  <Badge className="bg-green-500">
                    <Check className="h-3 w-3 mr-1" />
                    Actif
                  </Badge>
                </div>
                <div className="mt-3 p-3 rounded-lg bg-green-500/10">
                  <p className="text-sm">
                    ✓ Tu as accès à un mois complet d'entraînement !
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Formules disponibles */}
      {assignedSubscriptions.length > 0 && (
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
                        Actif
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
      )}
    </div>
  );
}
