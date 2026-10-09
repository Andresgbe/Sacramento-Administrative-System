-- ============================================================
-- CC Sacramento — USDT conversion per payment
--
-- A payment arriving is not yet income the mall can count. The bolívares sit
-- in the account until somebody goes to the market and buys USDT with them,
-- and what matters is how many USDT came back — which is never exactly the
-- nominal figure, because the rate moved and the exchange took its cut.
--
-- So `monto` stays what the tenant paid, and `usdt_convertido` records what
-- the mall actually got for it. Totals count the second; a payment with a
-- null `usdt_convertido` is money received but not yet realised.
--
-- Its own columns rather than overwriting `monto`: the tenant's obligation
-- and the mall's conversion are two different facts about one row, and rent
-- status must keep answering "did they pay?", not "did we convert it yet?".
-- ============================================================

alter table public.pagos
  add column if not exists usdt_convertido numeric(14, 2),
  add column if not exists conversion_fecha date,
  add column if not exists conversion_comprobante_ruta text,
  add column if not exists conversion_comprobante_nombre text;

-- A conversion is "done" when the amount is set, so the date must come with
-- it; neither half is meaningful alone.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pagos_conversion_completa'
  ) then
    alter table public.pagos
      add constraint pagos_conversion_completa
      check (
        (usdt_convertido is null and conversion_fecha is null)
        or (usdt_convertido is not null and conversion_fecha is not null)
      );
  end if;
end $$;

-- Partial index: the "sin convertir" card and its filter both read exactly
-- this set, and it stays small as converted rows accumulate.
create index if not exists pagos_sin_convertir_idx
  on public.pagos (fecha)
  where usdt_convertido is null;
