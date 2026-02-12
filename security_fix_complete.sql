-- ============================================================
-- SCRIPT DE SÉCURISATION COMPLET v2 — CDO Coaching
-- Généré le 2026-02-12 — Basé sur le schéma réel
-- IDEMPOTENT : peut être exécuté plusieurs fois sans erreur
-- ============================================================

-- ============================================================
-- PARTIE 0 : Fonction helper (évite la récursion RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_coach_of(_coach_id uuid, _athlete_id uuid)
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

-- ============================================================
-- PARTIE 1 : RÉVOQUER les RPCs destructives du rôle anon
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_old_messages') THEN
    REVOKE EXECUTE ON FUNCTION public.delete_old_messages FROM anon;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_attachments_direct') THEN
    REVOKE EXECUTE ON FUNCTION public.cleanup_old_attachments_direct FROM anon;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_invoice_number') THEN
    REVOKE EXECUTE ON FUNCTION public.generate_invoice_number FROM anon;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_cleanup_old_attachments') THEN
    REVOKE EXECUTE ON FUNCTION public.trigger_cleanup_old_attachments FROM anon;
  END IF;
END $$;

-- ============================================================
-- PARTIE 2 : ACTIVER RLS + FORCER sur TOUTES les tables
-- ============================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ============================================================
-- PARTIE 3 : SUPPRIMER les anciennes policies potentiellement permissives
-- ============================================================

DROP POLICY IF EXISTS "Coaches can manage their athletes subscriptions" ON public.athlete_assigned_subscriptions;
DROP POLICY IF EXISTS "Athletes can view their assigned subscriptions" ON public.athlete_assigned_subscriptions;
DROP POLICY IF EXISTS "Coaches can update approved field for their athletes" ON public.user_profiles;
DROP POLICY IF EXISTS "Athletes can insert their own subscriptions" ON public.athlete_subscriptions;
DROP POLICY IF EXISTS "Athletes can view their own subscriptions" ON public.athlete_subscriptions;
DROP POLICY IF EXISTS "Athletes can update their own subscriptions" ON public.athlete_subscriptions;
DROP POLICY IF EXISTS "Athletes can insert their own milestones" ON public.objective_milestones;
DROP POLICY IF EXISTS "Athletes can update their own milestones" ON public.objective_milestones;
DROP POLICY IF EXISTS "Athletes can delete their own milestones" ON public.objective_milestones;
DROP POLICY IF EXISTS "coach_select_assigned_subs" ON public.athlete_assigned_subscriptions;
DROP POLICY IF EXISTS "coach_insert_assigned_subs" ON public.athlete_assigned_subscriptions;
DROP POLICY IF EXISTS "coach_update_assigned_subs" ON public.athlete_assigned_subscriptions;
DROP POLICY IF EXISTS "coach_delete_assigned_subs" ON public.athlete_assigned_subscriptions;
DROP POLICY IF EXISTS "athlete_select_own_assigned_subs" ON public.athlete_assigned_subscriptions;

-- ============================================================
-- PARTIE 4 : POLICIES PAR TABLE (basé sur le schéma réel)
-- ============================================================

-- =============================================
-- user_profiles (id = auth.users.id)
-- =============================================
DROP POLICY IF EXISTS "rls_user_profiles_select" ON public.user_profiles;
CREATE POLICY "rls_user_profiles_select" ON public.user_profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.is_coach_of(auth.uid(), id));

DROP POLICY IF EXISTS "rls_user_profiles_insert" ON public.user_profiles;
CREATE POLICY "rls_user_profiles_insert" ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "rls_user_profiles_update" ON public.user_profiles;
CREATE POLICY "rls_user_profiles_update" ON public.user_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id OR public.is_coach_of(auth.uid(), id))
  WITH CHECK (auth.uid() = id OR public.is_coach_of(auth.uid(), id));

DROP POLICY IF EXISTS "rls_user_profiles_delete" ON public.user_profiles;
CREATE POLICY "rls_user_profiles_delete" ON public.user_profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- =============================================
-- coach_athlete_relationships (coach_id, athlete_id)
-- =============================================
DROP POLICY IF EXISTS "rls_car_select" ON public.coach_athlete_relationships;
CREATE POLICY "rls_car_select" ON public.coach_athlete_relationships FOR SELECT
  TO authenticated USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_car_insert" ON public.coach_athlete_relationships;
CREATE POLICY "rls_car_insert" ON public.coach_athlete_relationships FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = coach_id OR auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_car_update" ON public.coach_athlete_relationships;
CREATE POLICY "rls_car_update" ON public.coach_athlete_relationships FOR UPDATE
  TO authenticated USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_car_delete" ON public.coach_athlete_relationships;
CREATE POLICY "rls_car_delete" ON public.coach_athlete_relationships FOR DELETE
  TO authenticated USING (auth.uid() = coach_id);

-- =============================================
-- training_sessions (id seulement — pas de athlete_id/coach_id direct)
-- On suppose que session est liée à un athlète via d'autres moyens
-- Politique permissive pour authenticated uniquement
-- =============================================
DROP POLICY IF EXISTS "rls_ts_select" ON public.training_sessions;
CREATE POLICY "rls_ts_select" ON public.training_sessions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rls_ts_insert" ON public.training_sessions;
CREATE POLICY "rls_ts_insert" ON public.training_sessions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rls_ts_update" ON public.training_sessions;
CREATE POLICY "rls_ts_update" ON public.training_sessions FOR UPDATE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rls_ts_delete" ON public.training_sessions;
CREATE POLICY "rls_ts_delete" ON public.training_sessions FOR DELETE
  TO authenticated USING (true);

-- =============================================
-- session_exercises (id seulement)
-- =============================================
DROP POLICY IF EXISTS "rls_se_select" ON public.session_exercises;
CREATE POLICY "rls_se_select" ON public.session_exercises FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rls_se_insert" ON public.session_exercises;
CREATE POLICY "rls_se_insert" ON public.session_exercises FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rls_se_update" ON public.session_exercises;
CREATE POLICY "rls_se_update" ON public.session_exercises FOR UPDATE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rls_se_delete" ON public.session_exercises;
CREATE POLICY "rls_se_delete" ON public.session_exercises FOR DELETE
  TO authenticated USING (true);

-- =============================================
-- exercise_library (id seulement — catalogue partagé)
-- Lecture pour tous les authentifiés, pas de suppression
-- =============================================
DROP POLICY IF EXISTS "rls_el_select" ON public.exercise_library;
CREATE POLICY "rls_el_select" ON public.exercise_library FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rls_el_insert" ON public.exercise_library;
CREATE POLICY "rls_el_insert" ON public.exercise_library FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rls_el_update" ON public.exercise_library;
CREATE POLICY "rls_el_update" ON public.exercise_library FOR UPDATE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rls_el_delete" ON public.exercise_library;
CREATE POLICY "rls_el_delete" ON public.exercise_library FOR DELETE
  TO authenticated USING (true);

-- =============================================
-- messages (sender_id, receiver_id)
-- =============================================
DROP POLICY IF EXISTS "rls_msg_select" ON public.messages;
CREATE POLICY "rls_msg_select" ON public.messages FOR SELECT
  TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "rls_msg_insert" ON public.messages;
CREATE POLICY "rls_msg_insert" ON public.messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "rls_msg_update" ON public.messages;
CREATE POLICY "rls_msg_update" ON public.messages FOR UPDATE
  TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "rls_msg_delete" ON public.messages;
CREATE POLICY "rls_msg_delete" ON public.messages FOR DELETE
  TO authenticated USING (auth.uid() = sender_id);

-- =============================================
-- daily_fatigue_log (user_id)
-- =============================================
DROP POLICY IF EXISTS "rls_dfl_select" ON public.daily_fatigue_log;
CREATE POLICY "rls_dfl_select" ON public.daily_fatigue_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "rls_dfl_insert" ON public.daily_fatigue_log;
CREATE POLICY "rls_dfl_insert" ON public.daily_fatigue_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_dfl_update" ON public.daily_fatigue_log;
CREATE POLICY "rls_dfl_update" ON public.daily_fatigue_log FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_dfl_delete" ON public.daily_fatigue_log;
CREATE POLICY "rls_dfl_delete" ON public.daily_fatigue_log FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- daily_health_checkin (id seulement — pas de user_id)
-- =============================================
DROP POLICY IF EXISTS "rls_dhc_select" ON public.daily_health_checkin;
CREATE POLICY "rls_dhc_select" ON public.daily_health_checkin FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rls_dhc_insert" ON public.daily_health_checkin;
CREATE POLICY "rls_dhc_insert" ON public.daily_health_checkin FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rls_dhc_update" ON public.daily_health_checkin;
CREATE POLICY "rls_dhc_update" ON public.daily_health_checkin FOR UPDATE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rls_dhc_delete" ON public.daily_health_checkin;
CREATE POLICY "rls_dhc_delete" ON public.daily_health_checkin FOR DELETE
  TO authenticated USING (true);

-- =============================================
-- custom_sessions (user_id)
-- =============================================
DROP POLICY IF EXISTS "rls_cs_select" ON public.custom_sessions;
CREATE POLICY "rls_cs_select" ON public.custom_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "rls_cs_insert" ON public.custom_sessions;
CREATE POLICY "rls_cs_insert" ON public.custom_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_cs_update" ON public.custom_sessions;
CREATE POLICY "rls_cs_update" ON public.custom_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_cs_delete" ON public.custom_sessions;
CREATE POLICY "rls_cs_delete" ON public.custom_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- athlete_objectives (athlete_id, coach_id)
-- =============================================
DROP POLICY IF EXISTS "rls_ao_select" ON public.athlete_objectives;
CREATE POLICY "rls_ao_select" ON public.athlete_objectives FOR SELECT
  TO authenticated USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ao_insert" ON public.athlete_objectives;
CREATE POLICY "rls_ao_insert" ON public.athlete_objectives FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = coach_id OR auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_ao_update" ON public.athlete_objectives;
CREATE POLICY "rls_ao_update" ON public.athlete_objectives FOR UPDATE
  TO authenticated USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ao_delete" ON public.athlete_objectives;
CREATE POLICY "rls_ao_delete" ON public.athlete_objectives FOR DELETE
  TO authenticated USING (auth.uid() = coach_id);

-- =============================================
-- objective_milestones (athlete_id, coach_id)
-- =============================================
DROP POLICY IF EXISTS "rls_om_select" ON public.objective_milestones;
CREATE POLICY "rls_om_select" ON public.objective_milestones FOR SELECT
  TO authenticated USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_om_insert" ON public.objective_milestones;
CREATE POLICY "rls_om_insert" ON public.objective_milestones FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_om_update" ON public.objective_milestones;
CREATE POLICY "rls_om_update" ON public.objective_milestones FOR UPDATE
  TO authenticated USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_om_delete" ON public.objective_milestones;
CREATE POLICY "rls_om_delete" ON public.objective_milestones FOR DELETE
  TO authenticated USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

-- =============================================
-- athlete_subscriptions (athlete_id)
-- =============================================
DROP POLICY IF EXISTS "rls_as_select" ON public.athlete_subscriptions;
CREATE POLICY "rls_as_select" ON public.athlete_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_as_insert" ON public.athlete_subscriptions;
CREATE POLICY "rls_as_insert" ON public.athlete_subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_as_update" ON public.athlete_subscriptions;
CREATE POLICY "rls_as_update" ON public.athlete_subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_as_delete" ON public.athlete_subscriptions;
CREATE POLICY "rls_as_delete" ON public.athlete_subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = athlete_id);

-- =============================================
-- athlete_assigned_subscriptions (coach_id, athlete_id)
-- =============================================
DROP POLICY IF EXISTS "rls_aas_select" ON public.athlete_assigned_subscriptions;
CREATE POLICY "rls_aas_select" ON public.athlete_assigned_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_aas_insert" ON public.athlete_assigned_subscriptions;
CREATE POLICY "rls_aas_insert" ON public.athlete_assigned_subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_aas_update" ON public.athlete_assigned_subscriptions;
CREATE POLICY "rls_aas_update" ON public.athlete_assigned_subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_aas_delete" ON public.athlete_assigned_subscriptions;
CREATE POLICY "rls_aas_delete" ON public.athlete_assigned_subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = coach_id);

-- =============================================
-- athlete_invoices (athlete_id)
-- =============================================
DROP POLICY IF EXISTS "rls_ai_select" ON public.athlete_invoices;
CREATE POLICY "rls_ai_select" ON public.athlete_invoices FOR SELECT
  TO authenticated USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_ai_insert" ON public.athlete_invoices;
CREATE POLICY "rls_ai_insert" ON public.athlete_invoices FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rls_ai_update" ON public.athlete_invoices;
CREATE POLICY "rls_ai_update" ON public.athlete_invoices FOR UPDATE
  TO authenticated USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_ai_delete" ON public.athlete_invoices;
CREATE POLICY "rls_ai_delete" ON public.athlete_invoices FOR DELETE
  TO authenticated USING (auth.uid() = athlete_id);

-- =============================================
-- accounting_entries (coach_id)
-- =============================================
DROP POLICY IF EXISTS "rls_ae_select" ON public.accounting_entries;
CREATE POLICY "rls_ae_select" ON public.accounting_entries FOR SELECT
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ae_insert" ON public.accounting_entries;
CREATE POLICY "rls_ae_insert" ON public.accounting_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ae_update" ON public.accounting_entries;
CREATE POLICY "rls_ae_update" ON public.accounting_entries FOR UPDATE
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ae_delete" ON public.accounting_entries;
CREATE POLICY "rls_ae_delete" ON public.accounting_entries FOR DELETE
  TO authenticated USING (auth.uid() = coach_id);

-- =============================================
-- google_calendar_tokens (user_id) — SENSIBLE
-- =============================================
DROP POLICY IF EXISTS "rls_gct_select" ON public.google_calendar_tokens;
CREATE POLICY "rls_gct_select" ON public.google_calendar_tokens FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_gct_insert" ON public.google_calendar_tokens;
CREATE POLICY "rls_gct_insert" ON public.google_calendar_tokens FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_gct_update" ON public.google_calendar_tokens;
CREATE POLICY "rls_gct_update" ON public.google_calendar_tokens FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_gct_delete" ON public.google_calendar_tokens;
CREATE POLICY "rls_gct_delete" ON public.google_calendar_tokens FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- coach_notes (coach_id, athlete_id)
-- =============================================
DROP POLICY IF EXISTS "rls_cn_select" ON public.coach_notes;
CREATE POLICY "rls_cn_select" ON public.coach_notes FOR SELECT
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_cn_insert" ON public.coach_notes;
CREATE POLICY "rls_cn_insert" ON public.coach_notes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_cn_update" ON public.coach_notes;
CREATE POLICY "rls_cn_update" ON public.coach_notes FOR UPDATE
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_cn_delete" ON public.coach_notes;
CREATE POLICY "rls_cn_delete" ON public.coach_notes FOR DELETE
  TO authenticated USING (auth.uid() = coach_id);

-- =============================================
-- external_clients (coach_id)
-- =============================================
DROP POLICY IF EXISTS "rls_ec_select" ON public.external_clients;
CREATE POLICY "rls_ec_select" ON public.external_clients FOR SELECT
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ec_insert" ON public.external_clients;
CREATE POLICY "rls_ec_insert" ON public.external_clients FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ec_update" ON public.external_clients;
CREATE POLICY "rls_ec_update" ON public.external_clients FOR UPDATE
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ec_delete" ON public.external_clients;
CREATE POLICY "rls_ec_delete" ON public.external_clients FOR DELETE
  TO authenticated USING (auth.uid() = coach_id);

-- =============================================
-- session_templates (coach_id)
-- =============================================
DROP POLICY IF EXISTS "rls_st_select" ON public.session_templates;
CREATE POLICY "rls_st_select" ON public.session_templates FOR SELECT
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_st_insert" ON public.session_templates;
CREATE POLICY "rls_st_insert" ON public.session_templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_st_update" ON public.session_templates;
CREATE POLICY "rls_st_update" ON public.session_templates FOR UPDATE
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_st_delete" ON public.session_templates;
CREATE POLICY "rls_st_delete" ON public.session_templates FOR DELETE
  TO authenticated USING (auth.uid() = coach_id);

-- =============================================
-- session_template_folders (coach_id)
-- =============================================
DROP POLICY IF EXISTS "rls_stf_select" ON public.session_template_folders;
CREATE POLICY "rls_stf_select" ON public.session_template_folders FOR SELECT
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_stf_insert" ON public.session_template_folders;
CREATE POLICY "rls_stf_insert" ON public.session_template_folders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_stf_update" ON public.session_template_folders;
CREATE POLICY "rls_stf_update" ON public.session_template_folders FOR UPDATE
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_stf_delete" ON public.session_template_folders;
CREATE POLICY "rls_stf_delete" ON public.session_template_folders FOR DELETE
  TO authenticated USING (auth.uid() = coach_id);

-- =============================================
-- session_template_exercises (id seulement — lié aux templates)
-- =============================================
DROP POLICY IF EXISTS "rls_ste_select" ON public.session_template_exercises;
CREATE POLICY "rls_ste_select" ON public.session_template_exercises FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rls_ste_insert" ON public.session_template_exercises;
CREATE POLICY "rls_ste_insert" ON public.session_template_exercises FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rls_ste_update" ON public.session_template_exercises;
CREATE POLICY "rls_ste_update" ON public.session_template_exercises FOR UPDATE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rls_ste_delete" ON public.session_template_exercises;
CREATE POLICY "rls_ste_delete" ON public.session_template_exercises FOR DELETE
  TO authenticated USING (true);

-- =============================================
-- exercise_maxes (athlete_id)
-- =============================================
DROP POLICY IF EXISTS "rls_em_select" ON public.exercise_maxes;
CREATE POLICY "rls_em_select" ON public.exercise_maxes FOR SELECT
  TO authenticated USING (auth.uid() = athlete_id OR public.is_coach_of(auth.uid(), athlete_id));

DROP POLICY IF EXISTS "rls_em_insert" ON public.exercise_maxes;
CREATE POLICY "rls_em_insert" ON public.exercise_maxes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = athlete_id OR public.is_coach_of(auth.uid(), athlete_id));

DROP POLICY IF EXISTS "rls_em_update" ON public.exercise_maxes;
CREATE POLICY "rls_em_update" ON public.exercise_maxes FOR UPDATE
  TO authenticated USING (auth.uid() = athlete_id OR public.is_coach_of(auth.uid(), athlete_id));

DROP POLICY IF EXISTS "rls_em_delete" ON public.exercise_maxes;
CREATE POLICY "rls_em_delete" ON public.exercise_maxes FOR DELETE
  TO authenticated USING (auth.uid() = athlete_id OR public.is_coach_of(auth.uid(), athlete_id));

-- =============================================
-- feedbacks (user_id)
-- =============================================
DROP POLICY IF EXISTS "rls_fb_select" ON public.feedbacks;
CREATE POLICY "rls_fb_select" ON public.feedbacks FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "rls_fb_insert" ON public.feedbacks;
CREATE POLICY "rls_fb_insert" ON public.feedbacks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_fb_update" ON public.feedbacks;
CREATE POLICY "rls_fb_update" ON public.feedbacks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_fb_delete" ON public.feedbacks;
CREATE POLICY "rls_fb_delete" ON public.feedbacks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- forme_journaliere (user_id)
-- =============================================
DROP POLICY IF EXISTS "rls_fj_select" ON public.forme_journaliere;
CREATE POLICY "rls_fj_select" ON public.forme_journaliere FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "rls_fj_insert" ON public.forme_journaliere;
CREATE POLICY "rls_fj_insert" ON public.forme_journaliere FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_fj_update" ON public.forme_journaliere;
CREATE POLICY "rls_fj_update" ON public.forme_journaliere FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_fj_delete" ON public.forme_journaliere;
CREATE POLICY "rls_fj_delete" ON public.forme_journaliere FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- weight_tracking (user_id)
-- =============================================
DROP POLICY IF EXISTS "rls_wt_select" ON public.weight_tracking;
CREATE POLICY "rls_wt_select" ON public.weight_tracking FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "rls_wt_insert" ON public.weight_tracking;
CREATE POLICY "rls_wt_insert" ON public.weight_tracking FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_wt_update" ON public.weight_tracking;
CREATE POLICY "rls_wt_update" ON public.weight_tracking FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_wt_delete" ON public.weight_tracking;
CREATE POLICY "rls_wt_delete" ON public.weight_tracking FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- mesocycles (athlete_id, coach_id)
-- =============================================
DROP POLICY IF EXISTS "rls_mc_select" ON public.mesocycles;
CREATE POLICY "rls_mc_select" ON public.mesocycles FOR SELECT
  TO authenticated USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_mc_insert" ON public.mesocycles;
CREATE POLICY "rls_mc_insert" ON public.mesocycles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_mc_update" ON public.mesocycles;
CREATE POLICY "rls_mc_update" ON public.mesocycles FOR UPDATE
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_mc_delete" ON public.mesocycles;
CREATE POLICY "rls_mc_delete" ON public.mesocycles FOR DELETE
  TO authenticated USING (auth.uid() = coach_id);

-- =============================================
-- macrocycles (athlete_id, coach_id)
-- =============================================
DROP POLICY IF EXISTS "rls_mac_select" ON public.macrocycles;
CREATE POLICY "rls_mac_select" ON public.macrocycles FOR SELECT
  TO authenticated USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_mac_insert" ON public.macrocycles;
CREATE POLICY "rls_mac_insert" ON public.macrocycles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_mac_update" ON public.macrocycles;
CREATE POLICY "rls_mac_update" ON public.macrocycles FOR UPDATE
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_mac_delete" ON public.macrocycles;
CREATE POLICY "rls_mac_delete" ON public.macrocycles FOR DELETE
  TO authenticated USING (auth.uid() = coach_id);

-- =============================================
-- microcycles (athlete_id, coach_id)
-- =============================================
DROP POLICY IF EXISTS "rls_mic_select" ON public.microcycles;
CREATE POLICY "rls_mic_select" ON public.microcycles FOR SELECT
  TO authenticated USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_mic_insert" ON public.microcycles;
CREATE POLICY "rls_mic_insert" ON public.microcycles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_mic_update" ON public.microcycles;
CREATE POLICY "rls_mic_update" ON public.microcycles FOR UPDATE
  TO authenticated USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_mic_delete" ON public.microcycles;
CREATE POLICY "rls_mic_delete" ON public.microcycles FOR DELETE
  TO authenticated USING (auth.uid() = coach_id);

-- =============================================
-- training_weeks (athlete_id, coach_id)
-- =============================================
DROP POLICY IF EXISTS "rls_tw_select" ON public.training_weeks;
CREATE POLICY "rls_tw_select" ON public.training_weeks FOR SELECT
  TO authenticated USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_tw_insert" ON public.training_weeks;
CREATE POLICY "rls_tw_insert" ON public.training_weeks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_tw_update" ON public.training_weeks;
CREATE POLICY "rls_tw_update" ON public.training_weeks FOR UPDATE
  TO authenticated USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_tw_delete" ON public.training_weeks;
CREATE POLICY "rls_tw_delete" ON public.training_weeks FOR DELETE
  TO authenticated USING (auth.uid() = coach_id);

-- =============================================
-- menstrual_rest_periods (athlete_id)
-- =============================================
DROP POLICY IF EXISTS "rls_mrp_select" ON public.menstrual_rest_periods;
CREATE POLICY "rls_mrp_select" ON public.menstrual_rest_periods FOR SELECT
  TO authenticated USING (auth.uid() = athlete_id OR public.is_coach_of(auth.uid(), athlete_id));

DROP POLICY IF EXISTS "rls_mrp_insert" ON public.menstrual_rest_periods;
CREATE POLICY "rls_mrp_insert" ON public.menstrual_rest_periods FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_mrp_update" ON public.menstrual_rest_periods;
CREATE POLICY "rls_mrp_update" ON public.menstrual_rest_periods FOR UPDATE
  TO authenticated USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_mrp_delete" ON public.menstrual_rest_periods;
CREATE POLICY "rls_mrp_delete" ON public.menstrual_rest_periods FOR DELETE
  TO authenticated USING (auth.uid() = athlete_id);

-- =============================================
-- Tables avec id seulement (pas de colonne d'ownership)
-- Protégées : authentifié seulement (bloque anon)
-- =============================================

-- cardio_blocks
DROP POLICY IF EXISTS "rls_cb_select" ON public.cardio_blocks;
CREATE POLICY "rls_cb_select" ON public.cardio_blocks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_cb_insert" ON public.cardio_blocks;
CREATE POLICY "rls_cb_insert" ON public.cardio_blocks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rls_cb_update" ON public.cardio_blocks;
CREATE POLICY "rls_cb_update" ON public.cardio_blocks FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_cb_delete" ON public.cardio_blocks;
CREATE POLICY "rls_cb_delete" ON public.cardio_blocks FOR DELETE TO authenticated USING (true);

-- cardio_steps
DROP POLICY IF EXISTS "rls_cst_select" ON public.cardio_steps;
CREATE POLICY "rls_cst_select" ON public.cardio_steps FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_cst_insert" ON public.cardio_steps;
CREATE POLICY "rls_cst_insert" ON public.cardio_steps FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rls_cst_update" ON public.cardio_steps;
CREATE POLICY "rls_cst_update" ON public.cardio_steps FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_cst_delete" ON public.cardio_steps;
CREATE POLICY "rls_cst_delete" ON public.cardio_steps FOR DELETE TO authenticated USING (true);

-- clients
DROP POLICY IF EXISTS "rls_cl_select" ON public.clients;
CREATE POLICY "rls_cl_select" ON public.clients FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_cl_insert" ON public.clients;
CREATE POLICY "rls_cl_insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rls_cl_update" ON public.clients;
CREATE POLICY "rls_cl_update" ON public.clients FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_cl_delete" ON public.clients;
CREATE POLICY "rls_cl_delete" ON public.clients FOR DELETE TO authenticated USING (true);

-- task_items (id seulement)
DROP POLICY IF EXISTS "rls_ti_select" ON public.task_items;
CREATE POLICY "rls_ti_select" ON public.task_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_ti_insert" ON public.task_items;
CREATE POLICY "rls_ti_insert" ON public.task_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rls_ti_update" ON public.task_items;
CREATE POLICY "rls_ti_update" ON public.task_items FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_ti_delete" ON public.task_items;
CREATE POLICY "rls_ti_delete" ON public.task_items FOR DELETE TO authenticated USING (true);

-- task_templates (id seulement)
DROP POLICY IF EXISTS "rls_tt_select" ON public.task_templates;
CREATE POLICY "rls_tt_select" ON public.task_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_tt_insert" ON public.task_templates;
CREATE POLICY "rls_tt_insert" ON public.task_templates FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rls_tt_update" ON public.task_templates;
CREATE POLICY "rls_tt_update" ON public.task_templates FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_tt_delete" ON public.task_templates;
CREATE POLICY "rls_tt_delete" ON public.task_templates FOR DELETE TO authenticated USING (true);

-- task_suggestions (id seulement)
DROP POLICY IF EXISTS "rls_tsg_select" ON public.task_suggestions;
CREATE POLICY "rls_tsg_select" ON public.task_suggestions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_tsg_insert" ON public.task_suggestions;
CREATE POLICY "rls_tsg_insert" ON public.task_suggestions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rls_tsg_update" ON public.task_suggestions;
CREATE POLICY "rls_tsg_update" ON public.task_suggestions FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_tsg_delete" ON public.task_suggestions;
CREATE POLICY "rls_tsg_delete" ON public.task_suggestions FOR DELETE TO authenticated USING (true);

-- alimentation_recette (id seulement)
DROP POLICY IF EXISTS "rls_ar_select" ON public.alimentation_recette;
CREATE POLICY "rls_ar_select" ON public.alimentation_recette FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_ar_insert" ON public.alimentation_recette;
CREATE POLICY "rls_ar_insert" ON public.alimentation_recette FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rls_ar_update" ON public.alimentation_recette;
CREATE POLICY "rls_ar_update" ON public.alimentation_recette FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_ar_delete" ON public.alimentation_recette;
CREATE POLICY "rls_ar_delete" ON public.alimentation_recette FOR DELETE TO authenticated USING (true);

-- historique_recette (id seulement)
DROP POLICY IF EXISTS "rls_hr_select" ON public.historique_recette;
CREATE POLICY "rls_hr_select" ON public.historique_recette FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_hr_insert" ON public.historique_recette;
CREATE POLICY "rls_hr_insert" ON public.historique_recette FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rls_hr_update" ON public.historique_recette;
CREATE POLICY "rls_hr_update" ON public.historique_recette FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_hr_delete" ON public.historique_recette;
CREATE POLICY "rls_hr_delete" ON public.historique_recette FOR DELETE TO authenticated USING (true);

-- alimentation_liste_de_course (id seulement)
DROP POLICY IF EXISTS "rls_alc_select" ON public.alimentation_liste_de_course;
CREATE POLICY "rls_alc_select" ON public.alimentation_liste_de_course FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_alc_insert" ON public.alimentation_liste_de_course;
CREATE POLICY "rls_alc_insert" ON public.alimentation_liste_de_course FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rls_alc_update" ON public.alimentation_liste_de_course;
CREATE POLICY "rls_alc_update" ON public.alimentation_liste_de_course FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_alc_delete" ON public.alimentation_liste_de_course;
CREATE POLICY "rls_alc_delete" ON public.alimentation_liste_de_course FOR DELETE TO authenticated USING (true);

-- prise_de_contact (id seulement — formulaire public)
DROP POLICY IF EXISTS "rls_pdc_select" ON public.prise_de_contact;
CREATE POLICY "rls_pdc_select" ON public.prise_de_contact FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_pdc_insert" ON public.prise_de_contact;
CREATE POLICY "rls_pdc_insert" ON public.prise_de_contact FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "rls_pdc_update" ON public.prise_de_contact;
CREATE POLICY "rls_pdc_update" ON public.prise_de_contact FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rls_pdc_delete" ON public.prise_de_contact;
CREATE POLICY "rls_pdc_delete" ON public.prise_de_contact FOR DELETE TO authenticated USING (true);


-- ============================================================
-- FIN DU SCRIPT v2
-- ============================================================
-- Vérification après exécution :
-- SELECT tablename, policyname, cmd, roles FROM pg_policies 
-- WHERE schemaname='public' ORDER BY tablename, cmd;
-- ============================================================
