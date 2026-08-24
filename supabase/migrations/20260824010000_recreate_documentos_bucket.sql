-- ============================================================
-- CC Sacramento — Recreate the "documentos" storage bucket
-- The original bucket (created in 20260812010000_documentos_schema.sql)
-- was removed from the live project outside of migrations (e.g. via
-- the dashboard), causing uploads to fail with "Bucket not found"
-- even though that migration was already marked as applied. This is
-- idempotent, so it's safe to run whether or not the bucket exists.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;
