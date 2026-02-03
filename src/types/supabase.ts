// Types personnalisés pour le Supabase auto-hébergé CDO Coaching
// Ce fichier contient le schéma complet de la base de données

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      athlete_assigned_subscriptions: {
        Row: {
          id: string
          athlete_id: string
          coach_id: string
          stripe_price_id: string
          stripe_product_id: string
          product_name: string
          price_amount: number
          price_currency: string | null
          is_recurring: boolean | null
          recurring_interval: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          athlete_id: string
          coach_id: string
          stripe_price_id: string
          stripe_product_id: string
          product_name: string
          price_amount: number
          price_currency?: string | null
          is_recurring?: boolean | null
          recurring_interval?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          athlete_id?: string
          coach_id?: string
          stripe_price_id?: string
          stripe_product_id?: string
          product_name?: string
          price_amount?: number
          price_currency?: string | null
          is_recurring?: boolean | null
          recurring_interval?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      athlete_subscriptions: {
        Row: {
          id: string
          athlete_id: string
          stripe_price_id: string
          stripe_product_id: string
          product_name: string
          status: string
          is_recurring: boolean | null
          paid_at: string
          expires_at: string | null
          cancelled_at: string | null
          coach_notified: boolean | null
          cgv_accepted_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          athlete_id: string
          stripe_price_id: string
          stripe_product_id: string
          product_name: string
          status?: string
          is_recurring?: boolean | null
          paid_at?: string
          expires_at?: string | null
          cancelled_at?: string | null
          coach_notified?: boolean | null
          cgv_accepted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          athlete_id?: string
          stripe_price_id?: string
          stripe_product_id?: string
          product_name?: string
          status?: string
          is_recurring?: boolean | null
          paid_at?: string
          expires_at?: string | null
          cancelled_at?: string | null
          coach_notified?: boolean | null
          cgv_accepted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      athlete_objectives: {
        Row: {
          id: string
          athlete_id: string
          coach_id: string
          title: string
          description: string | null
          target_date: string | null
          status: string
          main_objective: string | null
          main_objective_deadline: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          athlete_id: string
          coach_id: string
          title: string
          description?: string | null
          target_date?: string | null
          status?: string
          main_objective?: string | null
          main_objective_deadline?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          athlete_id?: string
          coach_id?: string
          title?: string
          description?: string | null
          target_date?: string | null
          status?: string
          main_objective?: string | null
          main_objective_deadline?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      coach_athlete_relationships: {
        Row: {
          id: string
          coach_id: string
          athlete_id: string
          status: string
          created_at: string | null
          updated_at: string | null
          reminder_date: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          athlete_id: string
          status?: string
          created_at?: string | null
          updated_at?: string | null
          reminder_date?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          athlete_id?: string
          status?: string
          created_at?: string | null
          updated_at?: string | null
          reminder_date?: string | null
        }
        Relationships: []
      }
      coach_notes: {
        Row: {
          id: string
          coach_id: string
          athlete_id: string
          content: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          athlete_id: string
          content: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          athlete_id?: string
          content?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_fatigue_log: {
        Row: {
          id: string
          user_id: string
          date: string
          fatigue: number
          courbatures: number
          sommeil: number
          stress: number
          douleurs: number
          motivation: number
          score_total: number
          has_injury: boolean | null
          injury_location: string | null
          injury_level: number | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          fatigue: number
          courbatures: number
          sommeil: number
          stress: number
          douleurs: number
          motivation: number
          score_total: number
          has_injury?: boolean | null
          injury_location?: string | null
          injury_level?: number | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          fatigue?: number
          courbatures?: number
          sommeil?: number
          stress?: number
          douleurs?: number
          motivation?: number
          score_total?: number
          has_injury?: boolean | null
          injury_location?: string | null
          injury_level?: number | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          id: string
          name: string
          description: string | null
          video_url: string | null
          category: string | null
          muscle_group: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          load_coefficient: number | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          video_url?: string | null
          category?: string | null
          muscle_group?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          load_coefficient?: number | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          video_url?: string | null
          category?: string | null
          muscle_group?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          load_coefficient?: number | null
        }
        Relationships: []
      }
      exercise_library: {
        Row: {
          id: string
          name: string
          muscle_principal: string | null
          muscles_secondaires: string[] | null
          type: string | null
          video_url: string | null
          description: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          load_coefficient: number | null
        }
        Insert: {
          id?: string
          name: string
          muscle_principal?: string | null
          muscles_secondaires?: string[] | null
          type?: string | null
          video_url?: string | null
          description?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          load_coefficient?: number | null
        }
        Update: {
          id?: string
          name?: string
          muscle_principal?: string | null
          muscles_secondaires?: string[] | null
          type?: string | null
          video_url?: string | null
          description?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          load_coefficient?: number | null
        }
        Relationships: []
      }
      exercise_maxes: {
        Row: {
          id: string
          athlete_id: string
          exercise_id: string
          max_type: string
          weight_kg: number
          recorded_at: string
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          athlete_id: string
          exercise_id: string
          max_type: string
          weight_kg: number
          recorded_at: string
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          athlete_id?: string
          exercise_id?: string
          max_type?: string
          weight_kg?: number
          recorded_at?: string
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      external_clients: {
        Row: {
          id: string
          coach_id: string
          name: string
          email: string | null
          phone: string | null
          notes: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          name: string
          email?: string | null
          phone?: string | null
          notes?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          notes?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          id: string
          user_id: string
          access_token: string
          refresh_token: string
          expires_at: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          access_token: string
          refresh_token: string
          expires_at: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          access_token?: string
          refresh_token?: string
          expires_at?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      macrocycles: {
        Row: {
          id: string
          coach_id: string
          athlete_id: string
          name: string
          start_date: string
          end_date: string
          goal: string | null
          notes: string | null
          color: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          athlete_id: string
          name: string
          start_date: string
          end_date: string
          goal?: string | null
          notes?: string | null
          color?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          athlete_id?: string
          name?: string
          start_date?: string
          end_date?: string
          goal?: string | null
          notes?: string | null
          color?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      maxes: {
        Row: {
          id: string
          user_id: string
          exercise_id: string
          weight: number
          reps: number
          date: string
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          exercise_id: string
          weight: number
          reps: number
          date: string
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          exercise_id?: string
          weight?: number
          reps?: number
          date?: string
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          content: string
          read: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          content: string
          read?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          content?: string
          read?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          id: string
          message_id: string
          file_url: string
          file_type: string
          file_name: string
          created_at: string | null
        }
        Insert: {
          id?: string
          message_id: string
          file_url: string
          file_type: string
          file_name: string
          created_at?: string | null
        }
        Update: {
          id?: string
          message_id?: string
          file_url?: string
          file_type?: string
          file_name?: string
          created_at?: string | null
        }
        Relationships: []
      }
      mesocycles: {
        Row: {
          id: string
          name: string
          coach_id: string
          athlete_id: string
          start_date: string
          end_date: string
          goal: string | null
          notes: string | null
          color: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          coach_id: string
          athlete_id: string
          start_date: string
          end_date: string
          goal?: string | null
          notes?: string | null
          color?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          coach_id?: string
          athlete_id?: string
          start_date?: string
          end_date?: string
          goal?: string | null
          notes?: string | null
          color?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      objective_milestones: {
        Row: {
          id: string
          objective_id: string
          title: string
          label: string | null
          target_date: string | null
          notes: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          objective_id: string
          title: string
          label?: string | null
          target_date?: string | null
          notes?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          objective_id?: string
          title?: string
          label?: string | null
          target_date?: string | null
          notes?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      periodization_cycles: {
        Row: {
          id: string
          coach_id: string
          athlete_id: string
          name: string
          start_date: string
          end_date: string
          cycle_type: string
          notes: string | null
          color: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          athlete_id: string
          name: string
          start_date: string
          end_date: string
          cycle_type: string
          notes?: string | null
          color?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          athlete_id?: string
          name?: string
          start_date?: string
          end_date?: string
          cycle_type?: string
          notes?: string | null
          color?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      scheduled_sessions: {
        Row: {
          id: string
          training_session_id: string
          scheduled_date: string
          scheduled_time: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          training_session_id: string
          scheduled_date: string
          scheduled_time?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          training_session_id?: string
          scheduled_date?: string
          scheduled_time?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      session_exercises: {
        Row: {
          id: string
          session_id: string
          exercise_id: string | null
          exercice: string | null
          sets: number | null
          reps: string | null
          weight: string | null
          rest_seconds: number | null
          notes: string | null
          order_index: number | null
          tempo: string | null
          superset_group: number | null
          actual_sets: number | null
          actual_reps: string | null
          actual_weight: string | null
          rpe: number | null
          sportif_rpe: number | null
          feedback: string | null
          sportif_feedback_at: string | null
          video_url: string | null
          is_duration: boolean | null
          per_side: boolean | null
          request_video: boolean | null
          skipped: boolean | null
          commentaire: string | null
          actual_cardio_duration_minutes: number | null
          actual_cardio_distance_km: number | null
          actual_cardio_average_hr: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          session_id: string
          exercise_id?: string | null
          exercice?: string | null
          sets?: number | null
          reps?: string | null
          weight?: string | null
          rest_seconds?: number | null
          notes?: string | null
          order_index?: number | null
          tempo?: string | null
          superset_group?: number | null
          actual_sets?: number | null
          actual_reps?: string | null
          actual_weight?: string | null
          rpe?: number | null
          sportif_rpe?: number | null
          feedback?: string | null
          sportif_feedback_at?: string | null
          video_url?: string | null
          is_duration?: boolean | null
          per_side?: boolean | null
          request_video?: boolean | null
          skipped?: boolean | null
          commentaire?: string | null
          actual_cardio_duration_minutes?: number | null
          actual_cardio_distance_km?: number | null
          actual_cardio_average_hr?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string
          exercise_id?: string | null
          exercice?: string | null
          sets?: number | null
          reps?: string | null
          weight?: string | null
          rest_seconds?: number | null
          notes?: string | null
          order_index?: number | null
          tempo?: string | null
          superset_group?: number | null
          actual_sets?: number | null
          actual_reps?: string | null
          actual_weight?: string | null
          rpe?: number | null
          sportif_rpe?: number | null
          feedback?: string | null
          sportif_feedback_at?: string | null
          video_url?: string | null
          is_duration?: boolean | null
          per_side?: boolean | null
          request_video?: boolean | null
          skipped?: boolean | null
          commentaire?: string | null
          actual_cardio_duration_minutes?: number | null
          actual_cardio_distance_km?: number | null
          actual_cardio_average_hr?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      session_template_folders: {
        Row: {
          id: string
          name: string
          coach_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          coach_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          coach_id?: string
          created_at?: string | null
        }
        Relationships: []
      }
      session_templates: {
        Row: {
          id: string
          name: string
          coach_id: string
          folder_id: string | null
          exercises: Json
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          coach_id: string
          folder_id?: string | null
          exercises: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          coach_id?: string
          folder_id?: string | null
          exercises?: Json
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          id: string
          name: string
          athlete_id: string
          coach_id: string
          week_id: string | null
          week_number: number
          year: number
          status: string
          session_type: string | null
          completed_at: string | null
          duration_minutes: number | null
          session_rpe: number | null
          session_duration_minutes: number | null
          session_comment: string | null
          coach_feedback: string | null
          coach_liked: boolean | null
          cardio_total_duration_minutes: number | null
          cardio_total_distance_km: number | null
          cardio_average_intensity: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          athlete_id: string
          coach_id: string
          week_id?: string | null
          week_number: number
          year: number
          status?: string
          session_type?: string | null
          completed_at?: string | null
          duration_minutes?: number | null
          session_rpe?: number | null
          session_duration_minutes?: number | null
          session_comment?: string | null
          coach_feedback?: string | null
          coach_liked?: boolean | null
          cardio_total_duration_minutes?: number | null
          cardio_total_distance_km?: number | null
          cardio_average_intensity?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          athlete_id?: string
          coach_id?: string
          week_id?: string | null
          week_number?: number
          year?: number
          status?: string
          session_type?: string | null
          completed_at?: string | null
          duration_minutes?: number | null
          session_rpe?: number | null
          session_duration_minutes?: number | null
          session_comment?: string | null
          coach_feedback?: string | null
          coach_liked?: boolean | null
          cardio_total_duration_minutes?: number | null
          cardio_total_distance_km?: number | null
          cardio_average_intensity?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      training_weeks: {
        Row: {
          id: string
          athlete_id: string
          coach_id: string
          week_number: number
          year: number
          theme: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          athlete_id: string
          coach_id: string
          week_number: number
          year: number
          theme?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          athlete_id?: string
          coach_id?: string
          week_number?: number
          year?: number
          theme?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string
          email: string | null
          first_name: string | null
          last_name: string | null
          role: string
          birth_date: string | null
          phone: string | null
          avatar_url: string | null
          vma: number | null
          fc_max: number | null
          fc_repos: number | null
          payment_enabled: boolean | null
          health_consent: boolean | null
          health_consent_date: string | null
          health_data_consent: boolean | null
          health_data_consent_at: string | null
          approved: boolean | null
          adaptation_period_level: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          role?: string
          birth_date?: string | null
          phone?: string | null
          avatar_url?: string | null
          vma?: number | null
          fc_max?: number | null
          fc_repos?: number | null
          payment_enabled?: boolean | null
          health_consent?: boolean | null
          health_consent_date?: string | null
          health_data_consent?: boolean | null
          health_data_consent_at?: string | null
          approved?: boolean | null
          adaptation_period_level?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          role?: string
          birth_date?: string | null
          phone?: string | null
          avatar_url?: string | null
          vma?: number | null
          fc_max?: number | null
          fc_repos?: number | null
          payment_enabled?: boolean | null
          health_consent?: boolean | null
          health_consent_date?: string | null
          health_data_consent?: boolean | null
          health_data_consent_at?: string | null
          approved?: boolean | null
          adaptation_period_level?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          id: string
          user_id: string
          weight: number
          date: string
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          weight: number
          date: string
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          weight?: number
          date?: string
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      accounting_entries: {
        Row: {
          id: string
          coach_id: string
          client_id: string | null
          external_client_id: string | null
          amount: number
          description: string | null
          entry_date: string
          entry_type: string
          payment_method: string | null
          weekly_baseline: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          client_id?: string | null
          external_client_id?: string | null
          amount: number
          description?: string | null
          entry_date: string
          entry_type: string
          payment_method?: string | null
          weekly_baseline?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          client_id?: string | null
          external_client_id?: string | null
          amount?: number
          description?: string | null
          entry_date?: string
          entry_type?: string
          payment_method?: string | null
          weekly_baseline?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      microcycles: {
        Row: {
          id: string
          coach_id: string
          athlete_id: string
          name: string
          start_date: string
          end_date: string
          goal: string | null
          notes: string | null
          color: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          athlete_id: string
          name: string
          start_date: string
          end_date: string
          goal?: string | null
          notes?: string | null
          color?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          athlete_id?: string
          name?: string
          start_date?: string
          end_date?: string
          goal?: string | null
          notes?: string | null
          color?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_sessions: {
        Row: {
          id: string
          athlete_id: string
          name: string
          description: string | null
          week_number: number
          year: number
          status: string
          completed_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          athlete_id: string
          name: string
          description?: string | null
          week_number: number
          year: number
          status?: string
          completed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          athlete_id?: string
          name?: string
          description?: string | null
          week_number?: number
          year?: number
          status?: string
          completed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      weight_tracking: {
        Row: {
          id: string
          user_id: string
          weight_kg: number
          recorded_at: string
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          weight_kg: number
          recorded_at: string
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          weight_kg?: number
          recorded_at?: string
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
