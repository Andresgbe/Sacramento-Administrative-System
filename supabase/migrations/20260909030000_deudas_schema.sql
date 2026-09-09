-- ============================================================
-- CC Sacramento — Deudas (obligations) and provider bills
--
-- Until now the app only recorded money that came IN (`pagos`). The mall also
-- needs the other half: what each business OWES. That is what the monthly
-- "Estado de cuenta" is — unpaid obligations, which carry over between months
-- (a tenant can owe condominio for both August and September).
--
-- Two shapes of obligation:
--   * Corpoelec and Hidrocapital arrive as ONE provider bill covering a shared
--     meter, which is then split among the businesses on it. There is more
--     than one electricity account ("Corpoelec 1.1", "Corpoelec 1.2"), each
--     shared by a different set of companies. `facturas_servicio` holds the
--     provider bill and its scan; the split lands in `deudas`.
--   * Canon and condominio are billed straight to the business, no bill to
--     split, so they get a `deudas` row with no `factura_id`.
--
-- The split is entered per bill, NOT stored as fixed percentages: the mall
-- confirmed the proportions change month to month.
--
-- Balance for any business = its deudas minus the pagos linked to them.
-- ============================================================

-- Services are billed in bolívares, canon and condominio in dollars, and the
-- estado de cuenta shows the two totals separately rather than summing them.
create type deuda_moneda as enum ('USD', 'VES');

-- ------------------------------------------------------------
-- facturas_servicio — the provider's bill, before it is split
-- ------------------------------------------------------------
create table public.facturas_servicio (
  id uuid primary key default gen_random_uuid(),
  concepto pago_concepto not null,
  -- Free text so the mall can label which meter this is: "Corpoelec 1.1",
  -- "Corpoelec 1.2", "Hidrocapital". Not an enum — accounts get added.
  referencia text not null,
  -- First day of the billed month; the day carries no meaning.
  periodo date not null,
  monto_total numeric(14, 2) not null,
  moneda deuda_moneda not null default 'VES',
  -- Which rate the user picked, and its value AT THE TIME. Snapshotted rather
  -- than joined live, so a past bill's dollar figure never moves.
  tipo_tasa pago_tipo_tasa,
  tasa numeric(14, 4),
  fecha_emision date,
  documento_ruta text,
  documento_nombre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index facturas_servicio_periodo_idx on public.facturas_servicio (periodo);
create index facturas_servicio_concepto_idx on public.facturas_servicio (concepto);

create trigger facturas_servicio_set_updated_at
  before update on public.facturas_servicio
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- deudas — one obligation per empresa / concepto / period
-- ------------------------------------------------------------
create table public.deudas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  -- Only canon is per-unit, mirroring the same rule on `pagos`.
  local_id uuid references public.locales (id) on delete restrict,
  concepto pago_concepto not null,
  periodo date not null,
  monto numeric(14, 2) not null,
  moneda deuda_moneda not null,
  tipo_tasa pago_tipo_tasa,
  tasa numeric(14, 4),
  -- Set when this row is one business's share of a shared provider bill.
  -- Deleting the bill removes the shares it produced.
  factura_id uuid references public.facturas_servicio (id) on delete cascade,
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deudas
  add constraint deudas_local_matches_concepto check (
    (concepto = 'canon' and local_id is not null)
    or (concepto <> 'canon' and local_id is null)
  );

create index deudas_empresa_id_idx on public.deudas (empresa_id);
create index deudas_periodo_idx on public.deudas (periodo);
create index deudas_factura_id_idx on public.deudas (factura_id);

create trigger deudas_set_updated_at
  before update on public.deudas
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- pagos → the obligation it settles
-- Nullable: a payment can be recorded without matching it to a debt, and
-- every pago that predates this migration has none. `on delete set null` so
-- removing a debt never destroys the record that money was received.
-- ------------------------------------------------------------
alter table public.pagos
  add column deuda_id uuid references public.deudas (id) on delete set null;

create index pagos_deuda_id_idx on public.pagos (deuda_id);

-- ------------------------------------------------------------
-- RLS — same shape as every other table: all authenticated read, admin writes
-- ------------------------------------------------------------
alter table public.facturas_servicio enable row level security;
alter table public.deudas enable row level security;

create policy "facturas_servicio_select_authenticated"
  on public.facturas_servicio for select to authenticated using (true);

create policy "facturas_servicio_insert_admin"
  on public.facturas_servicio for insert to authenticated
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

create policy "facturas_servicio_update_admin"
  on public.facturas_servicio for update to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

create policy "facturas_servicio_delete_admin"
  on public.facturas_servicio for delete to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

create policy "deudas_select_authenticated"
  on public.deudas for select to authenticated using (true);

create policy "deudas_insert_admin"
  on public.deudas for insert to authenticated
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

create policy "deudas_update_admin"
  on public.deudas for update to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

create policy "deudas_delete_admin"
  on public.deudas for delete to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));
