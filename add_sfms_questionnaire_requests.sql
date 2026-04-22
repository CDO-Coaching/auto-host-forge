-- Migration : créer la table sfms_questionnaire_requests
-- À exécuter dans le SQL Editor Coolify

-- 1. Créer la table
CREATE TABLE IF NOT EXISTS public.sfms_questionnaire_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  athlete_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  result_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_sfms_requests_coach_athlete_status
  ON public.sfms_questionnaire_requests (coach_id, athlete_id, status);

CREATE INDEX IF NOT EXISTS idx_sfms_requests_athlete_status
  ON public.sfms_questionnaire_requests (athlete_id, status);

-- 3. Activer RLS
ALTER TABLE public.sfms_questionnaire_requests ENABLE ROW LEVEL SECURITY;

-- 4. Policies : coach
DROP POLICY IF EXISTS "Coaches can view own SFMS requests" ON public.sfms_questionnaire_requests;
CREATE POLICY "Coaches can view own SFMS requests"
  ON public.sfms_questionnaire_requests FOR SELECT TO authenticated
  USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches can insert own SFMS requests" ON public.sfms_questionnaire_requests;
CREATE POLICY "Coaches can insert own SFMS requests"
  ON public.sfms_questionnaire_requests FOR INSERT TO authenticated
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches can update own SFMS requests" ON public.sfms_questionnaire_requests;
CREATE POLICY "Coaches can update own SFMS requests"
  ON public.sfms_questionnaire_requests FOR UPDATE TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches can delete own SFMS requests" ON public.sfms_questionnaire_requests;
CREATE POLICY "Coaches can delete own SFMS requests"
  ON public.sfms_questionnaire_requests FOR DELETE TO authenticated
  USING (coach_id = auth.uid());

-- 5. Policies : athlete
DROP POLICY IF EXISTS "Athletes can view own SFMS requests" ON public.sfms_questionnaire_requests;
CREATE POLICY "Athletes can view own SFMS requests"
  ON public.sfms_questionnaire_requests FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

DROP POLICY IF EXISTS "Athletes can update own SFMS requests" ON public.sfms_questionnaire_requests;
CREATE POLICY "Athletes can update own SFMS requests"
  ON public.sfms_questionnaire_requests FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- 6. Trigger updated_at
DROP TRIGGER IF EXISTS trg_sfms_requests_updated_at ON public.sfms_questionnaire_requests;
CREATE TRIGGER trg_sfms_requests_updated_at
  BEFORE UPDATE ON public.sfms_questionnaire_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Recharger le cache PostgREST (CRUCIAL sur Coolify)
NOTIFY pgrst, 'reload schema';
