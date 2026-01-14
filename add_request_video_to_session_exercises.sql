-- Migration pour ajouter la demande de vidéo aux exercices de séance
-- À exécuter dans votre Supabase auto-hébergé via l'interface SQL Editor

-- Ajouter la colonne request_video à session_exercises
ALTER TABLE public.session_exercises
ADD COLUMN IF NOT EXISTS request_video boolean DEFAULT false;

-- Commentaire sur la colonne
COMMENT ON COLUMN public.session_exercises.request_video IS 'Indique si le coach demande une vidéo de l''athlète pour cet exercice';
