-- ============================================================
-- Admin principal, module switches and the audit log.
--
-- Run in the Supabase SQL Editor with the live app closed (the alter table
-- takes an exclusive lock). Every statement is guarded, so a re-run is
-- harmless.
--
-- BEFORE RUNNING: replace CORREO_DEL_ADMIN_PRINCIPAL near the end with the
-- email of the one admin who should see "Admin auditoría". Left as is, the
-- update matches nobody and the section simply stays hidden from everyone.
-- ============================================================

-- ------------------------------------------------------------
-- 1. usuarios.es_principal
--
-- One admin above the others: the only one who can switch modules on and
-- off and read the audit log. A flag rather than a third user_rol value, so
-- every existing `rol = 'admin'` check keeps working unchanged.
-- ------------------------------------------------------------
alter table public.usuarios
  add column if not exists es_principal boolean not null default false;

create unique index if not exists usuarios_un_solo_principal
  on public.usuarios (es_principal)
  where es_principal;

-- Nobody signed in to the app can grant or drop the flag, and the principal
-- cannot be demoted. The manage-users Edge Function writes as service_role
-- and never touches the flag; the SQL Editor has no JWT role at all.
create or replace function public.proteger_admin_principal()
returns trigger
language plpgsql
as $$
begin
  if new.es_principal is distinct from old.es_principal
     and coalesce(auth.role(), '') in ('authenticated', 'anon') then
    raise exception 'El administrador principal solo se cambia desde la base de datos.';
  end if;

  if old.es_principal and new.rol <> 'admin' then
    raise exception 'No se puede quitar el rol de admin al administrador principal.';
  end if;

  return new;
end;
$$;

drop trigger if exists usuarios_proteger_principal on public.usuarios;
create trigger usuarios_proteger_principal
  before update on public.usuarios
  for each row execute function public.proteger_admin_principal();

-- security definer so RLS policies on other tables can call it without the
-- caller needing to read usuarios rows other than their own.
create or replace function public.es_admin_principal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.rol = 'admin' and u.es_principal
  );
$$;

-- ------------------------------------------------------------
-- 2. modulos_config — which sidebar modules are switched on.
--
-- Purely visibility: switching a module off hides its menu entry and blocks
-- its route. It never touches the module's data. A module with no row is ON,
-- so adding a module to the app needs no row here.
-- ------------------------------------------------------------
create table if not exists public.modulos_config (
  modulo text primary key,
  habilitado boolean not null default true,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users (id)
);

alter table public.modulos_config enable row level security;

-- Everyone reads it: the sidebar of every user depends on it.
drop policy if exists "modulos_config_select_authenticated" on public.modulos_config;
create policy "modulos_config_select_authenticated"
  on public.modulos_config for select
  to authenticated
  using (true);

drop policy if exists "modulos_config_insert_principal" on public.modulos_config;
create policy "modulos_config_insert_principal"
  on public.modulos_config for insert
  to authenticated
  with check (public.es_admin_principal());

drop policy if exists "modulos_config_update_principal" on public.modulos_config;
create policy "modulos_config_update_principal"
  on public.modulos_config for update
  to authenticated
  using (public.es_admin_principal())
  with check (public.es_admin_principal());

-- No delete policy on purpose: switching off is an update, never a delete.

-- Servicios starts hidden ("temporalmente"). do nothing on conflict so a
-- re-run does not undo a later decision to switch it back on.
insert into public.modulos_config (modulo, habilitado)
values ('servicios-basicos', false)
on conflict (modulo) do nothing;

-- ------------------------------------------------------------
-- 3. auditoria — every insert, update and delete on the business tables.
--
-- Written ONLY by the trigger below. There is no insert, update or delete
-- policy, so through the API the log is read-only even for the principal,
-- and nobody can edit or erase their tracks. A deleted row survives here in
-- full in `antes`.
-- ------------------------------------------------------------
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  tabla text not null,
  operacion text not null check (operacion in ('INSERT', 'UPDATE', 'DELETE')),
  registro_id text,
  antes jsonb,
  despues jsonb,
  usuario_id uuid,
  usuario_email text
);

create index if not exists auditoria_fecha_idx on public.auditoria (fecha desc);
create index if not exists auditoria_tabla_idx on public.auditoria (tabla);

alter table public.auditoria enable row level security;

drop policy if exists "auditoria_select_principal" on public.auditoria;
create policy "auditoria_select_principal"
  on public.auditoria for select
  to authenticated
  using (public.es_admin_principal());

revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;

-- security definer: it runs as the owner, which bypasses RLS, so the insert
-- succeeds even though no policy allows one.
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fila_antes jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  fila_despues jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  -- An update that changed nothing is not a change worth recording.
  if tg_op = 'UPDATE' and fila_antes = fila_despues then
    return new;
  end if;

  insert into public.auditoria (tabla, operacion, registro_id, antes, despues, usuario_id, usuario_email)
  values (
    tg_table_name,
    tg_op,
    coalesce(fila_despues ->> 'id', fila_antes ->> 'id'),
    fila_antes,
    fila_despues,
    auth.uid(),
    auth.jwt() ->> 'email'
  );

  return coalesce(new, old);
end;
$$;

-- tasas_cambio is left out (rewritten daily by the Edge Function, pure noise)
-- and so is caja_chica (nothing writes it any more).
-- A table missing from this database (deudas was never applied in
-- production) is skipped; re-running this script once it exists attaches it.
do $$
declare
  t text;
begin
  foreach t in array array[
    'empresas', 'locales', 'pagos', 'pagos_comprobantes', 'condominio_estado',
    'deudas', 'facturas_servicio', 'facturas_servicio_fotos', 'egresos_servicio',
    'documentos', 'locales_documentos', 'egresos', 'usuarios', 'modulos_config'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'auditoria: % no existe, se omite', t;
      continue;
    end if;

    execute format('drop trigger if exists auditoria_%1$s on public.%1$I', t);
    execute format(
      'create trigger auditoria_%1$s after insert or update or delete on public.%1$I
         for each row execute function public.registrar_auditoria()',
      t
    );
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 4. Mark the admin principal. EDIT THE EMAIL BEFORE RUNNING.
-- ------------------------------------------------------------
update public.usuarios u
set es_principal = true
from auth.users au
where au.id = u.id
  and au.email = 'CORREO_DEL_ADMIN_PRINCIPAL'
  and u.rol = 'admin'
  and not exists (select 1 from public.usuarios p where p.es_principal);
