-- B2B account contacts — role-based portal access for B2B customers.
-- (docs/10 §11, docs/64 B2B Ph5)

CREATE TABLE b2b_account_contacts (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id  uuid        NOT NULL REFERENCES b2b_accounts(id) ON DELETE CASCADE,
  customer_id uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  role        varchar(30) NOT NULL DEFAULT 'buyer',
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, account_id, customer_id)
);

CREATE INDEX ON b2b_account_contacts (tenant_id, customer_id);
CREATE INDEX ON b2b_account_contacts (tenant_id, account_id);

ALTER TABLE b2b_account_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_account_contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON b2b_account_contacts
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Auto-backfill: create a primary_contact row for every customer that already
-- has a b2b_account_id set. Loops over tenants to satisfy RLS (sparx_owner is
-- non-superuser in prod — same FORCE RLS backfill pattern from packages/db/CLAUDE.md).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id AS tenant_id FROM tenants LOOP
    PERFORM set_config('app.current_tenant_id', r.tenant_id::text, true);
    INSERT INTO b2b_account_contacts (tenant_id, account_id, customer_id, role)
    SELECT
      c.tenant_id,
      c.b2b_account_id,
      c.id,
      'primary_contact'
    FROM customers c
    WHERE
      c.tenant_id = r.tenant_id
      AND c.b2b_account_id IS NOT NULL
      AND c.deleted_at IS NULL
    ON CONFLICT (tenant_id, account_id, customer_id) DO NOTHING;
  END LOOP;
END;
$$;
