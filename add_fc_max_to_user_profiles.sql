-- Migration pour ajouter la FC Max à la table user_profiles
-- À exécuter manuellement dans l'éditeur SQL de Supabase

-- Ajouter la colonne pour stocker la FC Max
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS fc_max INTEGER CHECK (fc_max IS NULL OR (fc_max >= 100 AND fc_max <= 250));

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN user_profiles.fc_max IS 'Fréquence cardiaque maximale du sportif (en bpm)';
