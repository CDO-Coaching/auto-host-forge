-- ============================================================
-- SCRIPT DE SÉCURISATION COMPLET — CDO Coaching
-- Généré le 2026-02-12
-- IDEMPOTENT : peut être exécuté plusieurs fois sans erreur
-- ============================================================
-- INSTRUCTIONS : Exécuter ce script dans l'éditeur SQL de ton 
-- Supabase self-hosted (supabasekong.cdocoaching.com)
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
-- PARTIE 2 : ACTIVER RLS + FORCER sur toutes les tables
-- ============================================================

-- user_profiles
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles FORCE ROW LEVEL SECURITY;

-- coach_athlete_relationships
ALTER TABLE IF EXISTS public.coach_athlete_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coach_athlete_relationships FORCE ROW LEVEL SECURITY;

-- training_sessions
ALTER TABLE IF EXISTS public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.training_sessions FORCE ROW LEVEL SECURITY;

-- session_exercises
ALTER TABLE IF EXISTS public.session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.session_exercises FORCE ROW LEVEL SECURITY;

-- exercise_library
ALTER TABLE IF EXISTS public.exercise_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exercise_library FORCE ROW LEVEL SECURITY;

-- messages
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages FORCE ROW LEVEL SECURITY;

-- chat_attachments
ALTER TABLE IF EXISTS public.chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_attachments FORCE ROW LEVEL SECURITY;

-- daily_fatigue
ALTER TABLE IF EXISTS public.daily_fatigue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_fatigue FORCE ROW LEVEL SECURITY;

-- daily_fatigue_log
ALTER TABLE IF EXISTS public.daily_fatigue_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_fatigue_log FORCE ROW LEVEL SECURITY;

-- daily_health_checkin
ALTER TABLE IF EXISTS public.daily_health_checkin ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_health_checkin FORCE ROW LEVEL SECURITY;

-- athlete_objectives
ALTER TABLE IF EXISTS public.athlete_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.athlete_objectives FORCE ROW LEVEL SECURITY;

-- objective_milestones
ALTER TABLE IF EXISTS public.objective_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.objective_milestones FORCE ROW LEVEL SECURITY;

-- athlete_subscriptions
ALTER TABLE IF EXISTS public.athlete_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.athlete_subscriptions FORCE ROW LEVEL SECURITY;

-- athlete_assigned_subscriptions
ALTER TABLE IF EXISTS public.athlete_assigned_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.athlete_assigned_subscriptions FORCE ROW LEVEL SECURITY;

-- accounting_entries
ALTER TABLE IF EXISTS public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.accounting_entries FORCE ROW LEVEL SECURITY;

-- google_calendar_tokens
ALTER TABLE IF EXISTS public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.google_calendar_tokens FORCE ROW LEVEL SECURITY;

-- coach_notes
ALTER TABLE IF EXISTS public.coach_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coach_notes FORCE ROW LEVEL SECURITY;

-- external_clients
ALTER TABLE IF EXISTS public.external_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.external_clients FORCE ROW LEVEL SECURITY;

-- external_client_notes
ALTER TABLE IF EXISTS public.external_client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.external_client_notes FORCE ROW LEVEL SECURITY;

-- session_templates
ALTER TABLE IF EXISTS public.session_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.session_templates FORCE ROW LEVEL SECURITY;

-- session_template_folders
ALTER TABLE IF EXISTS public.session_template_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.session_template_folders FORCE ROW LEVEL SECURITY;

-- scheduled_sessions
ALTER TABLE IF EXISTS public.scheduled_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_sessions FORCE ROW LEVEL SECURITY;

-- mesocycles
ALTER TABLE IF EXISTS public.mesocycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mesocycles FORCE ROW LEVEL SECURITY;

-- periodization_cycles
ALTER TABLE IF EXISTS public.periodization_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.periodization_cycles FORCE ROW LEVEL SECURITY;

-- task_items
ALTER TABLE IF EXISTS public.task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.task_items FORCE ROW LEVEL SECURITY;

-- task_templates
ALTER TABLE IF EXISTS public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.task_templates FORCE ROW LEVEL SECURITY;

-- alimentation_recette
ALTER TABLE IF EXISTS public.alimentation_recette ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alimentation_recette FORCE ROW LEVEL SECURITY;

-- historique_recette
ALTER TABLE IF EXISTS public.historique_recette ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.historique_recette FORCE ROW LEVEL SECURITY;

-- alimentation_liste_de_course
ALTER TABLE IF EXISTS public.alimentation_liste_de_course ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alimentation_liste_de_course FORCE ROW LEVEL SECURITY;

-- user_maxes
ALTER TABLE IF EXISTS public.user_maxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_maxes FORCE ROW LEVEL SECURITY;

-- user_weight_log
ALTER TABLE IF EXISTS public.user_weight_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_weight_log FORCE ROW LEVEL SECURITY;


-- ============================================================
-- PARTIE 3 : POLICIES PAR TABLE
-- ============================================================

-- ====================
-- user_profiles (id = auth.users.id)
-- ====================
DROP POLICY IF EXISTS "rls_user_profiles_select" ON public.user_profiles;
CREATE POLICY "rls_user_profiles_select" ON public.user_profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id 
    OR public.is_coach_of(auth.uid(), id)
  );

DROP POLICY IF EXISTS "rls_user_profiles_insert" ON public.user_profiles;
CREATE POLICY "rls_user_profiles_insert" ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "rls_user_profiles_update" ON public.user_profiles;
CREATE POLICY "rls_user_profiles_update" ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id 
    OR public.is_coach_of(auth.uid(), id)
  )
  WITH CHECK (
    auth.uid() = id 
    OR public.is_coach_of(auth.uid(), id)
  );

DROP POLICY IF EXISTS "rls_user_profiles_delete" ON public.user_profiles;
CREATE POLICY "rls_user_profiles_delete" ON public.user_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Permettre INSERT lors de l'inscription (trigger ou signup)
DROP POLICY IF EXISTS "rls_user_profiles_insert_anon" ON public.user_profiles;
CREATE POLICY "rls_user_profiles_insert_anon" ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ====================
-- coach_athlete_relationships (coach_id, athlete_id)
-- ====================
DROP POLICY IF EXISTS "rls_car_select" ON public.coach_athlete_relationships;
CREATE POLICY "rls_car_select" ON public.coach_athlete_relationships FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_car_insert" ON public.coach_athlete_relationships;
CREATE POLICY "rls_car_insert" ON public.coach_athlete_relationships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id OR auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_car_update" ON public.coach_athlete_relationships;
CREATE POLICY "rls_car_update" ON public.coach_athlete_relationships FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id OR auth.uid() = athlete_id)
  WITH CHECK (auth.uid() = coach_id OR auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_car_delete" ON public.coach_athlete_relationships;
CREATE POLICY "rls_car_delete" ON public.coach_athlete_relationships FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- ====================
-- training_sessions (athlete_id, coach_id)
-- ====================
DROP POLICY IF EXISTS "rls_ts_select" ON public.training_sessions;
CREATE POLICY "rls_ts_select" ON public.training_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id OR public.is_coach_of(auth.uid(), athlete_id));

DROP POLICY IF EXISTS "rls_ts_insert" ON public.training_sessions;
CREATE POLICY "rls_ts_insert" ON public.training_sessions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_coach_of(auth.uid(), athlete_id));

DROP POLICY IF EXISTS "rls_ts_update" ON public.training_sessions;
CREATE POLICY "rls_ts_update" ON public.training_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = athlete_id OR public.is_coach_of(auth.uid(), athlete_id))
  WITH CHECK (auth.uid() = athlete_id OR public.is_coach_of(auth.uid(), athlete_id));

DROP POLICY IF EXISTS "rls_ts_delete" ON public.training_sessions;
CREATE POLICY "rls_ts_delete" ON public.training_sessions FOR DELETE
  TO authenticated
  USING (public.is_coach_of(auth.uid(), athlete_id));

-- ====================
-- session_exercises (session_id → training_sessions)
-- On utilise une sous-requête pour vérifier l'accès via la session parente
-- ====================
DROP POLICY IF EXISTS "rls_se_select" ON public.session_exercises;
CREATE POLICY "rls_se_select" ON public.session_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts 
      WHERE ts.id = session_exercises.session_id 
      AND (ts.athlete_id = auth.uid() OR public.is_coach_of(auth.uid(), ts.athlete_id))
    )
  );

DROP POLICY IF EXISTS "rls_se_insert" ON public.session_exercises;
CREATE POLICY "rls_se_insert" ON public.session_exercises FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts 
      WHERE ts.id = session_exercises.session_id 
      AND (ts.athlete_id = auth.uid() OR public.is_coach_of(auth.uid(), ts.athlete_id))
    )
  );

DROP POLICY IF EXISTS "rls_se_update" ON public.session_exercises;
CREATE POLICY "rls_se_update" ON public.session_exercises FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts 
      WHERE ts.id = session_exercises.session_id 
      AND (ts.athlete_id = auth.uid() OR public.is_coach_of(auth.uid(), ts.athlete_id))
    )
  );

DROP POLICY IF EXISTS "rls_se_delete" ON public.session_exercises;
CREATE POLICY "rls_se_delete" ON public.session_exercises FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts 
      WHERE ts.id = session_exercises.session_id 
      AND public.is_coach_of(auth.uid(), ts.athlete_id)
    )
  );

-- ====================
-- exercise_library (coach_id ou partagé)
-- Lecture par tous les authentifiés, écriture par le coach propriétaire
-- ====================
DROP POLICY IF EXISTS "rls_el_select" ON public.exercise_library;
CREATE POLICY "rls_el_select" ON public.exercise_library FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rls_el_insert" ON public.exercise_library;
CREATE POLICY "rls_el_insert" ON public.exercise_library FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_el_update" ON public.exercise_library;
CREATE POLICY "rls_el_update" ON public.exercise_library FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_el_delete" ON public.exercise_library;
CREATE POLICY "rls_el_delete" ON public.exercise_library FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- ====================
-- messages (sender_id, receiver_id)
-- ====================
DROP POLICY IF EXISTS "rls_msg_select" ON public.messages;
CREATE POLICY "rls_msg_select" ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "rls_msg_insert" ON public.messages;
CREATE POLICY "rls_msg_insert" ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "rls_msg_update" ON public.messages;
CREATE POLICY "rls_msg_update" ON public.messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "rls_msg_delete" ON public.messages;
CREATE POLICY "rls_msg_delete" ON public.messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- ====================
-- chat_attachments (sender_id)
-- ====================
DROP POLICY IF EXISTS "rls_ca_select" ON public.chat_attachments;
CREATE POLICY "rls_ca_select" ON public.chat_attachments FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "rls_ca_insert" ON public.chat_attachments;
CREATE POLICY "rls_ca_insert" ON public.chat_attachments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "rls_ca_update" ON public.chat_attachments;
CREATE POLICY "rls_ca_update" ON public.chat_attachments FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "rls_ca_delete" ON public.chat_attachments;
CREATE POLICY "rls_ca_delete" ON public.chat_attachments FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- ====================
-- daily_fatigue (user_id) — Données de fatigue athlète
-- ====================
DROP POLICY IF EXISTS "rls_df_select" ON public.daily_fatigue;
CREATE POLICY "rls_df_select" ON public.daily_fatigue FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "rls_df_insert" ON public.daily_fatigue;
CREATE POLICY "rls_df_insert" ON public.daily_fatigue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_df_update" ON public.daily_fatigue;
CREATE POLICY "rls_df_update" ON public.daily_fatigue FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_df_delete" ON public.daily_fatigue;
CREATE POLICY "rls_df_delete" ON public.daily_fatigue FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ====================
-- daily_fatigue_log (user_id) — Historique fatigue
-- ====================
DROP POLICY IF EXISTS "rls_dfl_select" ON public.daily_fatigue_log;
CREATE POLICY "rls_dfl_select" ON public.daily_fatigue_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "rls_dfl_insert" ON public.daily_fatigue_log;
CREATE POLICY "rls_dfl_insert" ON public.daily_fatigue_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_dfl_update" ON public.daily_fatigue_log;
CREATE POLICY "rls_dfl_update" ON public.daily_fatigue_log FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_dfl_delete" ON public.daily_fatigue_log;
CREATE POLICY "rls_dfl_delete" ON public.daily_fatigue_log FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ====================
-- daily_health_checkin (user_id) — ⚠️ DONNÉES DE SANTÉ RGPD
-- ====================
DROP POLICY IF EXISTS "rls_dhc_select" ON public.daily_health_checkin;
CREATE POLICY "rls_dhc_select" ON public.daily_health_checkin FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "rls_dhc_insert" ON public.daily_health_checkin;
CREATE POLICY "rls_dhc_insert" ON public.daily_health_checkin FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_dhc_update" ON public.daily_health_checkin;
CREATE POLICY "rls_dhc_update" ON public.daily_health_checkin FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_dhc_delete" ON public.daily_health_checkin;
CREATE POLICY "rls_dhc_delete" ON public.daily_health_checkin FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ====================
-- athlete_objectives (athlete_id, coach_id)
-- ====================
DROP POLICY IF EXISTS "rls_ao_select" ON public.athlete_objectives;
CREATE POLICY "rls_ao_select" ON public.athlete_objectives FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ao_insert" ON public.athlete_objectives;
CREATE POLICY "rls_ao_insert" ON public.athlete_objectives FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id OR auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_ao_update" ON public.athlete_objectives;
CREATE POLICY "rls_ao_update" ON public.athlete_objectives FOR UPDATE
  TO authenticated
  USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ao_delete" ON public.athlete_objectives;
CREATE POLICY "rls_ao_delete" ON public.athlete_objectives FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- ====================
-- objective_milestones (athlete_id)
-- ====================
DROP POLICY IF EXISTS "rls_om_select" ON public.objective_milestones;
CREATE POLICY "rls_om_select" ON public.objective_milestones FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id OR public.is_coach_of(auth.uid(), athlete_id));

DROP POLICY IF EXISTS "rls_om_insert" ON public.objective_milestones;
CREATE POLICY "rls_om_insert" ON public.objective_milestones FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = athlete_id OR public.is_coach_of(auth.uid(), athlete_id));

DROP POLICY IF EXISTS "rls_om_update" ON public.objective_milestones;
CREATE POLICY "rls_om_update" ON public.objective_milestones FOR UPDATE
  TO authenticated
  USING (auth.uid() = athlete_id OR public.is_coach_of(auth.uid(), athlete_id));

DROP POLICY IF EXISTS "rls_om_delete" ON public.objective_milestones;
CREATE POLICY "rls_om_delete" ON public.objective_milestones FOR DELETE
  TO authenticated
  USING (auth.uid() = athlete_id OR public.is_coach_of(auth.uid(), athlete_id));

-- ====================
-- athlete_subscriptions (athlete_id)
-- ====================
DROP POLICY IF EXISTS "rls_as_select" ON public.athlete_subscriptions;
CREATE POLICY "rls_as_select" ON public.athlete_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_as_insert" ON public.athlete_subscriptions;
CREATE POLICY "rls_as_insert" ON public.athlete_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_as_update" ON public.athlete_subscriptions;
CREATE POLICY "rls_as_update" ON public.athlete_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_as_delete" ON public.athlete_subscriptions;
CREATE POLICY "rls_as_delete" ON public.athlete_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = athlete_id);

-- ====================
-- athlete_assigned_subscriptions (coach_id, athlete_id)
-- ====================
DROP POLICY IF EXISTS "rls_aas_select" ON public.athlete_assigned_subscriptions;
CREATE POLICY "rls_aas_select" ON public.athlete_assigned_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_aas_insert" ON public.athlete_assigned_subscriptions;
CREATE POLICY "rls_aas_insert" ON public.athlete_assigned_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_aas_update" ON public.athlete_assigned_subscriptions;
CREATE POLICY "rls_aas_update" ON public.athlete_assigned_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_aas_delete" ON public.athlete_assigned_subscriptions;
CREATE POLICY "rls_aas_delete" ON public.athlete_assigned_subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- ====================
-- accounting_entries (coach_id)
-- ====================
DROP POLICY IF EXISTS "rls_ae_select" ON public.accounting_entries;
CREATE POLICY "rls_ae_select" ON public.accounting_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ae_insert" ON public.accounting_entries;
CREATE POLICY "rls_ae_insert" ON public.accounting_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ae_update" ON public.accounting_entries;
CREATE POLICY "rls_ae_update" ON public.accounting_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ae_delete" ON public.accounting_entries;
CREATE POLICY "rls_ae_delete" ON public.accounting_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- ====================
-- google_calendar_tokens (user_id) — SENSIBLE : tokens OAuth
-- ====================
DROP POLICY IF EXISTS "rls_gct_select" ON public.google_calendar_tokens;
CREATE POLICY "rls_gct_select" ON public.google_calendar_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_gct_insert" ON public.google_calendar_tokens;
CREATE POLICY "rls_gct_insert" ON public.google_calendar_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_gct_update" ON public.google_calendar_tokens;
CREATE POLICY "rls_gct_update" ON public.google_calendar_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_gct_delete" ON public.google_calendar_tokens;
CREATE POLICY "rls_gct_delete" ON public.google_calendar_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ====================
-- coach_notes (coach_id)
-- ====================
DROP POLICY IF EXISTS "rls_cn_select" ON public.coach_notes;
CREATE POLICY "rls_cn_select" ON public.coach_notes FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_cn_insert" ON public.coach_notes;
CREATE POLICY "rls_cn_insert" ON public.coach_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_cn_update" ON public.coach_notes;
CREATE POLICY "rls_cn_update" ON public.coach_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_cn_delete" ON public.coach_notes;
CREATE POLICY "rls_cn_delete" ON public.coach_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- ====================
-- external_clients (coach_id)
-- ====================
DROP POLICY IF EXISTS "rls_ec_select" ON public.external_clients;
CREATE POLICY "rls_ec_select" ON public.external_clients FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ec_insert" ON public.external_clients;
CREATE POLICY "rls_ec_insert" ON public.external_clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ec_update" ON public.external_clients;
CREATE POLICY "rls_ec_update" ON public.external_clients FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ec_delete" ON public.external_clients;
CREATE POLICY "rls_ec_delete" ON public.external_clients FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- ====================
-- external_client_notes (coach_id ou via external_clients)
-- ====================
DROP POLICY IF EXISTS "rls_ecn_select" ON public.external_client_notes;
CREATE POLICY "rls_ecn_select" ON public.external_client_notes FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ecn_insert" ON public.external_client_notes;
CREATE POLICY "rls_ecn_insert" ON public.external_client_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ecn_update" ON public.external_client_notes;
CREATE POLICY "rls_ecn_update" ON public.external_client_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ecn_delete" ON public.external_client_notes;
CREATE POLICY "rls_ecn_delete" ON public.external_client_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- ====================
-- session_templates (coach_id)
-- ====================
DROP POLICY IF EXISTS "rls_st_select" ON public.session_templates;
CREATE POLICY "rls_st_select" ON public.session_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_st_insert" ON public.session_templates;
CREATE POLICY "rls_st_insert" ON public.session_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_st_update" ON public.session_templates;
CREATE POLICY "rls_st_update" ON public.session_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_st_delete" ON public.session_templates;
CREATE POLICY "rls_st_delete" ON public.session_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- ====================
-- session_template_folders (coach_id)
-- ====================
DROP POLICY IF EXISTS "rls_stf_select" ON public.session_template_folders;
CREATE POLICY "rls_stf_select" ON public.session_template_folders FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_stf_insert" ON public.session_template_folders;
CREATE POLICY "rls_stf_insert" ON public.session_template_folders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_stf_update" ON public.session_template_folders;
CREATE POLICY "rls_stf_update" ON public.session_template_folders FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_stf_delete" ON public.session_template_folders;
CREATE POLICY "rls_stf_delete" ON public.session_template_folders FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- ====================
-- scheduled_sessions (coach_id, athlete_id)
-- ====================
DROP POLICY IF EXISTS "rls_ss_select" ON public.scheduled_sessions;
CREATE POLICY "rls_ss_select" ON public.scheduled_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ss_insert" ON public.scheduled_sessions;
CREATE POLICY "rls_ss_insert" ON public.scheduled_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id OR auth.uid() = athlete_id);

DROP POLICY IF EXISTS "rls_ss_update" ON public.scheduled_sessions;
CREATE POLICY "rls_ss_update" ON public.scheduled_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_ss_delete" ON public.scheduled_sessions;
CREATE POLICY "rls_ss_delete" ON public.scheduled_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id OR auth.uid() = athlete_id);

-- ====================
-- mesocycles (coach_id, athlete_id)
-- ====================
DROP POLICY IF EXISTS "rls_mc_select" ON public.mesocycles;
CREATE POLICY "rls_mc_select" ON public.mesocycles FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_mc_insert" ON public.mesocycles;
CREATE POLICY "rls_mc_insert" ON public.mesocycles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_mc_update" ON public.mesocycles;
CREATE POLICY "rls_mc_update" ON public.mesocycles FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_mc_delete" ON public.mesocycles;
CREATE POLICY "rls_mc_delete" ON public.mesocycles FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- ====================
-- periodization_cycles (coach_id, athlete_id)
-- ====================
DROP POLICY IF EXISTS "rls_pc_select" ON public.periodization_cycles;
CREATE POLICY "rls_pc_select" ON public.periodization_cycles FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id OR auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_pc_insert" ON public.periodization_cycles;
CREATE POLICY "rls_pc_insert" ON public.periodization_cycles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_pc_update" ON public.periodization_cycles;
CREATE POLICY "rls_pc_update" ON public.periodization_cycles FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

DROP POLICY IF EXISTS "rls_pc_delete" ON public.periodization_cycles;
CREATE POLICY "rls_pc_delete" ON public.periodization_cycles FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- ====================
-- task_items (user_id)
-- ====================
DROP POLICY IF EXISTS "rls_ti_select" ON public.task_items;
CREATE POLICY "rls_ti_select" ON public.task_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_ti_insert" ON public.task_items;
CREATE POLICY "rls_ti_insert" ON public.task_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_ti_update" ON public.task_items;
CREATE POLICY "rls_ti_update" ON public.task_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_ti_delete" ON public.task_items;
CREATE POLICY "rls_ti_delete" ON public.task_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ====================
-- task_templates (user_id ou coach_id)
-- ====================
DROP POLICY IF EXISTS "rls_tt_select" ON public.task_templates;
CREATE POLICY "rls_tt_select" ON public.task_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_tt_insert" ON public.task_templates;
CREATE POLICY "rls_tt_insert" ON public.task_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_tt_update" ON public.task_templates;
CREATE POLICY "rls_tt_update" ON public.task_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_tt_delete" ON public.task_templates;
CREATE POLICY "rls_tt_delete" ON public.task_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ====================
-- alimentation_recette (user_id)
-- ====================
DROP POLICY IF EXISTS "rls_ar_select" ON public.alimentation_recette;
CREATE POLICY "rls_ar_select" ON public.alimentation_recette FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_ar_insert" ON public.alimentation_recette;
CREATE POLICY "rls_ar_insert" ON public.alimentation_recette FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_ar_update" ON public.alimentation_recette;
CREATE POLICY "rls_ar_update" ON public.alimentation_recette FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_ar_delete" ON public.alimentation_recette;
CREATE POLICY "rls_ar_delete" ON public.alimentation_recette FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ====================
-- historique_recette (user_id)
-- ====================
DROP POLICY IF EXISTS "rls_hr_select" ON public.historique_recette;
CREATE POLICY "rls_hr_select" ON public.historique_recette FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_hr_insert" ON public.historique_recette;
CREATE POLICY "rls_hr_insert" ON public.historique_recette FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_hr_update" ON public.historique_recette;
CREATE POLICY "rls_hr_update" ON public.historique_recette FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_hr_delete" ON public.historique_recette;
CREATE POLICY "rls_hr_delete" ON public.historique_recette FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ====================
-- alimentation_liste_de_course (user_id)
-- ====================
DROP POLICY IF EXISTS "rls_alc_select" ON public.alimentation_liste_de_course;
CREATE POLICY "rls_alc_select" ON public.alimentation_liste_de_course FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_alc_insert" ON public.alimentation_liste_de_course;
CREATE POLICY "rls_alc_insert" ON public.alimentation_liste_de_course FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_alc_update" ON public.alimentation_liste_de_course;
CREATE POLICY "rls_alc_update" ON public.alimentation_liste_de_course FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_alc_delete" ON public.alimentation_liste_de_course;
CREATE POLICY "rls_alc_delete" ON public.alimentation_liste_de_course FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ====================
-- user_maxes (user_id)
-- ====================
DROP POLICY IF EXISTS "rls_um_select" ON public.user_maxes;
CREATE POLICY "rls_um_select" ON public.user_maxes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "rls_um_insert" ON public.user_maxes;
CREATE POLICY "rls_um_insert" ON public.user_maxes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "rls_um_update" ON public.user_maxes;
CREATE POLICY "rls_um_update" ON public.user_maxes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "rls_um_delete" ON public.user_maxes;
CREATE POLICY "rls_um_delete" ON public.user_maxes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

-- ====================
-- user_weight_log (user_id)
-- ====================
DROP POLICY IF EXISTS "rls_uwl_select" ON public.user_weight_log;
CREATE POLICY "rls_uwl_select" ON public.user_weight_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_coach_of(auth.uid(), user_id));

DROP POLICY IF EXISTS "rls_uwl_insert" ON public.user_weight_log;
CREATE POLICY "rls_uwl_insert" ON public.user_weight_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_uwl_update" ON public.user_weight_log;
CREATE POLICY "rls_uwl_update" ON public.user_weight_log FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rls_uwl_delete" ON public.user_weight_log;
CREATE POLICY "rls_uwl_delete" ON public.user_weight_log FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================
-- PARTIE 4 : SUPPRIMER les anciennes policies trop permissives
-- (celles qui utilisent le rôle anon ou n'ont pas de restriction)
-- ============================================================

-- Supprimer les vieilles policies nommées différemment qui pourraient être trop ouvertes
-- (à adapter selon ce qui existe réellement dans ta DB)
DROP POLICY IF EXISTS "Coaches can manage their athletes subscriptions" ON public.athlete_assigned_subscriptions;
DROP POLICY IF EXISTS "Athletes can view their assigned subscriptions" ON public.athlete_assigned_subscriptions;
DROP POLICY IF EXISTS "Coaches can update approved field for their athletes" ON public.user_profiles;
DROP POLICY IF EXISTS "Athletes can insert their own subscriptions" ON public.athlete_subscriptions;
DROP POLICY IF EXISTS "Athletes can view their own subscriptions" ON public.athlete_subscriptions;
DROP POLICY IF EXISTS "Athletes can update their own subscriptions" ON public.athlete_subscriptions;
DROP POLICY IF EXISTS "Athletes can insert their own milestones" ON public.objective_milestones;
DROP POLICY IF EXISTS "Athletes can update their own milestones" ON public.objective_milestones;
DROP POLICY IF EXISTS "Athletes can delete their own milestones" ON public.objective_milestones;


-- ============================================================
-- PARTIE 5 : SÉCURITÉ SUPPLÉMENTAIRE
-- ============================================================

-- Supprimer la edge function "hello" par défaut (à faire manuellement)
-- → Supprimer le dossier supabase/functions/hello/ si il existe

-- Désactiver phone_autoconfirm → à faire dans la config Supabase Auth


-- ============================================================
-- FIN DU SCRIPT
-- ============================================================
-- Après exécution, vérifier avec :
-- SELECT schemaname, tablename, policyname, cmd FROM pg_policies WHERE schemaname='public' ORDER BY tablename;
