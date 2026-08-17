-- ============================================================
-- CC Sacramento — Pagos module schema
-- ============================================================

create type pago_tipo_tasa as enum ('BCV', 'EUR', 'USD', 'otra');

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales (id) on delete restrict,
  fecha date not null default current_date,
  monto numeric(10, 2) not null,
  tipo_tasa pago_tipo_tasa not null default 'BCV',
  descripcion text,
  created_at timestamptz not null default now()
);

create index if not exists pagos_local_id_idx on public.pagos (local_id);
create index if not exists pagos_fecha_idx on public.pagos (fecha);

alter table public.pagos enable row level security;

-- admin and subadmin can both read
create policy "pagos_select_authenticated"
  on public.pagos for select
  to authenticated
  using (true);

-- admin and subadmin can both register payments
create policy "pagos_insert_authenticated"
  on public.pagos for insert
  to authenticated
  with check (true);

-- only admin can edit or delete
create policy "pagos_update_admin"
  on public.pagos for update
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

create policy "pagos_delete_admin"
  on public.pagos for delete
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );
