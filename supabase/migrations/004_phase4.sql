-- Phase 4: Channel readiness — designed-for, not built.
-- These tables exist so later estate/hospice referral integrations
-- can be added without schema rework.

-- Channel partners: estate attorneys, hospices, funeral homes
CREATE TABLE public.channel_partners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  type          text NOT NULL CHECK (type IN ('estate_attorney', 'hospice', 'funeral_home', 'other')),
  contact_email text,
  website_url   text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_partners ENABLE ROW LEVEL SECURITY;
-- No user-facing RLS — only service role may read/write this table.

CREATE TRIGGER trg_channel_partners_updated_at
  BEFORE UPDATE ON public.channel_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Referral tracking on user accounts
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_source      text,
  ADD COLUMN IF NOT EXISTS channel_partner_id   uuid REFERENCES public.channel_partners(id) ON DELETE SET NULL;

-- Avatars storage bucket (public, images only, 5 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS for avatars bucket: users can upload to their own path only
CREATE POLICY "avatar_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatar_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatar_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
