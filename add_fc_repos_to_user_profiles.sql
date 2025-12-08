-- Migration pour ajouter la FC de repos à la table user_profiles
-- À exécuter manuellement dans l'éditeur SQL de Supabase

-- Ajouter la colonne pour stocker la FC de repos
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS fc_repos INTEGER CHECK (fc_repos IS NULL OR (fc_repos >= 30 AND fc_repos <= 120));

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN user_profiles.fc_repos IS 'Fréquence cardiaque au repos du sportif (en bpm)';
