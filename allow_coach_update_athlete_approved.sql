-- Migration pour permettre au coach de modifier le champ approved de ses athlètes
-- À exécuter dans Supabase via l'éditeur SQL

-- 1. Créer une fonction SECURITY DEFINER pour vérifier si l'utilisateur est le coach de l'athlète
CREATE OR REPLACE FUNCTION public.is_coach_of_athlete(_coach_id uuid, _athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_athlete_relationships
    WHERE coach_id = _coach_id
      AND athlete_id = _athlete_id
      AND status IN ('approved', 'paused')
  )
$$;

-- 2. Ajouter une politique RLS permettant au coach de modifier le profil de ses athlètes
-- Cette politique permet uniquement la mise à jour du champ approved
CREATE POLICY "Coaches can update approved field for their athletes"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  public.is_coach_of_athlete(auth.uid(), id)
)
WITH CHECK (
  public.is_coach_of_athlete(auth.uid(), id)
);

-- Note: Si une politique UPDATE existe déjà et bloque, vous pouvez la modifier
-- ou créer une politique plus permissive. Vérifiez les politiques existantes avec:
-- SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
