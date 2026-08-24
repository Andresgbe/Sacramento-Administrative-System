-- ============================================================
-- CC Sacramento — Payment receipt (comprobante) on pagos
-- Stored in the existing private "documentos" bucket under a
-- pagos/{pagoId}/ prefix — that bucket's RLS (authenticated read,
-- admin-only write) already covers it, no new storage policies
-- needed.
-- ============================================================

alter table public.pagos
  add column if not exists comprobante_ruta text,
  add column if not exists comprobante_nombre text;
