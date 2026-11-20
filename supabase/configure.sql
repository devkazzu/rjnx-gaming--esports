-- Apply once after Drizzle migrations on a hosted Supabase project.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rjnx-media','rjnx-media',false,3145728,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

-- The Supabase service role used by the Next server bypasses this RLS policy.
-- A restrictive policy keeps RJNX private even when the project already has broader grants.
DROP POLICY IF EXISTS rjnx_no_direct_media ON storage.objects;
CREATE POLICY rjnx_no_direct_media ON storage.objects AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'rjnx-media') WITH CHECK (bucket_id <> 'rjnx-media');

-- Do not expose the rjnx schema in Supabase's Data API. Server routes control reads and writes.
-- To enable private inbox invalidations, apply supabase/realtime.sql separately.
