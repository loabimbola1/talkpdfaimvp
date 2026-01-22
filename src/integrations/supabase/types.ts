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
      badges: {
        Row: {
          badge_name: string
          badge_type: string
          created_at: string
          description: string | null
          document_id: string | null
          earned_at: string
          id: string
          score: number | null
          shared_on: string[] | null
          user_id: string
        }
        Insert: {
          badge_name: string
          badge_type: string
          created_at?: string
          description?: string | null
          document_id?: string | null
          earned_at?: string
          id?: string
          score?: number | null
          shared_on?: string[] | null
          user_id: string
        }
        Update: {
          badge_name?: string
          badge_type?: string
          created_at?: string
          description?: string | null
          document_id?: string | null
          earned_at?: string
          id?: string
          score?: number | null
          shared_on?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "badges_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_usage_summary: {
        Row: {
          audio_minutes_used: number | null
          created_at: string
          date: string
          explain_back_count: number | null
          id: string
          pdfs_uploaded: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_minutes_used?: number | null
          created_at?: string
          date?: string
          explain_back_count?: number | null
          id?: string
          pdfs_uploaded?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_minutes_used?: number | null
          created_at?: string
          date?: string
          explain_back_count?: number | null
          id?: string
          pdfs_uploaded?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          audio_duration_seconds: number | null
          audio_language: string | null
          audio_url: string | null
          created_at: string
          explain_back_score: number | null
          file_name: string
          file_size: number | null
          file_url: string | null
          id: string
          last_studied_at: string | null
          page_count: number | null
          status: string | null
          study_prompts: Json | null
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_duration_seconds?: number | null
          audio_language?: string | null
          audio_url?: string | null
          created_at?: string
          explain_back_score?: number | null
          file_name: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          last_studied_at?: string | null
          page_count?: number | null
          status?: string | null
          study_prompts?: Json | null
          summary?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_duration_seconds?: number | null
          audio_language?: string | null
          audio_url?: string | null
          created_at?: string
          explain_back_score?: number | null
          file_name?: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          last_studied_at?: string | null
          page_count?: number | null
          status?: string | null
          study_prompts?: Json | null
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      micro_lesson_progress: {
        Row: {
          ai_explanation: string | null
          audio_url: string | null
          completed_at: string | null
          concept_index: number
          created_at: string
          document_id: string
          id: string
          score: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_explanation?: string | null
          audio_url?: string | null
          completed_at?: string | null
          concept_index?: number
          created_at?: string
          document_id: string
          id?: string
          score?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_explanation?: string | null
          audio_url?: string | null
          completed_at?: string | null
          concept_index?: number
          created_at?: string
          document_id?: string
          id?: string
          score?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "micro_lesson_progress_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string
          currency: string | null
          flutterwave_tx_id: string | null
          flutterwave_tx_ref: string | null
          id: string
          plan: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_cycle: string
          created_at?: string
          currency?: string | null
          flutterwave_tx_id?: string | null
          flutterwave_tx_ref?: string | null
          id?: string
          plan: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          currency?: string | null
          flutterwave_tx_id?: string | null
          flutterwave_tx_ref?: string | null
          id?: string
          plan?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          campus_email: string | null
          campus_verified: boolean | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          leaderboard_opt_in: boolean | null
          referral_code: string | null
          referral_credits: number | null
          referred_by: string | null
          subscription_plan: string | null
          subscription_status: string | null
          university: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          campus_email?: string | null
          campus_verified?: boolean | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          leaderboard_opt_in?: boolean | null
          referral_code?: string | null
          referral_credits?: number | null
          referred_by?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          university?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          campus_email?: string | null
          campus_verified?: boolean | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          leaderboard_opt_in?: boolean | null
          referral_code?: string | null
          referral_credits?: number | null
          referred_by?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          university?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_scores: {
        Row: {
          completed_at: string
          created_at: string
          document_id: string | null
          id: string
          quiz_type: string | null
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          document_id?: string | null
          id?: string
          quiz_type?: string | null
          score: number
          total_questions: number
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          document_id?: string | null
          id?: string
          quiz_type?: string | null
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_scores_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          credits_awarded: number | null
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          credits_awarded?: number | null
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          credits_awarded?: number | null
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      spaced_repetition: {
        Row: {
          concept_index: number
          concept_title: string
          created_at: string
          document_id: string
          easiness_factor: number
          id: string
          interval_days: number
          last_review_date: string | null
          last_score: number | null
          next_review_date: string
          repetitions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          concept_index?: number
          concept_title: string
          created_at?: string
          document_id: string
          easiness_factor?: number
          id?: string
          interval_days?: number
          last_review_date?: string | null
          last_score?: number | null
          next_review_date?: string
          repetitions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          concept_index?: number
          concept_title?: string
          created_at?: string
          document_id?: string
          easiness_factor?: number
          id?: string
          interval_days?: number
          last_review_date?: string | null
          last_score?: number | null
          next_review_date?: string
          repetitions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaced_repetition_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      study_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "study_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      study_groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          invite_code: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          invite_code?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      usage_tracking: {
        Row: {
          action_type: string
          audio_minutes_used: number | null
          created_at: string
          id: string
          metadata: Json | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          action_type: string
          audio_minutes_used?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          action_type?: string
          audio_minutes_used?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard_badges: {
        Row: {
          badge_type: string | null
          full_name: string | null
          score: number | null
          university: string | null
          user_id: string | null
        }
        Relationships: []
      }
      leaderboard_quiz_scores: {
        Row: {
          completed_at: string | null
          full_name: string | null
          quiz_type: string | null
          score: number | null
          total_questions: number | null
          university: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
