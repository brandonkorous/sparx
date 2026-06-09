-- B2B purchase approval rules — per-account/tenant-wide order approval thresholds.
-- (docs/10 §12, docs/64 B2B Ph6)

CREATE TABLE purchase_approval_rules (
  id                        uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                 uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id                uuid                 REFERENCES b2b_accounts(id) ON DELETE CASCADE,
  min_amount_cents          int         NOT NULL DEFAULT 0,
  required_approver_user_id uuid                 REFERENCES users(id) ON DELETE SET NULL,
  is_active                 boolean     NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON purchase_approval_rules (tenant_id, account_id, is_active);

ALTER TABLE purchase_approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_approval_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON purchase_approval_rules
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
