-- ============================================================
-- CC Sacramento — Recreate the "documentos" table
-- Same story as the bucket in 20260824010000: the table created by
-- 20260812010000 is gone from the live project even though that
-- migration is marked as applied, so it was dropped from the
-- dashboard at some point. Uploads under "Datos avanzados" have been
-- failing there ever since.
--
-- Recreated with empresa_id, matching the split in 20260909000000.
-- The storage bucket and its policies already exist (20260824010000
-- and 20260824040000 are idempotent and handle those), so this only
-- restores the table and its RLS.
--
-- No-op on a database that replayed every migration in order.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'documento_tipo' and n.nspname = 'public'
  ) then
    create type documento_tipo as enum ('contrato', 'rif', 'otro');
  end if;
end
$$;

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo documento_tipo not null,
  nombre_archivo text not null,
  ruta text not null,
  created_at timestamptz not null default now()
);

create index if not exists documentos_empresa_id_idx on public.documentos (empresa_id);

alter table public.documentos enable row level security;

drop policy if exists "documentos_select_authenticated" on public.documentos;
create policy "documentos_select_authenticated"
  on public.documentos for select
  to authenticated
  using (true);

drop policy if exists "documentos_insert_authenticated" on public.documentos;
drop policy if exists "documentos_insert_admin" on public.documentos;
create policy "documentos_insert_admin"
  on public.documentos for insert
  to authenticated
  with check (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

drop policy if exists "documentos_delete_admin" on public.documentos;
create policy "documentos_delete_admin"
  on public.documentos for delete
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );
