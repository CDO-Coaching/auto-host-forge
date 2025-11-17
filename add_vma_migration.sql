-- Migration pour ajouter le champ VMA aux profils utilisateurs
-- À exécuter manuellement dans l'éditeur SQL de Supabase

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS vma DECIMAL(4,1) CHECK (vma IS NULL OR (vma >= 8.0 AND vma <= 30.0));

COMMENT ON COLUMN user_profiles.vma IS 'Vitesse Maximale Aérobie (VMA) en km/h';
