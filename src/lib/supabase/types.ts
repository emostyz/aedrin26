// Hand-written types matching 001_phase1.sql.
// Replace with generated types once you run: npx supabase gen types typescript

export type AccountState = 'active' | 'memorializing' | 'legacy_active'
export type Domain = 'childhood' | 'family' | 'career' | 'values' | 'beliefs' | 'lessons' | 'messages' | 'other'
export type SharingStatus = 'private' | 'shareable'
export type EntrySource = 'typed' | 'voice' | 'uploaded'

export interface Database {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          legal_name: string
          display_name: string | null
          dob: string | null
          photo_url: string | null
          account_state: AccountState
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          legal_name: string
          display_name?: string | null
          dob?: string | null
          photo_url?: string | null
          account_state?: AccountState
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      interview_prompts: {
        Row: {
          id: string
          domain: Domain
          text: string
          version: number
          ord: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: never
      }
      soul_entries: {
        Row: {
          id: string
          user_id: string
          domain: Domain
          prompt_id: string | null
          content: string
          media_url: string | null
          sharing_status: SharingStatus
          bound_recipient_id: string | null
          source: EntrySource
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          domain: Domain
          prompt_id?: string | null
          content: string
          media_url?: string | null
          sharing_status?: SharingStatus
          bound_recipient_id?: string | null
          source?: EntrySource
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['soul_entries']['Insert']>
      }
      value_summaries: {
        Row: {
          id: string
          user_id: string
          content: string
          approved_by_user: boolean
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content: string
          approved_by_user?: boolean
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['value_summaries']['Insert']>
      }
      life_events: {
        Row: {
          id: string
          user_id: string
          title: string
          event_date: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          event_date?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['life_events']['Insert']>
      }
    }
  }
}
