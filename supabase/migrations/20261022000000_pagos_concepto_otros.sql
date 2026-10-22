-- ============================================================
-- CC Sacramento — "otros": a catch-all income concepto
--
-- Money the mall collects that is neither rent nor condominio. It is the
-- mall's own income, entered like canon (USD authoritative, bolívares
-- optional), but the empresa is optional — it may come from someone who
-- is not a tenant — and it never belongs to a particular local.
--
-- The SQL Editor runs this in one transaction, and a new enum value cannot
-- be used before the transaction commits. The constraint therefore compares
-- `concepto::text`, which never resolves 'otros' as an enum literal.
-- ============================================================

alter type pago_concepto add value if not exists 'otros';

alter table public.pagos drop constraint if exists pagos_local_matches_concepto;
alter table public.pagos
  add constraint pagos_local_matches_concepto check (
    (concepto::text = 'canon' and empresa_id is not null and local_id is not null)
    or (
      concepto::text = 'condominio'
      and (
        (empresa_id is not null and local_id is not null)
        or (empresa_id is null and local_id is null)
      )
    )
    or (
      concepto::text in ('corpoelec', 'hidrocapital')
      and empresa_id is not null
      and local_id is null
    )
    or (concepto::text = 'otros' and local_id is null)
  );
