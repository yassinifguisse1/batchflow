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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_requests: {
        Row: {
          created_at: string | null
          id: string
          processing_time_ms: number | null
          request_body: Json | null
          request_headers: Json | null
          response_body: Json | null
          response_status: number | null
          webhook_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          processing_time_ms?: number | null
          request_body?: Json | null
          request_headers?: Json | null
          response_body?: Json | null
          response_status?: number | null
          webhook_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          processing_time_ms?: number | null
          request_body?: Json | null
          request_headers?: Json | null
          response_body?: Json | null
          response_status?: number | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_requests_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          api_keys: Json | null
          created_at: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          locked_scenario_id: string | null
          name: string
          status: string | null
          updated_at: string | null
          url_path: string
          user_id: string
          workflow_data: Json | null
        }
        Insert: {
          api_keys?: Json | null
          created_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          locked_scenario_id?: string | null
          name: string
          status?: string | null
          updated_at?: string | null
          url_path: string
          user_id: string
          workflow_data?: Json | null
        }
        Update: {
          api_keys?: Json | null
          created_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          locked_scenario_id?: string | null
          name?: string
          status?: string | null
          updated_at?: string | null
          url_path?: string
          user_id?: string
          workflow_data?: Json | null
        }
        Relationships: []
      }
      workflow_executions: {
        Row: {
          completed_at: string | null
          current_node_id: string | null
          error_message: string | null
          executed_nodes: Json | null
          id: string
          result_data: Json | null
          started_at: string | null
          status: string
          user_id: string
          webhook_request_id: string | null
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          current_node_id?: string | null
          error_message?: string | null
          executed_nodes?: Json | null
          id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: string
          user_id: string
          webhook_request_id?: string | null
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          current_node_id?: string | null
          error_message?: string | null
          executed_nodes?: Json | null
          id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string
          webhook_request_id?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_webhook_request_id_fkey"
            columns: ["webhook_request_id"]
            isOneToOne: false
            referencedRelation: "webhook_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string | null
          updated_at: string
          user_id: string
          workflow_data: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string
          user_id: string
          workflow_data?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string
          user_id?: string
          workflow_data?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_webhook_locked_to_different_scenario: {
        Args: { scenario_id: string; webhook_id: string }
        Returns: boolean
      }
      lock_webhook_to_scenario: {
        Args: { scenario_id: string; user_id: string; webhook_id: string }
        Returns: boolean
      }
      unlock_webhook: {
        Args: { user_id: string; webhook_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
