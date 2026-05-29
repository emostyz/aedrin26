// Hand-written types matching 001–005 migrations.
// Replace with generated types once you run: npx supabase gen types typescript

export type AccountState = 'active' | 'memorializing' | 'legacy_active'
export type Domain = 'childhood' | 'family' | 'career' | 'values' | 'beliefs' | 'lessons' | 'messages' | 'other'
export type SharingStatus = 'private' | 'shareable'
export type EntrySource = 'typed' | 'voice' | 'uploaded'
export type RelationshipStatus = 'single' | 'partnered' | 'married' | 'separated' | 'widowed' | 'other'
export type HorizonItemType = 'event' | 'decision' | 'concern' | 'goal'

// ── Legacy access / representative verification ──────────────────────────────
export type HeirAccessStatus = 'pending' | 'active' | 'revoked'
export type MemorializationStatus =
  | 'pending' | 'docs_submitted' | 'grace_period' | 'under_review'
  | 'approved' | 'rejected' | 'cancelled'
export type ClaimedRole = 'heir' | 'executor' | 'legal_representative' | 'next_of_kin' | 'other'
export type AccessRequestStatus =
  | 'submitted' | 'docs_submitted' | 'pending_review'
  | 'approved' | 'rejected' | 'cancelled' | 'expired'
export type RiskLevel = 'low' | 'elevated' | 'high'
export type RepDocumentType = 'government_id' | 'relationship_proof' | 'other'

// ── Gift invitations ─────────────────────────────────────────────────────────
export type GiftRelationship =
  | 'parent' | 'grandparent' | 'partner' | 'sibling' | 'child' | 'friend' | 'other'
export type GiftStatus = 'sent' | 'claimed' | 'declined' | 'expired'

// ── Negotiation ──────────────────────────────────────────────────────────────
export type NegotiationStatus = 'open' | 'resolved' | 'closed' | 'archived'
export type ParticipantRole = 'initiator' | 'participant' | 'observer'
export type ConsentStatus = 'invited' | 'joined' | 'declined' | 'removed'
export type MessageAuthorType = 'participant' | 'mediator' | 'system'
export type ProposalStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded'
export type ProposalResponse = 'accept' | 'reject' | 'abstain'

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

export interface CustomQuestion {
  id: string
  user_id: string
  domain: Domain
  text: string
  ord: number
  created_at: string
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
          setup_complete: boolean
          reminders_enabled: boolean
          last_reminded_on: string | null
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
          setup_complete?: boolean
          reminders_enabled?: boolean
          last_reminded_on?: string | null
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
      custom_questions: {
        Row: {
          id: string
          user_id: string
          domain: Domain
          text: string
          ord: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          domain: Domain
          text: string
          ord?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['custom_questions']['Insert']>
      }
      heirs: {
        Row: {
          id: string
          user_id: string
          name: string
          relationship: string
          email: string
          access_status: HeirAccessStatus
          verified_at: string | null
          verification_request_id: string | null
          access_expires_at: string | null
          can_negotiate: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          relationship: string
          email: string
          access_status?: HeirAccessStatus
          verified_at?: string | null
          verification_request_id?: string | null
          access_expires_at?: string | null
          can_negotiate?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['heirs']['Insert']>
      }
      heir_permissions: {
        Row: {
          id: string
          heir_id: string
          domain: Domain
          allowed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          heir_id: string
          domain: Domain
          allowed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['heir_permissions']['Insert']>
      }
      executors: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['executors']['Insert']>
      }
      memorialization_requests: {
        Row: {
          id: string
          user_id: string
          initiated_by_executor_email: string
          status: MemorializationStatus
          grace_period_ends_at: string | null
          decided_by: string | null
          decided_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          initiated_by_executor_email: string
          status?: MemorializationStatus
          grace_period_ends_at?: string | null
          decided_by?: string | null
          decided_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['memorialization_requests']['Insert']>
      }
      verification_documents: {
        Row: {
          id: string
          request_id: string
          document_url: string
          type: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          request_id: string
          document_url: string
          type: string
          uploaded_at?: string
        }
        Update: Partial<Database['public']['Tables']['verification_documents']['Insert']>
      }
      legacy_access_log: {
        Row: {
          id: string
          deceased_user_id: string
          heir_id: string
          entry_ids_accessed: string[]
          interaction_summary: string | null
          accessed_at: string
        }
        Insert: {
          id?: string
          deceased_user_id: string
          heir_id: string
          entry_ids_accessed?: string[]
          interaction_summary?: string | null
          accessed_at?: string
        }
        Update: Partial<Database['public']['Tables']['legacy_access_log']['Insert']>
      }
      access_requests: {
        Row: {
          id: string
          deceased_user_id: string
          requester_user_id: string
          requester_email: string
          claimed_role: ClaimedRole
          relationship: string
          message: string | null
          status: AccessRequestStatus
          attestation_accepted_at: string | null
          risk_level: RiskLevel | null
          risk_reasons: string | null
          auto_approved: boolean
          decided_by: string | null
          decided_at: string | null
          review_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          deceased_user_id: string
          requester_user_id: string
          requester_email: string
          claimed_role: ClaimedRole
          relationship: string
          message?: string | null
          status?: AccessRequestStatus
          attestation_accepted_at?: string | null
          risk_level?: RiskLevel | null
          risk_reasons?: string | null
          auto_approved?: boolean
          decided_by?: string | null
          decided_at?: string | null
          review_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['access_requests']['Insert']>
      }
      access_request_documents: {
        Row: {
          id: string
          request_id: string
          document_url: string
          type: RepDocumentType
          uploaded_at: string
        }
        Insert: {
          id?: string
          request_id: string
          document_url: string
          type: RepDocumentType
          uploaded_at?: string
        }
        Update: Partial<Database['public']['Tables']['access_request_documents']['Insert']>
      }
      negotiations: {
        Row: {
          id: string
          deceased_user_id: string
          title: string
          description: string | null
          status: NegotiationStatus
          created_by_user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          deceased_user_id: string
          title: string
          description?: string | null
          status?: NegotiationStatus
          created_by_user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['negotiations']['Insert']>
      }
      negotiation_participants: {
        Row: {
          id: string
          negotiation_id: string
          participant_user_id: string | null
          heir_id: string | null
          display_name: string
          relationship_to_deceased: string
          relationship_context: string | null
          non_negotiables: string[]
          role: ParticipantRole
          consent_status: ConsentStatus
          joined_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          negotiation_id: string
          participant_user_id?: string | null
          heir_id?: string | null
          display_name: string
          relationship_to_deceased: string
          relationship_context?: string | null
          non_negotiables?: string[]
          role?: ParticipantRole
          consent_status?: ConsentStatus
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['negotiation_participants']['Insert']>
      }
      negotiation_messages: {
        Row: {
          id: string
          negotiation_id: string
          author_type: MessageAuthorType
          author_participant_id: string | null
          content: string
          cited_entry_ids: string[]
          created_at: string
        }
        Insert: {
          id?: string
          negotiation_id: string
          author_type: MessageAuthorType
          author_participant_id?: string | null
          content: string
          cited_entry_ids?: string[]
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['negotiation_messages']['Insert']>
      }
      negotiation_proposals: {
        Row: {
          id: string
          negotiation_id: string
          proposed_by_participant_id: string | null
          content: string
          status: ProposalStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          negotiation_id: string
          proposed_by_participant_id?: string | null
          content: string
          status?: ProposalStatus
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['negotiation_proposals']['Insert']>
      }
      negotiation_proposal_responses: {
        Row: {
          id: string
          proposal_id: string
          participant_id: string
          response: ProposalResponse
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          proposal_id: string
          participant_id: string
          response: ProposalResponse
          comment?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['negotiation_proposal_responses']['Insert']>
      }
      negotiation_access_log: {
        Row: {
          id: string
          negotiation_id: string
          deceased_user_id: string
          actor_user_id: string
          action: string
          detail: string | null
          created_at: string
        }
        Insert: {
          id?: string
          negotiation_id: string
          deceased_user_id: string
          actor_user_id: string
          action: string
          detail?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['negotiation_access_log']['Insert']>
      }
      gift_invitations: {
        Row: {
          id: string
          sender_user_id: string
          recipient_name: string
          recipient_email: string
          relationship: GiftRelationship
          sender_note: string | null
          claim_token: string
          status: GiftStatus
          claimed_by_user_id: string | null
          claimed_at: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          sender_user_id: string
          recipient_name: string
          recipient_email: string
          relationship: GiftRelationship
          sender_note?: string | null
          claim_token?: string
          status?: GiftStatus
          claimed_by_user_id?: string | null
          claimed_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['gift_invitations']['Insert']>
      }
    }
  }
}
