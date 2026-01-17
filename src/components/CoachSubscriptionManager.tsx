import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Check, Loader2 } from "lucide-react";
import { STRIPE_PRODUCTS } from "@/lib/stripeConfig";

interface CoachSubscriptionManagerProps {
  athleteId: string;
  athleteName: string;
  paymentEnabled: boolean;
  onPaymentEnabledChange: (enabled: boolean) => void;
}

interface AssignedSubscription {
  id: string;
  stripe_price_id: string;
  stripe_product_id: string;
  product_name: string;
  price_amount: number;
  is_recurring: boolean;
  is_active: boolean;
}

export function CoachSubscriptionManager({
  athleteId,
  athleteName,
  paymentEnabled,
  onPaymentEnabledChange,
}: CoachSubscriptionManagerProps) {
  const [assignedSubscriptions, setAssignedSubscriptions] = useState<AssignedSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadAssignedSubscriptions();
  }, [athleteId]);

  const loadAssignedSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from("athlete_assigned_subscriptions")
        .select("*")
        .eq("athlete_id", athleteId);

      if (error) {
        const msg = String((error as any)?.message || "");
        if ((error as any)?.code === "42P01") {
          toast.error("Table abonnements manquante: exécutez la migration SQL.");
        } else if (msg.toLowerCase().includes("row-level security")) {
          toast.error("Accès bloqué par la sécurité: il faut corriger les policies RLS.");
        } else {
          toast.error("Erreur chargement abonnements");
        }
        throw error;
      }

      setAssignedSubscriptions(data || []);
    } catch (error) {
      console.error("Erreur chargement abonnements:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubscription = async (product: typeof STRIPE_PRODUCTS[0], isAssigned: boolean) => {
    setSaving(product.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      if (isAssigned) {
        const { error } = await supabase
          .from("athlete_assigned_subscriptions")
          .delete()
          .eq("athlete_id", athleteId)
          .eq("stripe_price_id", product.priceId);

        if (error) throw error;
        toast.success(`${product.name} retiré pour ${athleteName}`);
      } else {
        const { error } = await supabase
          .from("athlete_assigned_subscriptions")
          .insert({
            athlete_id: athleteId,
            coach_id: user.id,
            stripe_price_id: product.priceId,
            stripe_product_id: product.id,
            product_name: product.name,
            price_amount: product.amount,
            price_currency: product.currency,
            is_recurring: product.isRecurring,
            recurring_interval: product.interval,
            is_active: true,
          });

        if (error) throw error;
        toast.success(`${product.name} assigné à ${athleteName}`);
      }

      await loadAssignedSubscriptions();
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error(error.message || "Erreur lors de la modification");
    } finally {
      setSaving(null);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const isProductAssigned = (productId: string) => {
    return assignedSubscriptions.some(sub => sub.stripe_product_id === productId);
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Gestion des paiements
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {paymentEnabled ? "Paiement activé" : "Paiement désactivé"}
            </span>
            <Switch
              checked={paymentEnabled}
              onCheckedChange={onPaymentEnabledChange}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!paymentEnabled ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Activez le mode paiement pour assigner des abonnements à ce sportif.
          </p>
        ) : loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Sélectionnez les formules que ce sportif pourra voir et payer :
            </p>
            {STRIPE_PRODUCTS.map((product) => {
              const isAssigned = isProductAssigned(product.id);
              const isSaving = saving === product.id;

              return (
                <div
                  key={product.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isAssigned
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/50 bg-muted/20"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{product.name}</span>
                      {product.isRecurring ? (
                        <Badge variant="outline" className="text-xs">
                          Récurrent
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Unique
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(product.amount, product.currency)}
                      {product.isRecurring && "/mois"}
                    </p>
                  </div>
                  <Button
                    variant={isAssigned ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToggleSubscription(product, isAssigned)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isAssigned ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Assigné
                      </>
                    ) : (
                      "Assigner"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
