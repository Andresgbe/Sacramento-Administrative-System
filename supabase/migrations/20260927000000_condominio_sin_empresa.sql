-- ============================================================
-- CC Sacramento — Condominio moves to the rent ledger, without an empresa
--
-- Condominio used to be registered under Servicios, attached to a business.
-- It now belongs in Reporte de pagos next to canon, and is collected as a
-- single monthly figure that is NOT broken down per tenant — so it carries
-- neither `empresa_id` nor `local_id`.
--
-- That forces `empresa_id` to become nullable. The check constraint below is
-- what keeps the column honest per concepto, so nothing can silently land
-- without the reference it should have:
--
--   canon         → empresa_id AND local_id   (a unit's rent)
--   condominio    → neither                   (one lump sum for the mall)
--   corpoelec     → empresa_id, no local_id   (a business's share of a bill)
--   hidrocapital  → idem
-- ============================================================

alter table public.pagos alter column empresa_id drop not null;

-- Any condominio row registered under the old rules still points at a
-- business; clear it so every row satisfies the new constraint.
update public.pagos set empresa_id = null where concepto = 'condominio';

alter table public.pagos drop constraint if exists pagos_local_matches_concepto;

alter table public.pagos
  add constraint pagos_local_matches_concepto check (
    (concepto = 'canon' and empresa_id is not null and local_id is not null)
    or (concepto = 'condominio' and empresa_id is null and local_id is null)
    or (
      concepto in ('corpoelec', 'hidrocapital')
      and empresa_id is not null
      and local_id is null
    )
  );
