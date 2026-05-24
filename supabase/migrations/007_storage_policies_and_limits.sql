-- 007: Storage policies for artifacts bucket + artifacts bucket creation

-- Ensure artifacts bucket exists (private, 50 MB limit, broad but safe types)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artifacts',
  'artifacts',
  false,   -- PRIVATE: never publicly accessible without auth
  52428800, -- 50 MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm',
    'video/mp4', 'video/webm',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit    = EXCLUDED.file_size_limit;

-- Users can upload artifacts only under their own user_id/ prefix
CREATE POLICY "artifacts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'artifacts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own artifacts only
CREATE POLICY "artifacts_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'artifacts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own artifacts
CREATE POLICY "artifacts_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'artifacts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
