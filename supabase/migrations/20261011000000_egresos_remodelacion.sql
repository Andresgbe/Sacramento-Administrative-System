-- ============================================================
-- CC Sacramento — "remodelación" as a third egreso category
--
-- Sits alongside administrativo and operativo on the existing
-- `egreso_categoria` enum rather than becoming a table of its own: it is the
-- same kind of fact (money the mall paid out, counted in Balance), just
-- labelled differently. That is the opposite of `egresos_servicio`, which
-- earned its own table because it must stay OUT of Balance.
--
-- Not to be confused with the planned `remodelaciones` table, which is about
-- tracking the works themselves, not what they cost.
--
-- `add value if not exists` is re-runnable. Postgres 12+ allows this inside a
-- transaction, which is what the Supabase SQL Editor wraps the script in; the
-- new value just cannot be USED until that transaction commits — so this
-- migration only declares it and inserts nothing.
-- ============================================================

alter type egreso_categoria add value if not exists 'remodelacion';
