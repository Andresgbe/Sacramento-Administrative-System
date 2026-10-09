-- ============================================================
-- CC Sacramento — condominio no longer requires an empresa
--
-- SUPERSEDED IN PART by 20261013000000_condominio_por_local.sql, which makes
-- condominio billable per unit. What is left here is the one piece that
-- still holds: `empresa_id` must be nullable, so the condominio rows already
-- on record — collected as one lump sum for the mall, with no business
-- attached — stay valid.
--
-- Two things this migration USED to do were removed before it was ever run:
-- an `update ... set empresa_id = null where concepto = 'condominio'`, which
-- would now wipe the empresa off every per-unit condominio payment, and a
-- check constraint forbidding empresa/local on condominio, which is exactly
-- what the newer migration has to allow.
-- ============================================================

alter table public.pagos alter column empresa_id drop not null;
