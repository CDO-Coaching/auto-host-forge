-- Table de demandes de questionnaire SFMS du coach vers l'athlète
CREATE TABLE IF NOT EXISTS public.sfms_questionnaire_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  athlete_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'cancelled'
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  result_id UUID, -- lien optionnel vers sfms_questionnaire_results.id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Une seule demande "pending" par couple (coach, athlete)
CREATE UNIQUE INDEX IF NOT EXISTS sfms_requests_one_pending_per_pair
  ON public.sfms_questionnaire_requests (coach_id, athlete_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS sfms_requests_athlete_status_idx
  ON public.sfms_questionnaire_requests (athlete_id, status);

CREATE INDEX IF NOT EXISTS sfms_requests_coach_status_idx
  ON public.sfms_questionnaire_requests (coach_id, status);

-- RLS
ALTER TABLE public.sfms_questionnaire_requests ENABLE ROW LEVEL SECURITY;

-- Coach: voir ses propres demandes
CREATE POLICY "Coaches can view own SFMS requests"
  ON public.sfms_questionnaire_requests
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

-- Coach: créer ses demandes
CREATE POLICY "Coaches can insert own SFMS requests"
  ON public.sfms_questionnaire_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

-- Coach: mettre à jour (annuler) ses demandes
CREATE POLICY "Coaches can update own SFMS requests"
  ON public.sfms_questionnaire_requests
  FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Coach: supprimer
CREATE POLICY "Coaches can delete own SFMS requests"
  ON public.sfms_questionnaire_requests
  FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());

-- Athlète: voir ses propres demandes
CREATE POLICY "Athletes can view own SFMS requests"
  ON public.sfms_questionnaire_requests
  FOR SELECT
  TO authenticated
  USING (athlete_id = auth.uid());

-- Athlète: marquer sa demande comme complétée
CREATE POLICY "Athletes can update own SFMS requests"
  ON public.sfms_questionnaire_requests
  FOR UPDATE
  TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_sfms_requests_updated_at ON public.sfms_questionnaire_requests;
CREATE TRIGGER update_sfms_requests_updated_at
BEFORE UPDATE ON public.sfms_questionnaire_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';