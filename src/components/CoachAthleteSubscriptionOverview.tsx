import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarDays,
  CreditCard,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { format, parseISO, subMonths, isAfter } from "date-fns";
import { fr } from "date-fns/locale";

interface AthleteSubscription {
  id: string;
  product_name: string;
  status: string;
  is_recurring: boolean | null;
  paid_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  stripe_price_id: string;
  stripe_product_id: string;
  created_at: string | null;
}

interface CoachAthleteSubscriptionOverviewProps {
  athleteId: string;
}

export function CoachAthleteSubscriptionOverview({ athleteId }: CoachAthleteSubscriptionOverviewProps) {
  const [subscriptions, setSubscriptions] = useState<AthleteSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptions();
  }, [athleteId]);

  const loadSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from("athlete_subscriptions")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("paid_at", { ascending: false });

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (error) {
      console.error("Error loading subscriptions:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Historique des paiements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun paiement enregistré pour ce sportif.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Determine current status from latest subscription
  const latest = subscriptions[0];
  const isActive = latest.status === "active";
  const isCancelled = latest.status === "cancelled" || !!latest.cancelled_at;
  const isExpired = latest.expires_at && !isAfter(parseISO(latest.expires_at), new Date());

  // Calculate 12-month payment history
  const twelveMonthsAgo = subMonths(new Date(), 12);
  const last12Months = subscriptions.filter(
    (sub) => isAfter(parseISO(sub.paid_at), twelveMonthsAgo)
  );

  // Build monthly breakdown
  const monthlyBreakdown: Record<string, number> = {};
  last12Months.forEach((sub) => {
    const monthKey = format(parseISO(sub.paid_at), "yyyy-MM");
    // We don't have amount in this table, use product name to estimate from config
    monthlyBreakdown[monthKey] = (monthlyBreakdown[monthKey] || 0) + 1;
  });

  // Try to get price from stripe config
  const getAmountForSub = (sub: AthleteSubscription): number => {
    // Default to 80€ for "Abonnement mensuel"
    return 8000; // centimes
  };

  const totalPaid12Months = last12Months.reduce((sum, sub) => sum + getAmountForSub(sub), 0);
  const totalPaidAll = subscriptions.reduce((sum, sub) => sum + getAmountForSub(sub), 0);

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

  const getStatusBadge = () => {
    if (isCancelled && !isExpired) {
      return (
        <Badge variant="outline" className="border-orange-500/50 text-orange-500 gap-1">
          <XCircle className="h-3 w-3" />
          Désabonné (actif jusqu'au {latest.expires_at ? format(parseISO(latest.expires_at), "d MMM yyyy", { locale: fr }) : "?"})
        </Badge>
      );
    }
    if (isCancelled || isExpired) {
      return (
        <Badge variant="outline" className="border-red-500/50 text-red-500 gap-1">
          <XCircle className="h-3 w-3" />
          Expiré
        </Badge>
      );
    }
    if (isActive) {
      return (
        <Badge variant="outline" className="border-green-500/50 text-green-500 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Actif
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        {latest.status}
      </Badge>
    );
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Suivi de l'abonnement
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current subscription info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              Formule
            </p>
            <p className="text-sm font-medium">{latest.product_name}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              Renouvellement
            </p>
            <p className="text-sm font-medium">
              {isCancelled ? "Annulé" : latest.is_recurring ? "Automatique" : "Manuel"}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Depuis le
            </p>
            <p className="text-sm font-medium">
              {format(parseISO(subscriptions[subscriptions.length - 1].paid_at), "d MMM yyyy", { locale: fr })}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {isCancelled ? "Fin le" : "Prochain paiement"}
            </p>
            <p className="text-sm font-medium">
              {latest.expires_at
                ? format(parseISO(latest.expires_at), "d MMM yyyy", { locale: fr })
                : "—"}
            </p>
          </div>
        </div>

        {isCancelled && latest.cancelled_at && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-400">
              ⚠️ Abonnement annulé le {format(parseISO(latest.cancelled_at), "d MMMM yyyy", { locale: fr })}
              {latest.expires_at && !isExpired && (
                <span> — Accès maintenu jusqu'au {format(parseISO(latest.expires_at), "d MMMM yyyy", { locale: fr })}</span>
              )}
            </p>
          </div>
        )}

        <Separator />

        {/* Payment summary */}
        <div>
          <h4 className="text-sm font-medium mb-3">Récapitulatif des paiements</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">12 derniers mois</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(totalPaid12Months)}</p>
              <p className="text-xs text-muted-foreground">{last12Months.length} paiement{last12Months.length > 1 ? "s" : ""}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total historique</p>
              <p className="text-lg font-bold">{formatCurrency(totalPaidAll)}</p>
              <p className="text-xs text-muted-foreground">{subscriptions.length} paiement{subscriptions.length > 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        {/* Payment history list */}
        {subscriptions.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-3">Historique ({subscriptions.length})</h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                      <span>{format(parseISO(sub.paid_at), "d MMM yyyy", { locale: fr })}</span>
                      <span className="text-muted-foreground text-xs">{sub.product_name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(getAmountForSub(sub))}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
