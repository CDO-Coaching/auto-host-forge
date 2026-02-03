import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Check, ExternalLink, Loader2, RefreshCw, Calendar, Repeat, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getPaymentLinkWithParams, getProductByPriceId, STRIPE_PRODUCTS } from "@/lib/stripeConfig";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [subscriptionToCancel, setSubscriptionToCancel] = useState<ActiveSubscription | null>(null);

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
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // On n'affiche qu'une seule formule : la plus récente assignée par le coach.
      // (Certaines anciennes assignations peuvent rester actives en base si elles n'ont pas été désactivées.)
      setAssignedSubscriptions(data?.slice(0, 1) ?? []);
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
      
      // Chercher le Payment Link dans la config locale par priceId, productId, OU nom de produit
      let productConfig = STRIPE_PRODUCTS.find(
        p => p.priceId === subscription.stripe_price_id || p.id === subscription.stripe_product_id
      );
      
      // Fallback: matcher par nom de produit si les IDs ne correspondent pas
      if (!productConfig) {
        productConfig = STRIPE_PRODUCTS.find(
          p => p.name.toLowerCase() === subscription.product_name.toLowerCase()
        );
      }
      
      // Fallback ultime: si un seul produit configuré, l'utiliser
      if (!productConfig && STRIPE_PRODUCTS.length === 1) {
        productConfig = STRIPE_PRODUCTS[0];
      }
      
      console.log("Payment debug:", {
        subscriptionPriceId: subscription.stripe_price_id,
        subscriptionProductId: subscription.stripe_product_id,
        subscriptionProductName: subscription.product_name,
        foundConfig: productConfig,
        availableProducts: STRIPE_PRODUCTS,
      });
      
      if (productConfig?.paymentLink) {
        // Utiliser le Payment Link avec l'email pré-rempli
        const paymentUrl = getPaymentLinkWithParams(productConfig.paymentLink, {
          prefillEmail: user?.email,
          clientReferenceId: user?.id,
        });
        console.log("Redirecting to Payment Link:", paymentUrl);
        window.location.href = paymentUrl;
      } else {
        // Aucun Payment Link trouvé - afficher un message plus clair
        console.error("No matching product config found for:", {
          priceId: subscription.stripe_price_id,
          productId: subscription.stripe_product_id,
          productName: subscription.product_name,
        });
        toast.error("Configuration de paiement manquante. Veuillez contacter votre coach.");
      }
    } catch (error) {
      console.error("Erreur création checkout:", error);
      toast.error("Erreur lors de la création du paiement. Contactez votre coach.");
    }
  };

  const handleCancelClick = (subscription: ActiveSubscription) => {
    setSubscriptionToCancel(subscription);
    setShowCancelDialog(true);
  };

  const handleCancelConfirm = async () => {
    if (!subscriptionToCancel) return;
    
    setCancelling(subscriptionToCancel.id);
    try {
      // 1. Annuler l'abonnement Stripe (important!)
      const { data: cancelResult, error: cancelError } = await supabase.functions.invoke(
        "cancel-subscription"
      );

      if (cancelError) {
        console.error("Error cancelling Stripe subscription:", cancelError);
        // Continuer malgré l'erreur pour au moins mettre à jour la base locale
      } else {
        console.log("Stripe subscription cancellation result:", cancelResult);
      }

      // 2. Mettre à jour le statut dans notre base de données
      // Calculer expires_at basé sur le résultat Stripe ou +1 mois par défaut
      let expiresAt = subscriptionToCancel.expires_at;
      if (!expiresAt && cancelResult?.cancelledSubscriptions?.[0]?.current_period_end) {
        expiresAt = cancelResult.cancelledSubscriptions[0].current_period_end;
      } else if (!expiresAt) {
        // Fallback: +1 mois depuis le paiement
        const paidDate = new Date(subscriptionToCancel.paid_at);
        paidDate.setMonth(paidDate.getMonth() + 1);
        expiresAt = paidDate.toISOString();
      }

      const { error } = await supabase
        .from("athlete_subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_notified: false,
          expires_at: expiresAt,
        })
        .eq("id", subscriptionToCancel.id);

      if (error) throw error;

      toast.success("Désabonnement effectué. Ton coach sera notifié.");
      setShowCancelDialog(false);
      setSubscriptionToCancel(null);
      await loadActiveSubscriptions();
    } catch (error) {
      console.error("Erreur désabonnement:", error);
      toast.error("Erreur lors du désabonnement");
    } finally {
      setCancelling(null);
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
    <>
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 text-destructive hover:bg-destructive/10"
                    onClick={() => handleCancelClick(sub)}
                    disabled={cancelling === sub.id}
                  >
                    {cancelling === sub.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Se désabonner
                  </Button>
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

      {/* Dialog de confirmation de désabonnement */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le désabonnement</AlertDialogTitle>
            <AlertDialogDescription>
              Es-tu sûr(e) de vouloir te désabonner de "{subscriptionToCancel?.product_name}" ?
              <br /><br />
              Tu ne seras plus facturé(e) le mois prochain et ton coach sera notifié de ta décision.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Se désabonner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
