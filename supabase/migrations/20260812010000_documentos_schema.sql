-- ============================================================
-- CC Sacramento — Documentos module schema
-- ============================================================

create type documento_tipo as enum ('contrato', 'rif', 'otro');

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales (id) on delete cascade,
  tipo documento_tipo not null,
  nombre_archivo text not null,
  ruta text not null,
  created_at timestamptz not null default now()
);

create index if not exists documentos_local_id_idx on public.documentos (local_id);

alter table public.documentos enable row level security;

-- admin and subadmin can both read
create policy "documentos_select_authenticated"
  on public.documentos for select
  to authenticated
  using (true);

-- admin and subadmin can both upload documents
create policy "documentos_insert_authenticated"
  on public.documentos for insert
  to authenticated
  with check (true);

-- only admin can delete
create policy "documentos_delete_admin"
  on public.documentos for delete
  to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

-- ------------------------------------------------------------
-- Storage bucket for local documents.
-- Private (unlike the "locales" photos bucket) — contracts and RIF
-- are sensitive, so access is only ever through a signed URL
-- generated for an authenticated user, never a public link.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create policy "documentos_files_authenticated_read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documentos');

create policy "documentos_files_authenticated_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documentos');
