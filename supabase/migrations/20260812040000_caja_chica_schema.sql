-- ============================================================
-- CC Sacramento — Caja chica module schema
-- ============================================================

create type caja_chica_tipo as enum ('ingreso', 'retiro');

create table if not exists public.caja_chica (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tipo caja_chica_tipo not null,
  monto numeric(10, 2) not null,
  descripcion text,
  created_at timestamptz not null default now()
);

create index if not exists caja_chica_fecha_idx on public.caja_chica (fecha);
create index if not exists caja_chica_tipo_idx on public.caja_chica (tipo);

alter table public.caja_chica enable row level security;

-- admin and subadmin can both read
create policy "caja_chica_select_authenticated"
  on public.caja_chica for select
  to authenticated
  using (true);

-- admin and subadmin can both register movements
create policy "caja_chica_insert_authenticated"
  on public.caja_chica for insert
  to authenticated
  with check (true);

-- only admin can edit or delete
create policy "caja_chica_update_admin"
  on public.caja_chica for update
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

create policy "caja_chica_delete_admin"
  on public.caja_chica for delete
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );
