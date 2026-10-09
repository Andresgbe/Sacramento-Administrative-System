-- ============================================================
-- CC Sacramento — Attach a receipt to an egreso
--
-- Same arrangement `pagos` already uses: the file lives in the private
-- `documentos` bucket under `egresos/<egreso_id>/`, and the row keeps its
-- path plus the original filename so the UI can show a readable label and
-- open it through a signed URL. The bucket's storage policies are
-- bucket-wide, so nothing new is needed there.
-- ============================================================

alter table public.egresos
  add column if not exists comprobante_ruta text,
  add column if not exists comprobante_nombre text;
