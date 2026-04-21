CREATE TABLE public.sfms_questionnaire_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id UUID NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_score INTEGER NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score_fatigue_physique INTEGER NOT NULL DEFAULT 0,
  score_performance INTEGER NOT NULL DEFAULT 0,
  score_psychologique INTEGER NOT NULL DEFAULT 0,
  score_cognitif INTEGER NOT NULL DEFAULT 0,
  score_sommeil_appetit INTEGER NOT NULL DEFAULT 0,
  score_physiologique INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sfms_questionnaire_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view own SFMS results"
ON public.sfms_questionnaire_results
FOR SELECT TO authenticated
USING (athlete_id = auth.uid());

CREATE POLICY "Athletes can insert own SFMS results"
ON public.sfms_questionnaire_results
FOR INSERT TO authenticated
WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Athletes can delete own SFMS results"
ON public.sfms_questionnaire_results
FOR DELETE TO authenticated
USING (athlete_id = auth.uid());

CREATE INDEX idx_sfms_questionnaire_athlete ON public.sfms_questionnaire_results(athlete_id, completed_at DESC);

NOTIFY pgrst, 'reload schema';