-- Correctif RLS pour athlete_assigned_subscriptions
-- À exécuter MANUELLEMENT dans l'éditeur SQL (après add_athlete_subscriptions.sql)

ALTER TABLE athlete_assigned_subscriptions ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies trop larges / incomplètes
DROP POLICY IF EXISTS "Coaches can manage their athletes subscriptions" ON athlete_assigned_subscriptions;
DROP POLICY IF EXISTS "Athletes can view their assigned subscriptions" ON athlete_assigned_subscriptions;

-- COACH: lire ses assignations
CREATE POLICY "coach_select_assigned_subs"
ON athlete_assigned_subscriptions
FOR SELECT
USING (coach_id = auth.uid());

-- COACH: créer une assignation (coach_id doit être lui-même)
CREATE POLICY "coach_insert_assigned_subs"
ON athlete_assigned_subscriptions
FOR INSERT
WITH CHECK (coach_id = auth.uid());

-- COACH: modifier/supprimer une assignation
CREATE POLICY "coach_update_assigned_subs"
ON athlete_assigned_subscriptions
FOR UPDATE
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

CREATE POLICY "coach_delete_assigned_subs"
ON athlete_assigned_subscriptions
FOR DELETE
USING (coach_id = auth.uid());

-- ATHLETE: voir uniquement ses assignations actives
CREATE POLICY "athlete_select_own_assigned_subs"
ON athlete_assigned_subscriptions
FOR SELECT
USING (athlete_id = auth.uid());
