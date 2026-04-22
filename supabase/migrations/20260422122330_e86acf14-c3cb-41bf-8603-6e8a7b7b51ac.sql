ALTER TABLE public.sfms_questionnaire_results
ADD COLUMN IF NOT EXISTS ai_feedback text;

NOTIFY pgrst, 'reload schema';