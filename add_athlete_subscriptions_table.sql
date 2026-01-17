-- Migration pour créer la table athlete_subscriptions
-- Cette table stocke les paiements effectués par les sportifs
-- À exécuter dans l'éditeur SQL de Supabase

CREATE TABLE IF NOT EXISTS athlete_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_price_id TEXT NOT NULL,
    stripe_product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired'
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Pour les abonnements avec durée limitée
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_athlete_subscriptions_athlete ON athlete_subscriptions(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_subscriptions_status ON athlete_subscriptions(status);

-- Activer RLS
ALTER TABLE athlete_subscriptions ENABLE ROW LEVEL SECURITY;

-- Politique pour les sportifs : peuvent voir et créer leurs propres abonnements
CREATE POLICY "Athletes can view their own subscriptions"
ON athlete_subscriptions
FOR SELECT
USING (athlete_id = auth.uid());

CREATE POLICY "Athletes can insert their own subscriptions"
ON athlete_subscriptions
FOR INSERT
WITH CHECK (athlete_id = auth.uid());

-- Politique pour les coachs : peuvent voir les abonnements de leurs athlètes
CREATE POLICY "Coaches can view their athletes subscriptions"
ON athlete_subscriptions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM coach_athlete_relationships car
        WHERE car.athlete_id = athlete_subscriptions.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
);

-- Commentaires
COMMENT ON TABLE athlete_subscriptions IS 'Paiements et abonnements actifs des sportifs';
COMMENT ON COLUMN athlete_subscriptions.status IS 'Statut: active, cancelled, expired';
COMMENT ON COLUMN athlete_subscriptions.paid_at IS 'Date du paiement';
