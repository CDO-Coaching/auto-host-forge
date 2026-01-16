-- Migration pour ajouter le mode paiement Stripe aux profils utilisateurs
-- À exécuter manuellement dans l'éditeur SQL de Supabase

-- Ajouter la colonne payment_enabled (false par défaut)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS payment_enabled BOOLEAN DEFAULT FALSE;

-- Commentaire pour documenter la colonne
COMMENT ON COLUMN user_profiles.payment_enabled IS 'Indique si le sportif peut voir et utiliser les fonctionnalités de paiement Stripe';
