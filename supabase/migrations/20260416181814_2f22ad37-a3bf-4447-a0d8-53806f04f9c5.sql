-- 1. CRITIQUE : empêcher les athlètes de créer/modifier/supprimer leurs propres abonnements.
-- Ces opérations doivent être faites côté serveur (edge functions / webhook Stripe avec service_role).
DROP POLICY IF EXISTS "Athletes can insert their own subscriptions" ON public.athlete_subscriptions;
DROP POLICY IF EXISTS "Athletes can update their own subscriptions" ON public.athlete_subscriptions;
DROP POLICY IF EXISTS "Athletes can delete their own subscriptions" ON public.athlete_subscriptions;

-- 2. Athlètes peuvent voir leur propre suivi de semaines de méthodologie
CREATE POLICY "Athletes can view own week tracking"
  ON public.athlete_methodology_weeks FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.athlete_methodology_assignments a
    WHERE a.id = athlete_methodology_weeks.assignment_id
      AND a.athlete_id = auth.uid()
  ));

-- 3. Athlètes peuvent voir leurs propres maxes de référence (1RM)
CREATE POLICY "Athletes can view own methodology maxes"
  ON public.athlete_methodology_maxes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.athlete_methodology_assignments a
    WHERE a.id = athlete_methodology_maxes.assignment_id
      AND a.athlete_id = auth.uid()
  ));

NOTIFY pgrst, 'reload schema';