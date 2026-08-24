-- ============================================================
-- CC Sacramento — Clean reset of documentos storage policies
-- The previous repair (20260824020000) recreated the two intended
-- policies by name, but uploads still fail with "new row violates
-- row-level security policy" for pagos comprobante uploads even
-- though the account is confirmed admin at the DB level. Likely
-- cause: the bucket was recreated via the dashboard UI at some
-- point, which can silently attach its own default policy (e.g. a
-- "users can only write to a folder named after their own uid"
-- template) alongside ours — a RESTRICTIVE-looking extra condition
-- that rejects our pagos/{id}/... paths regardless of role.
-- This drops every policy on storage.objects that mentions the
-- documentos bucket, whatever it's named, then recreates exactly
-- the two we want. Idempotent — safe to run any number of times.
-- ============================================================

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') ilike '%documentos%' or coalesce(with_check, '') ilike '%documentos%')
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy "documentos_files_authenticated_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documentos');

create policy "documentos_files_admin_write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documentos'
    and exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );
