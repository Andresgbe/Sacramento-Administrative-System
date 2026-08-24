-- ============================================================
-- CC Sacramento — Repair documentos storage RLS policies
-- The "documentos" bucket had to be recreated (see
-- 20260824010000_recreate_documentos_bucket.sql) after being
-- deleted outside of migrations. If that dashboard action also
-- dropped its storage.objects policies, uploads (including the new
-- pagos "comprobante" receipts) fail with "new row violates row-
-- level security policy". Idempotent: safe to run regardless of
-- whether the policies were actually lost.
-- ============================================================

drop policy if exists "documentos_files_authenticated_read" on storage.objects;
create policy "documentos_files_authenticated_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documentos');

drop policy if exists "documentos_files_authenticated_write" on storage.objects;
drop policy if exists "documentos_files_admin_write" on storage.objects;
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
