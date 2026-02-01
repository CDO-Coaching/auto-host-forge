-- Migration pour ajouter la colonne cancelled_at à athlete_subscriptions
-- Cette colonne indique quand un athlète s'est désabonné

-- Ajouter la colonne cancelled_at
ALTER TABLE athlete_subscriptions 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Ajouter la colonne cancelled_notified pour notifier le coach
ALTER TABLE athlete_subscriptions 
ADD COLUMN IF NOT EXISTS cancelled_notified BOOLEAN DEFAULT TRUE;

-- Pour les nouveaux abonnements, cancelled_notified sera NULL ou TRUE (pas de notification nécessaire)
-- Quand un athlète annule, on met cancelled_at = NOW() et cancelled_notified = FALSE
