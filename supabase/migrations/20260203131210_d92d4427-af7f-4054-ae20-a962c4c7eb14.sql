-- Créer la table athlete_subscriptions avec la colonne cgv_accepted_at
CREATE TABLE IF NOT EXISTS public.athlete_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_price_id TEXT NOT NULL,
    stripe_product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    is_recurring BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    coach_notified BOOLEAN DEFAULT FALSE,
    cgv_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_athlete_subscriptions_athlete ON public.athlete_subscriptions(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_subscriptions_status ON public.athlete_subscriptions(status);

-- Activer RLS
ALTER TABLE public.athlete_subscriptions ENABLE ROW LEVEL SECURITY;

-- Politique pour les sportifs : peuvent voir leurs propres abonnements
CREATE POLICY "Athletes can view their own subscriptions"
ON public.athlete_subscriptions
FOR SELECT
USING (athlete_id = auth.uid());

-- Politique pour les sportifs : peuvent créer leurs propres abonnements
CREATE POLICY "Athletes can insert their own subscriptions"
ON public.athlete_subscriptions
FOR INSERT
WITH CHECK (athlete_id = auth.uid());

-- Politique pour les sportifs : peuvent mettre à jour leurs propres abonnements
CREATE POLICY "Athletes can update their own subscriptions"
ON public.athlete_subscriptions
FOR UPDATE
USING (athlete_id = auth.uid());

-- Commentaires
COMMENT ON TABLE public.athlete_subscriptions IS 'Paiements et abonnements actifs des sportifs';
COMMENT ON COLUMN public.athlete_subscriptions.status IS 'Statut: active, cancelled, expired';
COMMENT ON COLUMN public.athlete_subscriptions.paid_at IS 'Date du paiement';
COMMENT ON COLUMN public.athlete_subscriptions.cgv_accepted_at IS 'Horodatage de l''acceptation des Conditions Générales de Vente';