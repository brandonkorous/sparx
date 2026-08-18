-- Builder-email personalization for automation sends (docs/91 §3).
--
-- An automation's email.send_campaign fires on a specific entity (an invoice, a
-- cold cart, a quote). The send now carries that entity's id(s) so the dispatch
-- tick re-resolves the LIVE entity into the email's DataSources, and the flat
-- trigger-time field snapshot as a scalar fallback when a live entity has since
-- been deleted. Both nullable + additive — coded templates and pre-rendered
-- broadcasts leave them null. No RLS change (email_scheduled_sends already has
-- tenant_isolation).

ALTER TABLE "email_scheduled_sends"
  ADD COLUMN "entity_refs" JSONB,
  ADD COLUMN "entity_snapshot" JSONB;
