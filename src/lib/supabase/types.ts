// Hand-written types matching 001–005 migrations.
// Replace with generated types once you run: npx supabase gen types typescript

export type AccountState = 'active' | 'memorializing' | 'legacy_active'
export type Domain = 'childhood' | 'family' | 'career' | 'values' | 'beliefs' | 'lessons' | 'messages' | 'other'
export type SharingStatus = 'private' | 'shareable'
export type EntrySource = 'typed' | 'voice' | 'uploaded'
export type RelationshipStatus = 'single' | 'partnered' | 'married' | 'separated' | 'widowed' | 'other'
export type HorizonItemType = 'event' | 'decision' | 'concern' | 'goal'

export interface HorizonItem {
  id: string
  user_id: string
  type: HorizonItemType
  title: string
  description: string | null
  due_date: string | null   // ISO date string YYYY-MM-DD
  resolved: boolean
  created_at: string
  updated_at: string
}

export interface HorizonConnection {
  insight: string
  source_domain: string
  relevance: string
}

export interface FollowUpQuestion {
  text: string
  type: 'freeform' | 'choice'
  options?: string[]   // 2–5 options, only when type === 'choice'
  placeholder?: string // hint text, only when type === 'freeform'
}

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
          relationship_status: RelationshipStatus | null
          location: string | null
          company: string | null
          job_title: string | null
          job_happiness: string | null
          career_goals: string | null
          family_description: string | null
          life_description: string | null
          biggest_regret: string | null
          life_purpose: string | null
          onboarding_complete: boolean
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
          relationship_status?: RelationshipStatus | null
          location?: string | null
          company?: string | null
          job_title?: string | null
          job_happiness?: string | null
          career_goals?: string | null
          family_description?: string | null
          life_description?: string | null
          biggest_regret?: string | null
          life_purpose?: string | null
          onboarding_complete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      daily_insights: {
        Row: {
          id: string
          user_id: string
          insight_text: string
          recommendation: string | null
          pattern_sources: string[]
          delivered_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          insight_text: string
          recommendation?: string | null
          pattern_sources?: string[]
          delivered_date: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['daily_insights']['Insert']>
      }
      daily_prompts: {
        Row: {
          id: string
          user_id: string
          prompt_text: string
          domain: Domain
          rationale: string
          delivered_date: string
          soul_entry_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          prompt_text: string
          domain: Domain
          rationale: string
          delivered_date: string
          soul_entry_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['daily_prompts']['Insert']>
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
          daily_prompt_id: string | null
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
          daily_prompt_id?: string | null
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
      channel_partners: {
        Row: {
          id: string
          name: string
          type: 'estate_attorney' | 'hospice' | 'funeral_home' | 'other'
          contact_email: string | null
          website_url: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'estate_attorney' | 'hospice' | 'funeral_home' | 'other'
          contact_email?: string | null
          website_url?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['channel_partners']['Insert']>
      }
    }
  }
}
