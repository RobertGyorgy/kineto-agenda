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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          absence_reason: string | null
          created_at: string
          date: string
          end_time: string
          id: string
          patient_id: string | null
          session_number: number | null
          start_time: string
          status: string | null
          total_sessions: number | null
        }
        Insert: {
          absence_reason?: string | null
          created_at?: string
          date: string
          end_time: string
          id?: string
          patient_id?: string | null
          session_number?: number | null
          start_time: string
          status?: string | null
          total_sessions?: number | null
        }
        Update: {
          absence_reason?: string | null
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          patient_id?: string | null
          session_number?: number | null
          start_time?: string
          status?: string | null
          total_sessions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          app_version: string | null
          created_at: string
          details: string | null
          id: string
          interpretation: string
          message: string
          source: string
          stack: string | null
          type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          details?: string | null
          id?: string
          interpretation: string
          message: string
          source?: string
          stack?: string | null
          type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          details?: string | null
          id?: string
          interpretation?: string
          message?: string
          source?: string
          stack?: string | null
          type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      istoric_saptamanal: {
        Row: {
          absente: number
          anulate: number
          created_at: string
          finalizate: number
          id: string
          procent_prezenta: number | null
          program_activ: Json | null
          saptamana_end: string
          saptamana_start: string
          total_programari: number
          user_id: string | null
          venit_total: number | null
        }
        Insert: {
          absente?: number
          anulate?: number
          created_at?: string
          finalizate?: number
          id?: string
          procent_prezenta?: number | null
          program_activ?: Json | null
          saptamana_end: string
          saptamana_start: string
          total_programari?: number
          user_id?: string | null
          venit_total?: number | null
        }
        Update: {
          absente?: number
          anulate?: number
          created_at?: string
          finalizate?: number
          id?: string
          procent_prezenta?: number | null
          program_activ?: Json | null
          saptamana_end?: string
          saptamana_start?: string
          total_programari?: number
          user_id?: string | null
          venit_total?: number | null
        }
        Relationships: []
      }
      notificari: {
        Row: {
          citita: boolean
          created_at: string
          data_declansare: string
          id: string
          mesaj: string | null
          pacient_id: string | null
          tip: string
          titlu: string
          user_id: string | null
        }
        Insert: {
          citita?: boolean
          created_at?: string
          data_declansare?: string
          id?: string
          mesaj?: string | null
          pacient_id?: string | null
          tip?: string
          titlu: string
          user_id?: string | null
        }
        Update: {
          citita?: boolean
          created_at?: string
          data_declansare?: string
          id?: string
          mesaj?: string | null
          pacient_id?: string | null
          tip?: string
          titlu?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificari_pacient_id_fkey"
            columns: ["pacient_id"]
            isOneToOne: false
            referencedRelation: "pacienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificari_pacient_id_fkey"
            columns: ["pacient_id"]
            isOneToOne: false
            referencedRelation: "pacienti_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pacienti: {
        Row: {
          achitat: boolean
          cost: number
          created_at: string
          drive_link: string | null
          frecventa: string
          id: string
          locatie: string
          notite: string | null
          nume: string
          plan: string
          prenume: string
          sedinte_folosite: number
          sedinte_ramase: number | null
          sedinte_total: number
          status_abonament: string
          telefon: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          achitat?: boolean
          cost?: number
          created_at?: string
          drive_link?: string | null
          frecventa?: string
          id?: string
          locatie?: string
          notite?: string | null
          nume: string
          plan?: string
          prenume: string
          sedinte_folosite?: number
          sedinte_ramase?: number | null
          sedinte_total?: number
          status_abonament?: string
          telefon: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          achitat?: boolean
          cost?: number
          created_at?: string
          drive_link?: string | null
          frecventa?: string
          id?: string
          locatie?: string
          notite?: string | null
          nume?: string
          plan?: string
          prenume?: string
          sedinte_folosite?: number
          sedinte_ramase?: number | null
          sedinte_total?: number
          status_abonament?: string
          telefon?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      packages: {
        Row: {
          completed_sessions: number | null
          created_at: string
          id: string
          is_paid: boolean | null
          patient_id: string | null
          price: number | null
          reminder_threshold: number | null
          start_date: string | null
          total_sessions: number | null
        }
        Insert: {
          completed_sessions?: number | null
          created_at?: string
          id?: string
          is_paid?: boolean | null
          patient_id?: string | null
          price?: number | null
          reminder_threshold?: number | null
          start_date?: string | null
          total_sessions?: number | null
        }
        Update: {
          completed_sessions?: number | null
          created_at?: string
          id?: string
          is_paid?: boolean | null
          patient_id?: string | null
          price?: number | null
          reminder_threshold?: number | null
          start_date?: string | null
          total_sessions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "packages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          category: string | null
          created_at: string
          drive_url: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          drive_url?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone: string
        }
        Update: {
          category?: string | null
          created_at?: string
          drive_url?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone: string
        }
        Relationships: []
      }
      plati: {
        Row: {
          created_at: string
          data_platii: string
          id: string
          metoda: string | null
          pacient_id: string
          suma: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data_platii?: string
          id?: string
          metoda?: string | null
          pacient_id: string
          suma: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data_platii?: string
          id?: string
          metoda?: string | null
          pacient_id?: string
          suma?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plati_pacient_id_fkey"
            columns: ["pacient_id"]
            isOneToOne: false
            referencedRelation: "pacienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plati_pacient_id_fkey"
            columns: ["pacient_id"]
            isOneToOne: false
            referencedRelation: "pacienti_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_packages: {
        Row: {
          created_at: string
          id: string
          nume: string
          pret: number
          tip: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nume: string
          pret: number
          tip: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nume?: string
          pret?: number
          tip?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          telefon: string | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          telefon?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          telefon?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      programari: {
        Row: {
          created_at: string
          data: string
          group_id: string | null
          id: string
          locatie: string
          motiv: string | null
          note: string | null
          ora: string
          pacient_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data: string
          group_id?: string | null
          id?: string
          locatie?: string
          motiv?: string | null
          note?: string | null
          ora: string
          pacient_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          group_id?: string | null
          id?: string
          locatie?: string
          motiv?: string | null
          note?: string | null
          ora?: string
          pacient_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programari_pacient_id_fkey"
            columns: ["pacient_id"]
            isOneToOne: false
            referencedRelation: "pacienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programari_pacient_id_fkey"
            columns: ["pacient_id"]
            isOneToOne: false
            referencedRelation: "pacienti_view"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          active_categories: string[] | null
          break_buffer: number | null
          categories: string[] | null
          default_price: number | null
          default_total_sessions: number | null
          id: string
          lunch_breaks: Json | null
          lunch_end: string | null
          lunch_start: string | null
          reminder_threshold: number | null
          session_duration: number | null
          therapist_name: string | null
          updated_at: string
          user_id: string | null
          whatsapp_template: string | null
          work_end: string | null
          work_start: string | null
          zile_lucratoare: number[] | null
        }
        Insert: {
          active_categories?: string[] | null
          break_buffer?: number | null
          categories?: string[] | null
          default_price?: number | null
          default_total_sessions?: number | null
          id?: string
          lunch_breaks?: Json | null
          lunch_end?: string | null
          lunch_start?: string | null
          reminder_threshold?: number | null
          session_duration?: number | null
          therapist_name?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_template?: string | null
          work_end?: string | null
          work_start?: string | null
          zile_lucratoare?: number[] | null
        }
        Update: {
          active_categories?: string[] | null
          break_buffer?: number | null
          categories?: string[] | null
          default_price?: number | null
          default_total_sessions?: number | null
          id?: string
          lunch_breaks?: Json | null
          lunch_end?: string | null
          lunch_start?: string | null
          reminder_threshold?: number | null
          session_duration?: number | null
          therapist_name?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_template?: string | null
          work_end?: string | null
          work_start?: string | null
          zile_lucratoare?: number[] | null
        }
        Relationships: []
      }
    }
    Views: {
      pacienti_view: {
        Row: {
          achitat: boolean | null
          cost: number | null
          created_at: string | null
          drive_link: string | null
          frecventa: string | null
          id: string | null
          locatie: string | null
          name: string | null
          notite: string | null
          numar_programari: number | null
          nume: string | null
          plan: string | null
          prenume: string | null
          sedinte_folosite: number | null
          sedinte_ramase: number | null
          sedinte_total: number | null
          status_abonament: string | null
          suma_incasata: number | null
          telefon: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      arhiveaza_saptamana: {
        Args: { saptamana_start?: string }
        Returns: undefined
      }
      genereaza_notificari_zilnice: { Args: never; Returns: undefined }
      get_vapid_secrets: { Args: never; Returns: Json }
      run_check_reminders_cron: { Args: never; Returns: undefined }
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

// ── Shorthand helper types ──────────────────────────────────────
export type Profile          = Database['public']['Tables']['profiles']['Row'];
export type Settings         = Database['public']['Tables']['settings']['Row'];
export type Pacient          = Database['public']['Tables']['pacienti']['Row'];
export type PacientInsert    = Database['public']['Tables']['pacienti']['Insert'];
export type PacientUpdate    = Database['public']['Tables']['pacienti']['Update'];
export type Programare       = Database['public']['Tables']['programari']['Row'];
export type ProgramareInsert = Database['public']['Tables']['programari']['Insert'];
export type Notificare       = Database['public']['Tables']['notificari']['Row'];
export type IstoricSaptamanal = Database['public']['Tables']['istoric_saptamanal']['Row'];
export type PacientView      = Database['public']['Views']['pacienti_view']['Row'];
export type Plata            = Database['public']['Tables']['plati']['Row'];
export type PlataInsert      = Database['public']['Tables']['plati']['Insert'];
export type ErrorLog         = Database['public']['Tables']['error_logs']['Row'];
export type ErrorLogInsert   = Database['public']['Tables']['error_logs']['Insert'];
export type PricingPackage   = Database['public']['Tables']['pricing_packages']['Row'];
export type PricingPackageInsert = Database['public']['Tables']['pricing_packages']['Insert'];

