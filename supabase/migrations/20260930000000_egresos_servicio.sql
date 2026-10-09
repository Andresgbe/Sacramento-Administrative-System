-- ============================================================
-- CC Sacramento — What the mall pays OUT for the shared services
--
-- `pagos` (corpoelec/hidrocapital) records what each business hands over.
-- This records the other side: what the mall actually pays the provider.
-- The two together say whether what was collected covered the bill.
--
-- A separate table rather than a `categoria` on `egresos`, for two reasons:
--
--  1. **It must stay out of Balance and Reportes.** Services are collected and
--     forwarded, so counting them there would have each cancel against itself.
--     Its own table makes that structural — nothing has to remember to filter.
--  2. **It is denominated in bolívares**, the opposite of `egresos`, where USD
--     is authoritative. `monto_bs` is what gets subtracted; `monto_usd` and
--     `tasa` only record that the figure was typed in dollars and at what rate,
--     so a past entry never moves when the rate does.
-- ============================================================

create table if not exists public.egresos_servicio (
  id uuid primary key default gen_random_uuid(),
  numero integer,
  concepto pago_concepto not null,
  fecha date not null default current_date,
  monto_bs numeric(14, 2) not null,
  -- Set only when the amount was typed in dollars, alongside the rate used.
  monto_usd numeric(14, 2),
  tasa numeric(14, 4),
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The mall never pays canon or condominio out; those are money coming in.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'egresos_servicio_concepto_valido'
  ) then
    alter table public.egresos_servicio
      add constraint egresos_servicio_concepto_valido
      check (concepto in ('corpoelec', 'hidrocapital'));
  end if;
end $$;

create index if not exists egresos_servicio_fecha_idx on public.egresos_servicio (fecha);
create index if not exists egresos_servicio_concepto_idx on public.egresos_servicio (concepto);

drop trigger if exists egresos_servicio_set_updated_at on public.egresos_servicio;
create trigger egresos_servicio_set_updated_at
  before update on public.egresos_servicio
  for each row execute function public.set_updated_at();

-- Human-readable running number, same arrangement as pagos/egresos.
create sequence if not exists egresos_servicio_numero_seq owned by public.egresos_servicio.numero;
-- Three-arg setval: a sequence's minimum is 1, so seeding an empty table with
-- 0 is rejected outright. `is_called = false` makes the first nextval() return
-- the value itself, which is what "start at 1" means for a table with no rows.
select setval(
  'egresos_servicio_numero_seq',
  coalesce((select max(numero) from public.egresos_servicio), 1),
  exists (select 1 from public.egresos_servicio)
);
alter table public.egresos_servicio
  alter column numero set default nextval('egresos_servicio_numero_seq');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'egresos_servicio_numero_key') then
    alter table public.egresos_servicio add constraint egresos_servicio_numero_key unique (numero);
  end if;
end $$;

-- ------------------------------------------------------------
-- RLS — all authenticated read, only admin writes
-- ------------------------------------------------------------
alter table public.egresos_servicio enable row level security;

drop policy if exists "egresos_servicio_select_authenticated" on public.egresos_servicio;
create policy "egresos_servicio_select_authenticated"
  on public.egresos_servicio for select to authenticated using (true);

drop policy if exists "egresos_servicio_insert_admin" on public.egresos_servicio;
create policy "egresos_servicio_insert_admin"
  on public.egresos_servicio for insert to authenticated
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

drop policy if exists "egresos_servicio_update_admin" on public.egresos_servicio;
create policy "egresos_servicio_update_admin"
  on public.egresos_servicio for update to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

drop policy if exists "egresos_servicio_delete_admin" on public.egresos_servicio;
create policy "egresos_servicio_delete_admin"
  on public.egresos_servicio for delete to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));
