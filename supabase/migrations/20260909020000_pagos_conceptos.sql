-- ============================================================
-- CC Sacramento — Payment concepts
--
-- Every business pays four different things, and they are not billed at the
-- same level:
--   * canon (alquiler) is billed PER LOCAL — a company renting two units pays
--     two canons a month.
--   * condominio, corpoelec and hidrocapital are billed PER EMPRESA — one bill
--     each per month, whatever number of units the company occupies.
--
-- So `pagos` now always carries empresa_id, and local_id only when the concept
-- is per-unit. A check constraint keeps the two shapes from being mixed up,
-- because "which local is this water bill for?" has no correct answer.
-- ============================================================

create type pago_concepto as enum ('canon', 'condominio', 'corpoelec', 'hidrocapital');

alter table public.pagos
  add column concepto pago_concepto not null default 'canon',
  add column empresa_id uuid references public.empresas (id) on delete restrict;

-- Every existing pago is a rent payment, and its empresa is the one that
-- currently holds the local.
update public.pagos p
set empresa_id = l.empresa_id
from public.locales l
where l.id = p.local_id;

alter table public.pagos alter column empresa_id set not null;

-- local_id becomes optional: only canon rows carry one.
alter table public.pagos alter column local_id drop not null;

alter table public.pagos
  add constraint pagos_local_matches_concepto check (
    (concepto = 'canon' and local_id is not null)
    or (concepto <> 'canon' and local_id is null)
  );

create index if not exists pagos_empresa_id_idx on public.pagos (empresa_id);
create index if not exists pagos_concepto_idx on public.pagos (concepto);
