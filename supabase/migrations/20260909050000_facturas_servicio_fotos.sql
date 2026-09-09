-- ============================================================
-- CC Sacramento — Several photos per service bill
--
-- `facturas_servicio` shipped with a single documento_ruta/nombre pair, but a
-- month's bill arrives as several pages or photos (the Corpoelec sheets come
-- in two parts), so the attachment becomes its own table.
--
-- Files live in the existing private `documentos` bucket under a
-- `facturas/<factura_id>/` prefix — same arrangement as pago comprobantes.
-- The bucket's storage policies are bucket-wide, so nothing new is needed
-- there.
-- ============================================================

create table if not exists public.facturas_servicio_fotos (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas_servicio (id) on delete cascade,
  ruta text not null,
  nombre_archivo text not null,
  created_at timestamptz not null default now()
);

create index if not exists facturas_servicio_fotos_factura_id_idx
  on public.facturas_servicio_fotos (factura_id);

-- Superseded by the table above.
alter table public.facturas_servicio
  drop column if exists documento_ruta,
  drop column if exists documento_nombre;

-- Only the three shared services are billed this way; canon is charged
-- straight to each local and never arrives as a bill to split.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'facturas_servicio_concepto_es_servicio'
  ) then
    alter table public.facturas_servicio
      add constraint facturas_servicio_concepto_es_servicio
      check (concepto <> 'canon');
  end if;
end $$;

alter table public.facturas_servicio_fotos enable row level security;

drop policy if exists "facturas_servicio_fotos_select_authenticated"
  on public.facturas_servicio_fotos;
create policy "facturas_servicio_fotos_select_authenticated"
  on public.facturas_servicio_fotos for select to authenticated using (true);

drop policy if exists "facturas_servicio_fotos_insert_admin" on public.facturas_servicio_fotos;
create policy "facturas_servicio_fotos_insert_admin"
  on public.facturas_servicio_fotos for insert to authenticated
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

drop policy if exists "facturas_servicio_fotos_delete_admin" on public.facturas_servicio_fotos;
create policy "facturas_servicio_fotos_delete_admin"
  on public.facturas_servicio_fotos for delete to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));
