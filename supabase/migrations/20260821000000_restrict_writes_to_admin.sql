-- ============================================================
-- CC Sacramento — Restrict all writes (insert) to admin only
-- Subadmins become fully read-only: they could previously insert
-- (register) pagos/egresos/caja_chica/locales/documentos, but not
-- update or delete. Now insert is admin-only too, matching the
-- existing update/delete policies on each of these tables.
-- ============================================================

-- locales
drop policy if exists "locales_insert_authenticated" on public.locales;
create policy "locales_insert_admin"
  on public.locales for insert
  to authenticated
  with check (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

-- pagos
drop policy if exists "pagos_insert_authenticated" on public.pagos;
create policy "pagos_insert_admin"
  on public.pagos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

-- egresos
drop policy if exists "egresos_insert_authenticated" on public.egresos;
create policy "egresos_insert_admin"
  on public.egresos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

-- caja_chica
drop policy if exists "caja_chica_insert_authenticated" on public.caja_chica;
create policy "caja_chica_insert_admin"
  on public.caja_chica for insert
  to authenticated
  with check (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

-- documentos
drop policy if exists "documentos_insert_authenticated" on public.documentos;
create policy "documentos_insert_admin"
  on public.documentos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

-- storage: local photos
drop policy if exists "locales_images_authenticated_write" on storage.objects;
create policy "locales_images_admin_write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'locales'
    and exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

-- storage: local documents (contrato/rif/otro)
drop policy if exists "documentos_files_authenticated_write" on storage.objects;
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
