insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 104857600,
        array['video/webm','video/mp4','video/quicktime','video/ogg','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Allow any authenticated user to upload their own files
create policy "videos_storage_insert_own"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'videos');

-- Public read so posters/videos can be displayed
create policy "videos_storage_read_public"
  on storage.objects for select
  to public
  using (bucket_id = 'videos');

-- Owners can update their own files
create policy "videos_storage_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'videos' and owner = auth.uid())
  with check (bucket_id = 'videos' and owner = auth.uid());

-- Owners can delete their own files
create policy "videos_storage_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'videos' and owner = auth.uid());
