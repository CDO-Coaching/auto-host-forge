import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Check, ExternalLink, Loader2, RefreshCw, Settings, Calendar, XCircle } from "lucide-react";
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
}

// Abonnements Stripe actifs (récurrents)
interface StripeSubscription {
  id: string;
  product_id: string;
  price_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

// Paiements uniques Stripe
interface StripePayment {
  id: string;
  amount: number;
  currency: string;
  created: string;
  receipt_url: string | null;
}

export default function Paiement() {
  const { user } = useAuth();
  const [assignedSubscriptions, setAssignedSubscriptions] = useState<AssignedSubscription[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState<ActiveSubscription[]>([]);
  const [stripeSubscriptions, setStripeSubscriptions] = useState<StripeSubscription[]>([]);
  const [stripePayments, setStripePayments] = useState<StripePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

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
        checkStripeSubscription(),
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
    try {
      const { data, error } = await supabase
        .from("athlete_subscriptions")
        .select("*")
        .eq("athlete_id", user?.id)
        .eq("status", "active");

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

  const checkStripeSubscription = async () => {
    setCheckingSubscription(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      setStripeSubscriptions(data?.subscriptions || []);
      setStripePayments(data?.payments || []);
    } catch (error) {
      console.error("Erreur vérification Stripe:", error);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleManageSubscription = async () => {
    setOpeningPortal(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Vous devez être connecté");
        return;
      }

      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Erreur portail client:", error);
      toast.error("Impossible d'ouvrir le portail de gestion");
    } finally {
      setOpeningPortal(false);
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

  // Helper pour obtenir le nom du produit depuis Stripe
  const getProductName = (productId: string) => {
    const product = STRIPE_PRODUCTS.find(p => p.id === productId);
    return product?.name || "Abonnement";
  };

  const hasStripeActivity = stripeSubscriptions.length > 0 || stripePayments.length > 0;

  // Vérifier si un abonnement est actif (soit dans la DB locale, soit dans Stripe)
  const isSubscriptionActive = (priceId: string) => {
    return activeSubscriptions.some(sub => sub.stripe_price_id === priceId) ||
           stripeSubscriptions.some(sub => sub.price_id === priceId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Afficher quand même si on a des abonnements Stripe actifs
  if (assignedSubscriptions.length === 0 && !hasStripeActivity) {
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

      {/* Abonnements mensuels Stripe actifs */}
      {stripeSubscriptions.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Abonnement actif
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageSubscription}
                disabled={openingPortal}
              >
                {openingPortal ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Settings className="h-4 w-4 mr-2" />
                )}
                Gérer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stripeSubscriptions.map((sub) => (
              <div key={sub.id} className="p-4 rounded-lg border bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{getProductName(sub.product_id)}</span>
                      <Badge variant="default" className="bg-primary">
                        Mensuel
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Prochain renouvellement : {formatDate(sub.current_period_end)}</span>
                    </div>
                    {sub.cancel_at_period_end && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-orange-500">
                        <XCircle className="h-4 w-4" />
                        <span>Annulation programmée à la fin de la période</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {sub.cancel_at_period_end ? (
                      <Badge variant="outline" className="text-orange-500 border-orange-500">
                        Annulé
                      </Badge>
                    ) : (
                      <Badge className="bg-green-500">
                        Actif
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  ✓ Tu es abonné mensuellement et tu peux t'entraîner sans limite !
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Paiements uniques validés */}
      {stripePayments.length > 0 && stripeSubscriptions.length === 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Paiement validé
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stripePayments.slice(0, 3).map((payment) => (
              <div key={payment.id} className="p-4 rounded-lg border bg-background">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">
                      {formatPrice(payment.amount, payment.currency)}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">
                      Payé le {formatDate(payment.created)}
                    </p>
                  </div>
                  {payment.receipt_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(payment.receipt_url!, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  ✓ Tu as accès à un mois complet d'entraînement !
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Abonnements DB locaux (fallback) */}
      {activeSubscriptions.length > 0 && stripeSubscriptions.length === 0 && stripePayments.length === 0 && (
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
