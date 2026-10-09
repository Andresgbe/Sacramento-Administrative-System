-- ============================================================
-- CC Sacramento — Sequential transaction numbers
-- Adds a human-friendly, ever-increasing integer "numero" to each
-- transaction table (pagos, egresos), meant to be shown
-- as the first column in the UI. This is separate from the uuid
-- primary key (kept as-is, since it's referenced by RLS/FKs) —
-- existing rows are backfilled in creation order (1, 2, 3, ...) and
-- new rows get the next number automatically via an owned sequence.
--
-- setval takes three arguments on purpose: a sequence's minimum is 1, so
-- seeding an empty table with 0 is rejected. `is_called = false` makes the
-- first nextval() hand back the value itself, i.e. start at 1.
-- ============================================================

-- pagos
alter table public.pagos add column if not exists numero integer;

with numbered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.pagos
  where numero is null
)
update public.pagos p
set numero = n.rn
from numbered n
where p.id = n.id;

alter table public.pagos alter column numero set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pagos_numero_key') then
    alter table public.pagos add constraint pagos_numero_key unique (numero);
  end if;
end $$;

create sequence if not exists pagos_numero_seq owned by public.pagos.numero;
select setval('pagos_numero_seq', coalesce((select max(numero) from public.pagos), 1), exists (select 1 from public.pagos));
alter table public.pagos alter column numero set default nextval('pagos_numero_seq');

-- egresos
alter table public.egresos add column if not exists numero integer;

with numbered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.egresos
  where numero is null
)
update public.egresos e
set numero = n.rn
from numbered n
where e.id = n.id;

alter table public.egresos alter column numero set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'egresos_numero_key') then
    alter table public.egresos add constraint egresos_numero_key unique (numero);
  end if;
end $$;

create sequence if not exists egresos_numero_seq owned by public.egresos.numero;
select setval('egresos_numero_seq', coalesce((select max(numero) from public.egresos), 1), exists (select 1 from public.egresos));
alter table public.egresos alter column numero set default nextval('egresos_numero_seq');

-- caja_chica deliberately left out: the module was removed in favour of
-- Balance and nothing reads the table any more, so numbering it would only
-- take an exclusive lock on it for no reader's benefit.
