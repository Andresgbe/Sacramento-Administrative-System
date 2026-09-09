-- ============================================================
-- CC Sacramento — The owning company
--
-- Inmobiliaria Di Placido owns the mall and collects the rents, so it is not
-- a tenant — but it does appear on the Corpoelec and Hidrocapital bills,
-- absorbing a share of each (16,67% on Corpoelec 1.1, 66,67% on 1.2, 13,33%
-- on Hidrocapital). It therefore needs to exist as an `empresas` row so debts
-- can be assigned to it, while being excluded everywhere "tenant" is meant:
--   * the Dashboard's "Empresas activas" tile,
--   * the empresa picker when the concept is canon (it does not pay itself
--     rent) or condominio.
-- ============================================================

alter table public.empresas
  add column if not exists es_propietaria boolean not null default false;

insert into public.empresas (nombre_comercial, estado, es_propietaria)
select 'Inmobiliaria Di Placido', 'activo', true
where not exists (
  select 1 from public.empresas where es_propietaria
);
