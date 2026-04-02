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
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
