-- ============================================================
-- CC Sacramento — Add RIF text field to locales
-- ============================================================

alter table public.locales
  add column if not exists rif text;
