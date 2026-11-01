-- ============================================================
-- Repair: 20260909030000_deudas_schema.sql was only partly applied in
-- production. `deuda_moneda` and `facturas_servicio` exist; `deudas` does
-- not. This creates only what is missing and is safe to re-run.
--
-- facturas_servicio is deliberately NOT touched: later migrations changed
-- it, and re-creating its policies here could undo those changes.
--
-- Run BEFORE 20261030000000_principal_modulos_auditoria.sql, or re-run that
-- one afterwards, so `deudas` also gets its audit trigger.
-- ============================================================

do $$
begin
  create type deuda_moneda as enum ('USD', 'VES');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.deudas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  local_id uuid references public.locales (id) on delete restrict,
  concepto pago_concepto not null,
  periodo date not null,
  monto numeric(14, 2) not null,
  moneda deuda_moneda not null,
  tipo_tasa pago_tipo_tasa,
  tasa numeric(14, 4),
  factura_id uuid references public.facturas_servicio (id) on delete cascade,
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.deudas
    add constraint deudas_local_matches_concepto check (
      (concepto = 'canon' and local_id is not null)
      or (concepto <> 'canon' and local_id is null)
    );
exception
  when duplicate_object then null;
end;
$$;

create index if not exists deudas_empresa_id_idx on public.deudas (empresa_id);
create index if not exists deudas_periodo_idx on public.deudas (periodo);
create index if not exists deudas_factura_id_idx on public.deudas (factura_id);

drop trigger if exists deudas_set_updated_at on public.deudas;
create trigger deudas_set_updated_at
  before update on public.deudas
  for each row
  execute function public.set_updated_at();

alter table public.pagos
  add column if not exists deuda_id uuid references public.deudas (id) on delete set null;

create index if not exists pagos_deuda_id_idx on public.pagos (deuda_id);

-- RLS — same shape as every other table: all authenticated read, admin writes.
alter table public.deudas enable row level security;

drop policy if exists "deudas_select_authenticated" on public.deudas;
create policy "deudas_select_authenticated"
  on public.deudas for select to authenticated using (true);

drop policy if exists "deudas_insert_admin" on public.deudas;
create policy "deudas_insert_admin"
  on public.deudas for insert to authenticated
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

drop policy if exists "deudas_update_admin" on public.deudas;
create policy "deudas_update_admin"
  on public.deudas for update to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

drop policy if exists "deudas_delete_admin" on public.deudas;
create policy "deudas_delete_admin"
  on public.deudas for delete to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));
