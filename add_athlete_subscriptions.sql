-- Migration pour ajouter la gestion des abonnements assignés aux sportifs
-- À exécuter manuellement dans l'éditeur SQL de Supabase

-- Table pour stocker les abonnements assignés par le coach à chaque sportif
CREATE TABLE IF NOT EXISTS athlete_assigned_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_price_id TEXT NOT NULL,
    stripe_product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    price_amount INTEGER NOT NULL, -- En centimes
    price_currency TEXT DEFAULT 'eur',
    is_recurring BOOLEAN DEFAULT TRUE,
    recurring_interval TEXT, -- 'month', 'year', etc. null si paiement unique
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(athlete_id, stripe_price_id)
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_athlete_assigned_subs_athlete ON athlete_assigned_subscriptions(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_assigned_subs_coach ON athlete_assigned_subscriptions(coach_id);

-- Activer RLS
ALTER TABLE athlete_assigned_subscriptions ENABLE ROW LEVEL SECURITY;

-- Politique pour les coachs : peuvent gérer les abonnements de leurs athlètes
CREATE POLICY "Coaches can manage their athletes subscriptions"
ON athlete_assigned_subscriptions
FOR ALL
USING (
    coach_id = auth.uid()
    OR athlete_id = auth.uid()
);

-- Politique pour les sportifs : peuvent voir leurs abonnements assignés
CREATE POLICY "Athletes can view their assigned subscriptions"
ON athlete_assigned_subscriptions
FOR SELECT
USING (athlete_id = auth.uid());

-- Commentaires
COMMENT ON TABLE athlete_assigned_subscriptions IS 'Abonnements Stripe assignés par le coach à chaque sportif';
COMMENT ON COLUMN athlete_assigned_subscriptions.stripe_price_id IS 'ID du prix Stripe (price_xxx)';
COMMENT ON COLUMN athlete_assigned_subscriptions.stripe_product_id IS 'ID du produit Stripe (prod_xxx)';
