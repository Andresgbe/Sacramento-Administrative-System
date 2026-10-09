-- ============================================================
-- CC Sacramento — condominio is billed per unit after all
--
-- It was modelled as a single monthly lump sum for the mall, with neither
-- `empresa_id` nor `local_id`. The mall bills it per unit: a company renting
-- two units owes two condominios and often settles both in one transfer, so
-- each one needs its own row with its own amount.
--
-- The constraint accepts BOTH shapes for condominio:
--   * empresa + local set — every payment registered from now on;
--   * both null — the lump-sum rows already on record. They stay valid and
--     keep their comprobantes; they get an empresa and a local assigned by
--     hand, from the Pagos table, whenever the admin gets to them.
-- Canon and the two services are unchanged.
-- ============================================================

alter table public.pagos alter column empresa_id drop not null;

alter table public.pagos drop constraint if exists pagos_local_matches_concepto;
alter table public.pagos
  add constraint pagos_local_matches_concepto check (
    (concepto = 'canon' and empresa_id is not null and local_id is not null)
    or (
      concepto = 'condominio'
      and (
        (empresa_id is not null and local_id is not null)
        or (empresa_id is null and local_id is null)
      )
    )
    or (
      concepto in ('corpoelec', 'hidrocapital')
      and empresa_id is not null
      and local_id is null
    )
  );
