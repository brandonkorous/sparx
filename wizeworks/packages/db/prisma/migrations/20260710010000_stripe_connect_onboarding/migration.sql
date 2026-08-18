-- Stripe Connect onboarding (docs/65 Onboarding Ph1 + Ph2).
--
-- 1. tenants.stripe_account_id — the connected Express account ID (acct_...)
--    captured during the OAuth callback. Allows per-tenant Stripe split payouts.
--
-- 2. onboarding_checklist — per-tenant tip/progress rows shown in the dashboard
--    during the 7-day post-onboarding window (docs/65 Onboarding Ph2).

-- ─── tenants: Stripe Connect account id ──────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN stripe_account_id varchar(255);

-- ─── onboarding_checklist ────────────────────────────────────────────────────
-- Each row tracks whether a given onboarding tip/task has been seen and/or
-- dismissed by the tenant owner. `key` is a stable slug (e.g. "add_product",
-- "configure_shipping", "connect_domain").
CREATE TABLE onboarding_checklist (
  id          uuid          NOT NULL DEFAULT gen_random_uuid(),
  tenant_id   uuid          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key         varchar(63)   NOT NULL,
  shown_at    timestamptz,
  dismissed_at timestamptz,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),

  PRIMARY KEY (id),
  UNIQUE (tenant_id, key)
);

CREATE INDEX onboarding_checklist_tenant_idx ON onboarding_checklist (tenant_id);

-- RLS: tenant-scoped — tenants only see their own checklist rows.
ALTER TABLE onboarding_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_checklist FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON onboarding_checklist
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
