-- ============================================================
-- CC Sacramento — Record a payment's bolívar amount too
--
-- A payment is agreed in dollars but actually transferred in bolívares, and
-- the mall needs the figure that left the tenant's account on record — the
-- reference on the bank statement is in Bs, not USD.
--
-- Nullable: cash paid straight in dollars has no bolívar side. `monto` (USD)
-- stays the authoritative amount — rent status, totals and the dashboard all
-- compare against `locales.monto_alquiler`, which is in dollars. `monto_bs` is
-- a record of what was transferred, never an input to a calculation.
-- ============================================================

alter table public.pagos
  add column if not exists monto_bs numeric(14, 2);
