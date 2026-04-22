export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      athlete_methodology_assignments: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string
          id: string
          methodology_id: string
          notes: string | null
          start_date: string
          status: string
          total_weeks: number
          updated_at: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string
          id?: string
          methodology_id: string
          notes?: string | null
          start_date?: string
          status?: string
          total_weeks?: number
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          methodology_id?: string
          notes?: string | null
          start_date?: string
          status?: string
          total_weeks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_methodology_assignments_methodology_id_fkey"
            columns: ["methodology_id"]
            isOneToOne: false
            referencedRelation: "coaching_methodologies"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_methodology_maxes: {
        Row: {
          assignment_id: string
          created_at: string
          exercise_id: string
          exercise_name: string
          id: string
          reference_max: number
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          exercise_id: string
          exercise_name: string
          id?: string
          reference_max?: number
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          exercise_id?: string
          exercise_name?: string
          id?: string
          reference_max?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_methodology_maxes_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "athlete_methodology_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_methodology_weeks: {
        Row: {
          assignment_id: string
          coach_notes: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          observed_rpe: number | null
          week_number: number
        }
        Insert: {
          assignment_id: string
          coach_notes?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          observed_rpe?: number | null
          week_number: number
        }
        Update: {
          assignment_id?: string
          coach_notes?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          observed_rpe?: number | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_methodology_weeks_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "athlete_methodology_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_subscriptions: {
        Row: {
          athlete_id: string
          cancelled_at: string | null
          cgv_accepted_at: string | null
          coach_notified: boolean | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_recurring: boolean | null
          paid_at: string
          product_name: string
          status: string
          stripe_price_id: string
          stripe_product_id: string
          updated_at: string | null
        }
        Insert: {
          athlete_id: string
          cancelled_at?: string | null
          cgv_accepted_at?: string | null
          coach_notified?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_recurring?: boolean | null
          paid_at?: string
          product_name: string
          status?: string
          stripe_price_id: string
          stripe_product_id: string
          updated_at?: string | null
        }
        Update: {
          athlete_id?: string
          cancelled_at?: string | null
          cgv_accepted_at?: string | null
          coach_notified?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_recurring?: boolean | null
          paid_at?: string
          product_name?: string
          status?: string
          stripe_price_id?: string
          stripe_product_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      coach_notes: {
        Row: {
          athlete_id: string | null
          coach_id: string
          content: string
          created_at: string | null
          external_client_id: string | null
          id: string
          target_date: string | null
        }
        Insert: {
          athlete_id?: string | null
          coach_id: string
          content: string
          created_at?: string | null
          external_client_id?: string | null
          id?: string
          target_date?: string | null
        }
        Update: {
          athlete_id?: string | null
          coach_id?: string
          content?: string
          created_at?: string | null
          external_client_id?: string | null
          id?: string
          target_date?: string | null
        }
        Relationships: []
      }
      coaching_methodologies: {
        Row: {
          coach_id: string
          created_at: string
          description: string | null
          duration_weeks_max: number | null
          duration_weeks_min: number | null
          full_description: string | null
          id: string
          name: string
          num_cycles: number | null
          progression_summary: string | null
          rpe_target_max: number | null
          rpe_target_min: number | null
          session_exercise_configs: Json | null
          sessions_options: number[] | null
          updated_at: string
          weeks_per_cycle: number | null
        }
        Insert: {
          coach_id: string
          created_at?: string
          description?: string | null
          duration_weeks_max?: number | null
          duration_weeks_min?: number | null
          full_description?: string | null
          id?: string
          name: string
          num_cycles?: number | null
          progression_summary?: string | null
          rpe_target_max?: number | null
          rpe_target_min?: number | null
          session_exercise_configs?: Json | null
          sessions_options?: number[] | null
          updated_at?: string
          weeks_per_cycle?: number | null
        }
        Update: {
          coach_id?: string
          created_at?: string
          description?: string | null
          duration_weeks_max?: number | null
          duration_weeks_min?: number | null
          full_description?: string | null
          id?: string
          name?: string
          num_cycles?: number | null
          progression_summary?: string | null
          rpe_target_max?: number | null
          rpe_target_min?: number | null
          session_exercise_configs?: Json | null
          sessions_options?: number[] | null
          updated_at?: string
          weeks_per_cycle?: number | null
        }
        Relationships: []
      }
      invoice_counters: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          last_number: number
          updated_at: string
          year: number
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          last_number?: number
          updated_at?: string
          year: number
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          last_number?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          client_address: string | null
          client_id: string | null
          client_name: string
          coach_address: string | null
          coach_email: string | null
          coach_id: string
          coach_name: string
          coach_phone: string | null
          coach_siret: string | null
          created_at: string
          external_client_id: string | null
          id: string
          invoice_number: string
          issue_date: string
          metadata: Json | null
          payment_date: string | null
          payment_method: string
          service_period_end: string
          service_period_start: string
          sessions_count: number
          status: string
          total_amount: number
          unit_price: number | null
        }
        Insert: {
          client_address?: string | null
          client_id?: string | null
          client_name: string
          coach_address?: string | null
          coach_email?: string | null
          coach_id: string
          coach_name: string
          coach_phone?: string | null
          coach_siret?: string | null
          created_at?: string
          external_client_id?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          metadata?: Json | null
          payment_date?: string | null
          payment_method: string
          service_period_end: string
          service_period_start: string
          sessions_count?: number
          status?: string
          total_amount: number
          unit_price?: number | null
        }
        Update: {
          client_address?: string | null
          client_id?: string | null
          client_name?: string
          coach_address?: string | null
          coach_email?: string | null
          coach_id?: string
          coach_name?: string
          coach_phone?: string | null
          coach_siret?: string | null
          created_at?: string
          external_client_id?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          metadata?: Json | null
          payment_date?: string | null
          payment_method?: string
          service_period_end?: string
          service_period_start?: string
          sessions_count?: number
          status?: string
          total_amount?: number
          unit_price?: number | null
        }
        Relationships: []
      }
      methodology_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          methodology_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          methodology_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          methodology_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodology_exercises_methodology_id_fkey"
            columns: ["methodology_id"]
            isOneToOne: false
            referencedRelation: "coaching_methodologies"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_themes: {
        Row: {
          id: string
          methodology_id: string
          theme: Database["public"]["Enums"]["methodology_theme"]
        }
        Insert: {
          id?: string
          methodology_id: string
          theme: Database["public"]["Enums"]["methodology_theme"]
        }
        Update: {
          id?: string
          methodology_id?: string
          theme?: Database["public"]["Enums"]["methodology_theme"]
        }
        Relationships: [
          {
            foreignKeyName: "methodology_themes_methodology_id_fkey"
            columns: ["methodology_id"]
            isOneToOne: false
            referencedRelation: "coaching_methodologies"
            referencedColumns: ["id"]
          },
        ]
      }
      sfms_questionnaire_requests: {
        Row: {
          athlete_id: string
          coach_id: string
          completed_at: string | null
          created_at: string
          id: string
          requested_at: string
          result_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          requested_at?: string
          result_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          requested_at?: string
          result_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sfms_questionnaire_results: {
        Row: {
          ai_feedback: string | null
          answers: Json
          athlete_id: string
          completed_at: string
          created_at: string
          id: string
          score_cognitif: number
          score_fatigue_physique: number
          score_performance: number
          score_physiologique: number
          score_psychologique: number
          score_sommeil_appetit: number
          total_score: number
        }
        Insert: {
          ai_feedback?: string | null
          answers?: Json
          athlete_id: string
          completed_at?: string
          created_at?: string
          id?: string
          score_cognitif?: number
          score_fatigue_physique?: number
          score_performance?: number
          score_physiologique?: number
          score_psychologique?: number
          score_sommeil_appetit?: number
          total_score: number
        }
        Update: {
          ai_feedback?: string | null
          answers?: Json
          athlete_id?: string
          completed_at?: string
          created_at?: string
          id?: string
          score_cognitif?: number
          score_fatigue_physique?: number
          score_performance?: number
          score_physiologique?: number
          score_psychologique?: number
          score_sommeil_appetit?: number
          total_score?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_invoice_number: {
        Args: { p_coach_id: string; p_year: number }
        Returns: number
      }
    }
    Enums: {
      methodology_theme:
        | "endurance"
        | "force"
        | "hypertrophie"
        | "rehabilitation"
        | "mobilite"
        | "explosivite"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      methodology_theme: [
        "endurance",
        "force",
        "hypertrophie",
        "rehabilitation",
        "mobilite",
        "explosivite",
      ],
    },
  },
} as const
