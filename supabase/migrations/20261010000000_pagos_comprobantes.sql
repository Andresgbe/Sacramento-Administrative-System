-- ============================================================
-- CC Sacramento — several receipts per payment
--
-- A payment arrives as more than one file often enough (the transfer slip
-- plus the bank's confirmation, a payment split across two transfers) that
-- one `comprobante_ruta` column was not enough. Same arrangement as
-- `facturas_servicio_fotos`.
--
-- `pagos.comprobante_ruta` / `_nombre` are LEFT IN PLACE and backfilled from,
-- not dropped: dropping them would take the live rows' receipts with them if
-- anything about this migration had to be rolled back.
-- ============================================================

create table if not exists public.pagos_comprobantes (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos (id) on delete cascade,
  ruta text not null,
  nombre text not null,
  created_at timestamptz not null default now()
);

create index if not exists pagos_comprobantes_pago_id_idx
  on public.pagos_comprobantes (pago_id);

-- Move what the single columns already hold. Guarded on `ruta` so a re-run
-- does not duplicate a receipt.
insert into public.pagos_comprobantes (pago_id, ruta, nombre)
select p.id, p.comprobante_ruta, coalesce(p.comprobante_nombre, 'Comprobante')
from public.pagos p
where p.comprobante_ruta is not null
  and not exists (
    select 1 from public.pagos_comprobantes c where c.ruta = p.comprobante_ruta
  );

-- ------------------------------------------------------------
-- RLS — all authenticated read, only admin writes
-- ------------------------------------------------------------
alter table public.pagos_comprobantes enable row level security;

drop policy if exists "pagos_comprobantes_select_authenticated" on public.pagos_comprobantes;
create policy "pagos_comprobantes_select_authenticated"
  on public.pagos_comprobantes for select to authenticated using (true);

drop policy if exists "pagos_comprobantes_insert_admin" on public.pagos_comprobantes;
create policy "pagos_comprobantes_insert_admin"
  on public.pagos_comprobantes for insert to authenticated
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

drop policy if exists "pagos_comprobantes_update_admin" on public.pagos_comprobantes;
create policy "pagos_comprobantes_update_admin"
  on public.pagos_comprobantes for update to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

drop policy if exists "pagos_comprobantes_delete_admin" on public.pagos_comprobantes;
create policy "pagos_comprobantes_delete_admin"
  on public.pagos_comprobantes for delete to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));
