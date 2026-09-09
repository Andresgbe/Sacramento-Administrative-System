-- ============================================================
-- CC Sacramento — Service bills are an archive, not an amount ledger
--
-- Registering a bill was asking for account reference, amount, currency, rate
-- type, rate value and issue date. In practice the mall records only: which
-- service, which month, and the photos of the bill.
--
-- The amounts are not lost — they live inside the attached documents, and the
-- per-empresa figures land in `deudas` when the bill is split. Keeping an
-- unused total here would just be a second place for the same number to drift.
-- Currency went with it: with no amounts there is nothing to denominate.
-- ============================================================

alter table public.facturas_servicio
  drop column if exists referencia,
  drop column if exists tipo_tasa,
  drop column if exists tasa,
  drop column if exists fecha_emision,
  drop column if exists monto_total,
  drop column if exists moneda;
