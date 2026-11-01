-- Free-text notes on a local, for what the mall needs to remember about the
-- unit but has no field for: contract expiry, an agreed 20% rent increase.
--
-- Run in the SQL Editor with the live app closed. Safe to re-run. The existing
-- locales policies already cover this column: everyone reads, admin writes.
alter table public.locales
  add column if not exists notas text;
