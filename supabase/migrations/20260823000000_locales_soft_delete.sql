-- ============================================================
-- CC Sacramento — Soft delete for locales
-- Locales can accumulate pagos over their lifetime (a unit gets
-- rented, vacated, then rented again by a different business), and
-- pagos.local_id is `on delete restrict` so a hard delete is blocked
-- once a local has payment history. Deleting now marks the local as
-- deleted instead of removing the row, so past pagos keep resolving
-- the local's name via the existing join.
-- ============================================================

alter table public.locales add column if not exists deleted_at timestamptz;
