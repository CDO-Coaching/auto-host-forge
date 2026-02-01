-- Ajouter la colonne coach_notified à la table athlete_subscriptions
-- pour suivre si le coach a été notifié d'un paiement

ALTER TABLE athlete_subscriptions 
ADD COLUMN IF NOT EXISTS coach_notified BOOLEAN DEFAULT FALSE;

-- Mettre à jour les paiements existants comme déjà notifiés
UPDATE athlete_subscriptions SET coach_notified = TRUE WHERE coach_notified IS NULL;
