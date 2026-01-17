-- Migration pour ajouter les champs is_recurring et expires_at à athlete_subscriptions

-- Ajouter la colonne is_recurring
ALTER TABLE athlete_subscriptions 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;

-- Ajouter la colonne expires_at
ALTER TABLE athlete_subscriptions 
ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Mettre à jour les abonnements existants avec une date d'expiration par défaut (1 mois après paid_at)
UPDATE athlete_subscriptions 
SET expires_at = paid_at + interval '1 month'
WHERE expires_at IS NULL;
