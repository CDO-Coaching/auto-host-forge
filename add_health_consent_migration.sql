-- Migration pour ajouter le consentement RGPD données de santé
-- À exécuter manuellement dans l'éditeur SQL de Supabase

-- Ajouter la colonne pour stocker le consentement aux données de santé
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS health_data_consent BOOLEAN DEFAULT FALSE;

-- Ajouter la colonne pour stocker la date/heure du consentement (horodatage)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS health_data_consent_at TIMESTAMPTZ;

-- Ajouter des commentaires pour documenter les colonnes
COMMENT ON COLUMN user_profiles.health_data_consent IS 'Consentement explicite pour le traitement des données de santé (RGPD Article 9)';
COMMENT ON COLUMN user_profiles.health_data_consent_at IS 'Horodatage du consentement aux données de santé';
