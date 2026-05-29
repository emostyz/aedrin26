-- 019_gift_invitations.sql
--
-- Gift invitations let someone (the "sender", typically an adult child)
-- invite a loved one (the "recipient", typically a parent) to AEDRIN.
-- The recipient receives a personal email with a unique claim token. They
-- click through, see who invited them and why, and sign up with one button.
-- On successful sign-up, the invitation is claimed and the two accounts
-- become linked so the sender can later receive digests of what the
-- recipient has captured.
--
-- This migration is purely additive. No existing tables or rows are touched.

CREATE TABLE IF NOT EXISTS public.gift_invitations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who sent the gift. We cascade-delete invitations if the sender deletes
  -- their account — there's no recipient experience without a sender.
  sender_user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Who it's for. Name + email are captured at send-time; email is what
  -- we use to match the recipient's eventual sign-up account.
  recipient_name      TEXT NOT NULL,
  recipient_email     TEXT NOT NULL,
  -- "parent" | "grandparent" | "partner" | "friend" | "sibling" | "other"
  relationship        TEXT NOT NULL,

  -- Optional personal note shown on the recipient's claim page.
  sender_note         TEXT,

  -- Magic-link token, URL-safe via the default UUID stringification.
  claim_token         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

  -- Lifecycle: sent → claimed | declined | expired
  status              TEXT NOT NULL DEFAULT 'sent'
                      CHECK (status IN ('sent', 'claimed', 'declined', 'expired')),

  -- Set when the recipient signs up. Lets us join the two accounts later
  -- (digest generation, "your gift recipients" list on sender's dashboard).
  claimed_by_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  claimed_at          TIMESTAMPTZ,

  -- Hard expiry — invitations that aren't claimed within 90 days fall off.
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for "show me my outgoing invitations" on the sender's dashboard.
CREATE INDEX IF NOT EXISTS idx_gift_invitations_sender
  ON public.gift_invitations(sender_user_id);

-- Index for the recipient claim lookup (by token in the email link).
-- The token is already UNIQUE which creates an implicit index; this one
-- is for the recipient_email match used during sign-up auto-claim.
CREATE INDEX IF NOT EXISTS idx_gift_invitations_recipient_email
  ON public.gift_invitations(LOWER(recipient_email));

-- Optional partial index to quickly find pending (still-claimable) invites.
CREATE INDEX IF NOT EXISTS idx_gift_invitations_pending
  ON public.gift_invitations(recipient_email, status)
  WHERE status = 'sent';

-- ─────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────
-- The sender can read, create, and update their own invitations.
-- The recipient claim page uses the SERVICE client (bypasses RLS) keyed off
-- the unguessable token in the URL — so no public-read policy is needed.
ALTER TABLE public.gift_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gift_invitations_sender_select"
  ON public.gift_invitations
  FOR SELECT
  USING (auth.uid() = sender_user_id);

CREATE POLICY "gift_invitations_sender_insert"
  ON public.gift_invitations
  FOR INSERT
  WITH CHECK (auth.uid() = sender_user_id);

CREATE POLICY "gift_invitations_sender_update"
  ON public.gift_invitations
  FOR UPDATE
  USING (auth.uid() = sender_user_id)
  WITH CHECK (auth.uid() = sender_user_id);

-- Once claimed, the recipient can read their own claimed invitation too —
-- useful for showing "you were invited by X" on their first dashboard load.
CREATE POLICY "gift_invitations_claimed_recipient_select"
  ON public.gift_invitations
  FOR SELECT
  USING (auth.uid() = claimed_by_user_id);
