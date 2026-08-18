-- Per-site module scope (docs/49 Slice F).
--
-- module_scope is a jsonb string[] of module slugs that are DISABLED for this
-- site only. Empty array = all tenant-active modules remain available.
-- Tenant-level gating (module.activated) is the primary gate; module_scope
-- can only narrow, never grant. Validated in the service layer.

ALTER TABLE properties
  ADD COLUMN module_scope jsonb NOT NULL DEFAULT '[]';
