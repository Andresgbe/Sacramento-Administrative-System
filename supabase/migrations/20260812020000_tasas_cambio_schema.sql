-- ============================================================
-- CC Sacramento — Tasas de cambio module schema
-- ============================================================
-- Written to by the "tasas-cambio" Edge Function using the service
-- role key (which bypasses RLS), so no insert/update policy is
-- needed for regular authenticated users here.

create table if not exists public.tasas_cambio (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  bcv numeric(10, 4) not null,
  paralelo numeric(10, 4) not null,
  usdt numeric(10, 4) not null,
  created_at timestamptz not null default now()
);

alter table public.tasas_cambio enable row level security;

create policy "tasas_cambio_select_authenticated"
  on public.tasas_cambio for select
  to authenticated
  using (true);
