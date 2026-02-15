-- Migration pour ajouter les champs cardio aux séances personnalisées
-- À exécuter manuellement dans l'éditeur SQL de Supabase (instance auto-hébergée)

ALTER TABLE public.custom_sessions
ADD COLUMN IF NOT EXISTS avg_pace text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS avg_heart_rate integer DEFAULT NULL;

COMMENT ON COLUMN public.custom_sessions.avg_pace IS 'Allure moyenne (format min:sec/km, ex: 5:30)';
COMMENT ON COLUMN public.custom_sessions.avg_heart_rate IS 'Fréquence cardiaque moyenne en bpm';
