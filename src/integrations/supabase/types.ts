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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      absence_treatments: {
        Row: {
          active: boolean
          attendance_id: string
          authorized_by: string | null
          contract_id: string
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          kind: string
          reason: string | null
          start_time: string
          support_doc: string | null
          updated_at: string
          updated_by: string | null
          work_date: string
        }
        Insert: {
          active?: boolean
          attendance_id: string
          authorized_by?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          kind: string
          reason?: string | null
          start_time: string
          support_doc?: string | null
          updated_at?: string
          updated_by?: string | null
          work_date: string
        }
        Update: {
          active?: boolean
          attendance_id?: string
          authorized_by?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          kind?: string
          reason?: string | null
          start_time?: string
          support_doc?: string | null
          updated_at?: string
          updated_by?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_treatments_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_treatments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          absent_intervals: Json
          contract_id: string
          hour_value: number | null
          id: string
          justification_doc: string | null
          justification_status: string
          notes: string | null
          review_status: string
          schedule_id: string
          status: string
          updated_at: string
          updated_by: string | null
          work_date: string
        }
        Insert: {
          absent_intervals?: Json
          contract_id: string
          hour_value?: number | null
          id?: string
          justification_doc?: string | null
          justification_status?: string
          notes?: string | null
          review_status?: string
          schedule_id: string
          status: string
          updated_at?: string
          updated_by?: string | null
          work_date: string
        }
        Update: {
          absent_intervals?: Json
          contract_id?: string
          hour_value?: number | null
          id?: string
          justification_doc?: string | null
          justification_status?: string
          notes?: string | null
          review_status?: string
          schedule_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: true
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          contract_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          reason: string | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          contract_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          contract_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      closings: {
        Row: {
          applied_discount: number | null
          closed_at: string | null
          closed_by: string | null
          contract_id: string
          coverage_cost: number | null
          created_at: string
          difference_reason: string | null
          id: string
          period_end: string
          period_start: string
          predicted_discount: number | null
          reopen_reason: string | null
          revised_discount: number | null
          seed_key: string | null
          snapshot: Json | null
          status: string
          support_doc: string | null
        }
        Insert: {
          applied_discount?: number | null
          closed_at?: string | null
          closed_by?: string | null
          contract_id: string
          coverage_cost?: number | null
          created_at?: string
          difference_reason?: string | null
          id?: string
          period_end: string
          period_start: string
          predicted_discount?: number | null
          reopen_reason?: string | null
          revised_discount?: number | null
          seed_key?: string | null
          snapshot?: Json | null
          status?: string
          support_doc?: string | null
        }
        Update: {
          applied_discount?: number | null
          closed_at?: string | null
          closed_by?: string | null
          contract_id?: string
          coverage_cost?: number | null
          created_at?: string
          difference_reason?: string | null
          id?: string
          period_end?: string
          period_start?: string
          predicted_discount?: number | null
          reopen_reason?: string | null
          revised_discount?: number | null
          seed_key?: string | null
          snapshot?: Json | null
          status?: string
          support_doc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          active: boolean
          city: string | null
          client: string
          code: string
          created_at: string
          discount_rule: string
          end_date: string | null
          id: string
          is_demo: boolean
          name: string
          operating_weekdays: number[]
          required_headcount: number
          start_date: string
          supervisor_id: string | null
          supervisor_name: string | null
        }
        Insert: {
          active?: boolean
          city?: string | null
          client: string
          code: string
          created_at?: string
          discount_rule?: string
          end_date?: string | null
          id?: string
          is_demo?: boolean
          name: string
          operating_weekdays?: number[]
          required_headcount?: number
          start_date: string
          supervisor_id?: string | null
          supervisor_name?: string | null
        }
        Update: {
          active?: boolean
          city?: string | null
          client?: string
          code?: string
          created_at?: string
          discount_rule?: string
          end_date?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          operating_weekdays?: number[]
          required_headcount?: number
          start_date?: string
          supervisor_id?: string | null
          supervisor_name?: string | null
        }
        Relationships: []
      }
      coverages: {
        Row: {
          agreed_value: number
          attendance_id: string | null
          break_end: string | null
          break_start: string | null
          contract_id: string
          coverer_type: string
          created_at: string
          created_by: string | null
          day_worker_id: string | null
          employee_id: string | null
          end_time: string
          id: string
          notes: string | null
          payment_status: string
          post_id: string
          seed_key: string | null
          start_time: string
          status: string
          supervisor_id: string | null
          work_date: string
        }
        Insert: {
          agreed_value?: number
          attendance_id?: string | null
          break_end?: string | null
          break_start?: string | null
          contract_id: string
          coverer_type: string
          created_at?: string
          created_by?: string | null
          day_worker_id?: string | null
          employee_id?: string | null
          end_time: string
          id?: string
          notes?: string | null
          payment_status?: string
          post_id: string
          seed_key?: string | null
          start_time: string
          status?: string
          supervisor_id?: string | null
          work_date: string
        }
        Update: {
          agreed_value?: number
          attendance_id?: string | null
          break_end?: string | null
          break_start?: string | null
          contract_id?: string
          coverer_type?: string
          created_at?: string
          created_by?: string | null
          day_worker_id?: string | null
          employee_id?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          payment_status?: string
          post_id?: string
          seed_key?: string | null
          start_time?: string
          status?: string
          supervisor_id?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverages_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverages_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverages_day_worker_id_fkey"
            columns: ["day_worker_id"]
            isOneToOne: false
            referencedRelation: "day_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverages_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverages_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverages_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      day_workers: {
        Row: {
          availability: string | null
          code: string
          day_rate: number
          hour_rate: number
          id: string
          is_demo: boolean
          name: string
          phone: string | null
          status: string
        }
        Insert: {
          availability?: string | null
          code: string
          day_rate?: number
          hour_rate?: number
          id?: string
          is_demo?: boolean
          name: string
          phone?: string | null
          status?: string
        }
        Update: {
          availability?: string | null
          code?: string
          day_rate?: number
          hour_rate?: number
          id?: string
          is_demo?: boolean
          name?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      divergences: {
        Row: {
          affects_calc: boolean
          contract_id: string
          created_at: string
          doc_id: string | null
          employee_id: string | null
          excluded_from_totals: boolean
          id: string
          is_demo: boolean
          kind: string
          page: number | null
          reason: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          schedule_id: string | null
          seed_key: string | null
          status: string
          work_date: string | null
        }
        Insert: {
          affects_calc?: boolean
          contract_id: string
          created_at?: string
          doc_id?: string | null
          employee_id?: string | null
          excluded_from_totals?: boolean
          id?: string
          is_demo?: boolean
          kind: string
          page?: number | null
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          schedule_id?: string | null
          seed_key?: string | null
          status?: string
          work_date?: string | null
        }
        Update: {
          affects_calc?: boolean
          contract_id?: string
          created_at?: string
          doc_id?: string | null
          employee_id?: string | null
          excluded_from_totals?: boolean
          id?: string
          is_demo?: boolean
          kind?: string
          page?: number | null
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          schedule_id?: string | null
          seed_key?: string | null
          status?: string
          work_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "divergences_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divergences_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "timesheet_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divergences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divergences_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_assignments: {
        Row: {
          contract_id: string
          employee_id: string
          end_date: string | null
          id: string
          post_id: string | null
          start_date: string
        }
        Insert: {
          contract_id: string
          employee_id: string
          end_date?: string | null
          id?: string
          post_id?: string | null
          start_date: string
        }
        Update: {
          contract_id?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          post_id?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_assignments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_assignments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          admission_date: string | null
          id: string
          is_demo: boolean
          name: string
          registration: string
          role_name: string
          status: string
        }
        Insert: {
          admission_date?: string | null
          id?: string
          is_demo?: boolean
          name: string
          registration: string
          role_name: string
          status?: string
        }
        Update: {
          admission_date?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          registration?: string
          role_name?: string
          status?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          active: boolean
          break_end: string | null
          break_start: string | null
          city: string | null
          code: string
          contract_id: string
          day_value: number
          end_time: string
          hour_value: number
          id: string
          is_demo: boolean
          required_qty: number
          role_name: string
          shift: string
          start_time: string
          valid_from: string | null
          valid_to: string | null
          workplace: string | null
        }
        Insert: {
          active?: boolean
          break_end?: string | null
          break_start?: string | null
          city?: string | null
          code: string
          contract_id: string
          day_value?: number
          end_time?: string
          hour_value?: number
          id?: string
          is_demo?: boolean
          required_qty?: number
          role_name: string
          shift?: string
          start_time?: string
          valid_from?: string | null
          valid_to?: string | null
          workplace?: string | null
        }
        Update: {
          active?: boolean
          break_end?: string | null
          break_start?: string | null
          city?: string | null
          code?: string
          contract_id?: string
          day_value?: number
          end_time?: string
          hour_value?: number
          id?: string
          is_demo?: boolean
          required_qty?: number
          role_name?: string
          shift?: string
          start_time?: string
          valid_from?: string | null
          valid_to?: string | null
          workplace?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      punches: {
        Row: {
          contract_id: string
          doc_id: string
          employee_id: string | null
          id: string
          marks: string[]
          match_confidence: string
          name: string | null
          page: number | null
          registration: string | null
          seed_key: string | null
          work_date: string | null
        }
        Insert: {
          contract_id: string
          doc_id: string
          employee_id?: string | null
          id?: string
          marks?: string[]
          match_confidence?: string
          name?: string | null
          page?: number | null
          registration?: string | null
          seed_key?: string | null
          work_date?: string | null
        }
        Update: {
          contract_id?: string
          doc_id?: string
          employee_id?: string | null
          id?: string
          marks?: string[]
          match_confidence?: string
          name?: string | null
          page?: number | null
          registration?: string | null
          seed_key?: string | null
          work_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "punches_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punches_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "timesheet_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punches_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          break_end: string | null
          break_start: string | null
          contract_id: string
          employee_id: string
          end_time: string
          id: string
          post_id: string
          start_time: string
          work_date: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          contract_id: string
          employee_id: string
          end_time: string
          id?: string
          post_id: string
          start_time: string
          work_date: string
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          contract_id?: string
          employee_id?: string
          end_time?: string
          id?: string
          post_id?: string
          start_time?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_docs: {
        Row: {
          contract_id: string
          errors: string | null
          extraction: Json | null
          file_hash: string | null
          file_name: string
          file_path: string | null
          id: string
          is_demo: boolean
          period_end: string
          period_start: string
          seed_key: string | null
          status: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          contract_id: string
          errors?: string | null
          extraction?: Json | null
          file_hash?: string | null
          file_name: string
          file_path?: string | null
          id?: string
          is_demo?: boolean
          period_end: string
          period_start: string
          seed_key?: string | null
          status?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          contract_id?: string
          errors?: string | null
          extraction?: Json | null
          file_hash?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          is_demo?: boolean
          period_end?: string
          period_start?: string
          seed_key?: string | null
          status?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_docs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_contract: { Args: { _contract: string }; Returns: boolean }
      can_write_ops: { Args: { _contract: string }; Returns: boolean }
      coverage_has_minute: {
        Args: { c: Database["public"]["Tables"]["coverages"]["Row"]; m: string }
        Returns: boolean
      }
      generate_schedules: {
        Args: { _contract: string; _from: string; _to: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_period_closed: {
        Args: { _contract: string; _d: string }
        Returns: boolean
      }
      is_staff_all: { Args: { _uid: string }; Returns: boolean }
      list_coverage_supervisors: {
        Args: never
        Returns: {
          full_name: string
          id: string
        }[]
      }
      pending_treatment_minutes: {
        Args: { cid: string; d1: string; d2: string }
        Returns: number
      }
      seed_demo: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "conferente" | "financeiro"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "supervisor", "conferente", "financeiro"],
    },
  },
} as const
