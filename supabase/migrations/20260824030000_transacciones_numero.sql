-- ============================================================
-- CC Sacramento — Sequential transaction numbers
-- Adds a human-friendly, ever-increasing integer "numero" to each
-- transaction table (pagos, egresos, caja_chica), meant to be shown
-- as the first column in the UI. This is separate from the uuid
-- primary key (kept as-is, since it's referenced by RLS/FKs) —
-- existing rows are backfilled in creation order (1, 2, 3, ...) and
-- new rows get the next number automatically via an owned sequence.
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
alter table public.pagos add constraint pagos_numero_key unique (numero);

create sequence if not exists pagos_numero_seq owned by public.pagos.numero;
select setval('pagos_numero_seq', coalesce((select max(numero) from public.pagos), 0));
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
alter table public.egresos add constraint egresos_numero_key unique (numero);

create sequence if not exists egresos_numero_seq owned by public.egresos.numero;
select setval('egresos_numero_seq', coalesce((select max(numero) from public.egresos), 0));
alter table public.egresos alter column numero set default nextval('egresos_numero_seq');

-- caja_chica
alter table public.caja_chica add column if not exists numero integer;

with numbered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.caja_chica
  where numero is null
)
update public.caja_chica c
set numero = n.rn
from numbered n
where c.id = n.id;

alter table public.caja_chica alter column numero set not null;
alter table public.caja_chica add constraint caja_chica_numero_key unique (numero);

create sequence if not exists caja_chica_numero_seq owned by public.caja_chica.numero;
select setval('caja_chica_numero_seq', coalesce((select max(numero) from public.caja_chica), 0));
alter table public.caja_chica alter column numero set default nextval('caja_chica_numero_seq');
