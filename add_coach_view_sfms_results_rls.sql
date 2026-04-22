-- Migration : permettre aux coachs de voir les résultats SFMS de leurs athlètes
-- À exécuter dans le SQL Editor Coolify

-- Drop si existe déjà (idempotent)
DROP POLICY IF EXISTS "Coaches can view their athletes SFMS results"
  ON public.sfms_questionnaire_results;

-- Créer la policy pour que le coach voie les résultats de ses athlètes
CREATE POLICY "Coaches can view their athletes SFMS results"
  ON public.sfms_questionnaire_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships r
      WHERE r.coach_id = auth.uid()
        AND r.athlete_id = sfms_questionnaire_results.athlete_id
        AND r.status IN ('approved', 'paused')
    )
  );

-- Recharger le cache PostgREST
NOTIFY pgrst, 'reload schema';
