-- Migration pour corriger les politiques RLS de training_sessions
-- À exécuter dans votre Supabase auto-hébergé via l'interface SQL Editor

-- ÉTAPE 1: Diagnostic - Vérifier si RLS est activé sur training_sessions
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'training_sessions';

-- ÉTAPE 2: Activer RLS si ce n'est pas déjà fait
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

-- ÉTAPE 3: Supprimer les anciennes politiques si elles existent (évite les conflits)
DROP POLICY IF EXISTS "Athletes can view their training sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Coaches can view their athletes training sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Athletes can update their session scheduling" ON public.training_sessions;
DROP POLICY IF EXISTS "Coaches can manage training sessions" ON public.training_sessions;

-- ÉTAPE 4: Créer la politique SELECT pour les athlètes
-- Les athlètes peuvent voir leurs propres séances (liées via training_weeks)
CREATE POLICY "Athletes can view their training sessions"
ON public.training_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.training_weeks tw
    WHERE tw.id = training_sessions.week_id
    AND tw.athlete_id = auth.uid()
  )
);

-- ÉTAPE 5: Créer la politique SELECT pour les coaches
-- Les coaches peuvent voir les séances de leurs athlètes
CREATE POLICY "Coaches can view their athletes training sessions"
ON public.training_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.training_weeks tw
    WHERE tw.id = training_sessions.week_id
    AND tw.coach_id = auth.uid()
  )
);

-- ÉTAPE 6: Recréer la politique UPDATE pour les athlètes
CREATE POLICY "Athletes can update their session scheduling"
ON public.training_sessions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.training_weeks tw
    WHERE tw.id = training_sessions.week_id
    AND tw.athlete_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.training_weeks tw
    WHERE tw.id = training_sessions.week_id
    AND tw.athlete_id = auth.uid()
  )
);

-- ÉTAPE 7: Politique pour les coaches (INSERT, UPDATE, DELETE)
CREATE POLICY "Coaches can manage training sessions"
ON public.training_sessions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.training_weeks tw
    WHERE tw.id = training_sessions.week_id
    AND tw.coach_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.training_weeks tw
    WHERE tw.id = training_sessions.week_id
    AND tw.coach_id = auth.uid()
  )
);

-- ÉTAPE 8: Vérifier aussi les politiques sur training_weeks
-- Les athlètes doivent pouvoir voir leurs semaines
DROP POLICY IF EXISTS "Athletes can view their training weeks" ON public.training_weeks;

CREATE POLICY "Athletes can view their training weeks"
ON public.training_weeks
FOR SELECT
TO authenticated
USING (athlete_id = auth.uid());

-- ÉTAPE 9: Diagnostic - Trouver les semaines mal liées pour un utilisateur spécifique
-- Remplacez 'EMAIL_UTILISATEUR' par l'email de l'utilisateur concerné
/*
SELECT 
  u.email,
  u.id as user_id,
  tw.id as week_id,
  tw.athlete_id,
  tw.week_number,
  tw.year,
  ts.id as session_id,
  ts.name as session_name,
  ts.completed_at
FROM auth.users u
LEFT JOIN public.training_weeks tw ON tw.athlete_id = u.id
LEFT JOIN public.training_sessions ts ON ts.week_id = tw.id
WHERE u.email = 'EMAIL_UTILISATEUR'
ORDER BY tw.year DESC, tw.week_number DESC;
*/

-- ÉTAPE 10: Diagnostic - Voir toutes les semaines sans athlete_id correct
/*
SELECT 
  tw.id,
  tw.coach_id,
  tw.athlete_id,
  tw.week_number,
  tw.year,
  up.email as athlete_email
FROM public.training_weeks tw
LEFT JOIN public.user_profiles up ON up.id = tw.athlete_id
WHERE tw.athlete_id IS NULL 
   OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = tw.athlete_id);
*/
