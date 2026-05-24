-- Phase 3: artifacts storage bucket for uploaded media
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artifacts',
  'artifacts',
  false,
  52428800,  -- 50 MB
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf',
    'audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/ogg'
  ]
)
on conflict (id) do nothing;
