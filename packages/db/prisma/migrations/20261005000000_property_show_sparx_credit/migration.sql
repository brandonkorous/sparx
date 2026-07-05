-- Platform attribution flag on properties.
--
-- show_sparx_credit gates the always-on "Made with sparx" credit badge that
-- apps/site injects into every site footer as shell chrome (not a deletable
-- BuilderNode). Defaults TRUE so every existing and future site carries the
-- credit; a future merchant toggle flips it to false to hide the badge site-wide.
--
-- Additive column with a constant DEFAULT — Postgres applies it as a metadata-only
-- fast default (no table rewrite) and every existing row reads `true`. No backfill
-- loop is required, so the FORCE-RLS per-tenant backfill footgun does not apply.

ALTER TABLE properties
  ADD COLUMN show_sparx_credit boolean NOT NULL DEFAULT true;
