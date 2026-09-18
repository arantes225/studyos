-- Rode este SQL no Supabase apenas se o bucket "studyos" ainda não existir.

insert into storage.buckets (id, name, public)
values ('studyos', 'studyos', false)
on conflict (id) do nothing;

drop policy if exists "studyos_select_own" on storage.objects;
create policy "studyos_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'studyos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "studyos_insert_own" on storage.objects;
create policy "studyos_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'studyos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "studyos_update_own" on storage.objects;
create policy "studyos_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'studyos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'studyos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "studyos_delete_own" on storage.objects;
create policy "studyos_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'studyos'
  and (storage.foldername(name))[1] = auth.uid()::text
);