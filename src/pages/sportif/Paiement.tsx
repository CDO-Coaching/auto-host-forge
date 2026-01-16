import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Check, ExternalLink, Loader2, RefreshCw, Receipt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
  product_id: string;
  price_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export default function Paiement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignedSubscriptions, setAssignedSubscriptions] = useState<AssignedSubscription[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState<ActiveSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
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
        checkSubscriptionStatus(),
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
      console.error("Erreur chargement abonnements:", error);
    }
  };

  const checkSubscriptionStatus = async () => {
    setCheckingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      
      if (error) throw error;
      
      if (data?.subscriptions) {
        setActiveSubscriptions(data.subscriptions);
      }
    } catch (error) {
      console.error("Erreur vérification abonnement:", error);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleSubscribe = async (subscription: AssignedSubscription) => {
    setProcessingPayment(subscription.stripe_price_id);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: subscription.stripe_price_id,
          mode: subscription.is_recurring ? "subscription" : "payment",
        },
      });

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      console.error("Erreur création checkout:", error);
      toast.error(error.message || "Erreur lors de la création du paiement");
    } finally {
      setProcessingPayment(null);
    }
  };

  const handleManageSubscription = async () => {
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      console.error("Erreur ouverture portail:", error);
      toast.error(error.message || "Erreur lors de l'ouverture du portail");
    } finally {
      setOpeningPortal(false);
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

  const isSubscriptionActive = (priceId: string) => {
    return activeSubscriptions.some(sub => sub.price_id === priceId);
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
          onClick={checkSubscriptionStatus}
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
              Abonnement actif
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSubscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {assignedSubscriptions.find(a => a.stripe_price_id === sub.price_id)?.product_name || "Abonnement"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {sub.cancel_at_period_end
                      ? `Se termine le ${formatDate(sub.current_period_end)}`
                      : `Prochain renouvellement : ${formatDate(sub.current_period_end)}`}
                  </p>
                </div>
                <Badge variant="default" className="bg-green-500">
                  Actif
                </Badge>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={handleManageSubscription}
              disabled={openingPortal}
            >
              {openingPortal ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Receipt className="h-4 w-4 mr-2" />
              )}
              Gérer mon abonnement
            </Button>
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
            const isProcessing = processingPayment === subscription.stripe_price_id;

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
                    <Button
                      onClick={() => handleSubscribe(subscription)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
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
