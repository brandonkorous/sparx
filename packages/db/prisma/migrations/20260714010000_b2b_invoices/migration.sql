-- B2B invoices — net-terms credit management (docs/10 §9, docs/64 Ph3).
--
-- Invoice generated at order creation for net-terms B2B accounts.
-- Credit utilization = sum of unpaid invoice amounts. Enforced at order
-- placement by checking credit_limit > credit_used + new order amount.
--
-- Overdue escalation (handled by the b2b-overdue-worker Cloud Run cron):
--   7d overdue  → reminder email
--  14d overdue  → credit_hold status + email
--  30d overdue  → suspended status + email

CREATE TABLE b2b_invoices (
  id              uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id      uuid         NOT NULL REFERENCES b2b_accounts(id) ON DELETE CASCADE,
  order_id        uuid,
  invoice_number  varchar(63)  NOT NULL,
  amount_cents    int          NOT NULL,
  status          varchar(20)  NOT NULL DEFAULT 'unpaid',
  overdue_days    int          NOT NULL DEFAULT 0,
  due_at          timestamptz  NOT NULL,
  paid_at         timestamptz,
  paid_by_user_id uuid         REFERENCES users(id) ON DELETE SET NULL,
  paid_method     varchar(63),
  notes           text,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX ON b2b_invoices (tenant_id, account_id);
CREATE INDEX ON b2b_invoices (tenant_id, status, due_at);
CREATE INDEX ON b2b_invoices (order_id) WHERE order_id IS NOT NULL;

ALTER TABLE b2b_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_invoices FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON b2b_invoices
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Helper function: recompute credit_used for an account from unpaid invoices.
-- Called after every invoice create / mark-paid / write-off to keep the
-- credit_used column consistent without running an aggregate on every read.

CREATE OR REPLACE FUNCTION sync_b2b_credit_used(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE b2b_accounts a
  SET credit_used = (
    SELECT COALESCE(SUM(i.amount_cents), 0) / 100.0
    FROM b2b_invoices i
    WHERE i.account_id = p_account_id
      AND i.status IN ('unpaid', 'overdue')
  ),
  updated_at = now()
  WHERE a.id = p_account_id;
END;
$$;
