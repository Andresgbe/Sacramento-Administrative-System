-- ============================================================
-- CC Sacramento — Locales module schema
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- usuarios: minimal table so RLS policies below can check role.
-- Extends auth.users (Supabase Auth) with app-specific fields.
-- Full usuarios policies (self-update, admin management, etc.)
-- are out of scope here and will be added when auth is wired up.
-- ------------------------------------------------------------
create type user_rol as enum ('admin', 'subadmin');

create table if not exists public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre_completo text not null,
  rol user_rol not null default 'subadmin',
  created_at timestamptz not null default now()
);

alter table public.usuarios enable row level security;

create policy "usuarios_select_self"
  on public.usuarios for select
  to authenticated
  using (id = auth.uid());

-- ------------------------------------------------------------
-- locales
-- ------------------------------------------------------------
create type local_estado as enum ('activo', 'inactivo', 'vencido');

create table if not exists public.locales (
  id uuid primary key default gen_random_uuid(),
  numero_local text not null unique,
  nombre_comercial text not null,
  imagen_url text,
  piso text,
  area_m2 numeric(8, 2),
  monto_alquiler numeric(10, 2),
  estado local_estado not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists locales_estado_idx on public.locales (estado);

-- Keep updated_at fresh on every row update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger locales_set_updated_at
  before update on public.locales
  for each row
  execute function public.set_updated_at();

alter table public.locales enable row level security;

-- admin and subadmin can both read
create policy "locales_select_authenticated"
  on public.locales for select
  to authenticated
  using (true);

-- admin and subadmin can both register new locales
create policy "locales_insert_authenticated"
  on public.locales for insert
  to authenticated
  with check (true);

-- only admin can edit or delete
create policy "locales_update_admin"
  on public.locales for update
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

create policy "locales_delete_admin"
  on public.locales for delete
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

-- ------------------------------------------------------------
-- Storage bucket for local photos (public read, authenticated write)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('locales', 'locales', true)
on conflict (id) do nothing;

create policy "locales_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'locales');

create policy "locales_images_authenticated_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'locales');
