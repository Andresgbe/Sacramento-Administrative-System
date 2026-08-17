-- ============================================================
-- CC Sacramento — Egresos module schema
-- ============================================================

create type egreso_categoria as enum ('administrativo', 'operativo');

create table if not exists public.egresos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  monto numeric(10, 2) not null,
  categoria egreso_categoria not null,
  descripcion text,
  created_at timestamptz not null default now()
);

create index if not exists egresos_fecha_idx on public.egresos (fecha);
create index if not exists egresos_categoria_idx on public.egresos (categoria);

alter table public.egresos enable row level security;

-- admin and subadmin can both read
create policy "egresos_select_authenticated"
  on public.egresos for select
  to authenticated
  using (true);

-- admin and subadmin can both register expenses
create policy "egresos_insert_authenticated"
  on public.egresos for insert
  to authenticated
  with check (true);

-- only admin can edit or delete
create policy "egresos_update_admin"
  on public.egresos for update
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

create policy "egresos_delete_admin"
  on public.egresos for delete
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );
