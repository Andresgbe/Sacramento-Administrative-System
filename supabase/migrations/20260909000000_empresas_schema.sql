-- ============================================================
-- CC Sacramento — Split empresas out of locales
--
-- A business can rent more than one unit in the mall (Bullpen Licor's
-- holds PB-D and PB-B/PB-C, Warlock Motor's holds PB-A and PB-E), but
-- every unit carried its own copy of the business identity, so the same
-- company was stored — and counted — several times.
--
-- Identity (nombre_comercial, rif, logo, estado, documentos) moves to
-- `empresas`; `locales` keeps only what belongs to the physical unit
-- (numero_local, piso, area_m2, monto_alquiler) plus empresa_id.
-- `pagos.local_id` is deliberately unchanged: rent is charged per unit.
-- ============================================================

create type empresa_estado as enum ('activo', 'inactivo', 'vencido');

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  rif text,
  imagen_url text,
  estado empresa_estado not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index empresas_estado_idx on public.empresas (estado);

create trigger empresas_set_updated_at
  before update on public.empresas
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Backfill: one empresa per distinct nombre_comercial.
-- Soft-deleted locales are included so their documentos and pagos keep
-- resolving a name; an empresa whose every local was deleted is itself
-- marked deleted so it stays out of the pickers.
-- ------------------------------------------------------------
insert into public.empresas (nombre_comercial, rif, imagen_url, estado, created_at, deleted_at)
select
  l.nombre_comercial,
  (array_agg(l.rif) filter (where l.rif is not null))[1],
  (array_agg(l.imagen_url) filter (where l.imagen_url is not null))[1],
  case
    when bool_or(l.estado = 'activo') then 'activo'
    when bool_or(l.estado = 'vencido') then 'vencido'
    else 'inactivo'
  end::empresa_estado,
  min(l.created_at),
  case when bool_or(l.deleted_at is null) then null else max(l.deleted_at) end
from public.locales l
group by l.nombre_comercial;

-- ------------------------------------------------------------
-- locales: point at the empresa, then drop the duplicated identity
-- ------------------------------------------------------------
alter table public.locales
  add column empresa_id uuid references public.empresas (id) on delete restrict;

update public.locales l
set empresa_id = e.id
from public.empresas e
where e.nombre_comercial = l.nombre_comercial;

alter table public.locales alter column empresa_id set not null;

create index locales_empresa_id_idx on public.locales (empresa_id);

drop index if exists locales_estado_idx;

alter table public.locales
  drop column nombre_comercial,
  drop column rif,
  drop column imagen_url,
  drop column estado;

-- The enum only existed for locales.estado, which is now empresas.estado.
drop type local_estado;

-- ------------------------------------------------------------
-- documentos: contracts and RIF scans are company paperwork, not
-- per-unit paperwork, so they hang off the empresa now.
-- ------------------------------------------------------------
-- Guarded: the documentos migration was never applied to production, so this
-- block has to be a no-op there. Once documentos is created it already carries
-- empresa_id (see its own migration), and this is skipped.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documentos'
      and column_name = 'local_id'
  ) then
    alter table public.documentos
      add column empresa_id uuid references public.empresas (id) on delete cascade;

    update public.documentos d
    set empresa_id = l.empresa_id
    from public.locales l
    where l.id = d.local_id;

    alter table public.documentos alter column empresa_id set not null;

    drop index if exists documentos_local_id_idx;
    alter table public.documentos drop column local_id;

    create index documentos_empresa_id_idx on public.documentos (empresa_id);
  end if;
end
$$;

-- ------------------------------------------------------------
-- RLS: same shape as every other table — everyone authenticated reads,
-- only admin writes.
-- ------------------------------------------------------------
alter table public.empresas enable row level security;

create policy "empresas_select_authenticated"
  on public.empresas for select
  to authenticated
  using (true);

create policy "empresas_insert_admin"
  on public.empresas for insert
  to authenticated
  with check (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

create policy "empresas_update_admin"
  on public.empresas for update
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

create policy "empresas_delete_admin"
  on public.empresas for delete
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );
