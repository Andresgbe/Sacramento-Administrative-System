-- ============================================================
-- CC Sacramento — per-unit condominio status, set by hand
--
-- `pagos.condominio` is a single monthly lump sum for the mall: both
-- `empresa_id` and `local_id` are null, enforced by
-- `pagos_local_matches_concepto`. So there is no per-tenant condominio row to
-- derive a status from, and this cannot be computed — the admin marks it.
--
-- Keyed by PERIOD, not a plain boolean on `locales`: a flag with no period
-- would still read "pagado" every following month, and somebody would have to
-- remember to switch every unit back off on the 1st. One row per unit per
-- month also keeps the history of who paid when.
-- ============================================================

create table if not exists public.condominio_estado (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales (id) on delete cascade,
  -- 'YYYY-MM'. Text, like every other period in this app, so it compares and
  -- sorts with the `fecha` prefixes the report filters already use.
  periodo text not null,
  pagado boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint condominio_estado_periodo_formato check (periodo ~ '^\d{4}-\d{2}$'),
  constraint condominio_estado_local_periodo_key unique (local_id, periodo)
);

create index if not exists condominio_estado_periodo_idx
  on public.condominio_estado (periodo);

drop trigger if exists condominio_estado_set_updated_at on public.condominio_estado;
create trigger condominio_estado_set_updated_at
  before update on public.condominio_estado
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS — all authenticated read, only admin writes
-- ------------------------------------------------------------
alter table public.condominio_estado enable row level security;

drop policy if exists "condominio_estado_select_authenticated" on public.condominio_estado;
create policy "condominio_estado_select_authenticated"
  on public.condominio_estado for select to authenticated using (true);

drop policy if exists "condominio_estado_insert_admin" on public.condominio_estado;
create policy "condominio_estado_insert_admin"
  on public.condominio_estado for insert to authenticated
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

drop policy if exists "condominio_estado_update_admin" on public.condominio_estado;
create policy "condominio_estado_update_admin"
  on public.condominio_estado for update to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

drop policy if exists "condominio_estado_delete_admin" on public.condominio_estado;
create policy "condominio_estado_delete_admin"
  on public.condominio_estado for delete to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));
