-- A trade buyer's quote request while they are still putting it together
-- (sparx persona issue 086).
--
-- The /b2b page promised a buyer builds a request from the catalog (quantities,
-- delivery needs, notes) and submits it. A request they have not sent is kept
-- here, not as a draft quote: making a quote publishes
-- `crm.billing_document.created`, mints a number and lists it for staff, and an
-- unsent request is none of those. It becomes a quote only when they send it.
--
-- One OPEN request per account, enforced by a partial unique index. A sent
-- request stays as `submitted`, so the next one starts fresh. Tenant-scoped,
-- FORCE RLS with the canonical `tenant_id = current_tenant_id()` policy.

CREATE TABLE b2b_quote_requests (
  id                     uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id              uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  company_id             uuid         NOT NULL REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
  status                 varchar(20)  NOT NULL DEFAULT 'open',
  started_by_customer_id uuid         REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  needed_by              date,
  deliver_to             text,
  delivery_notes         text,
  po_number              varchar(63),
  notes                  text,
  submitted_at           timestamptz,
  submitted_document_id  uuid,
  created_at             timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             timestamptz  NOT NULL,
  CONSTRAINT b2b_quote_requests_status_check CHECK (status IN ('open', 'submitted'))
);

CREATE INDEX b2b_quote_requests_tenant_id_company_id_status_idx
  ON b2b_quote_requests (tenant_id, company_id, status);

-- Every contact on the account builds the SAME request.
CREATE UNIQUE INDEX b2b_quote_requests_one_open_per_account
  ON b2b_quote_requests (tenant_id, company_id)
  WHERE status = 'open';

CREATE TABLE b2b_quote_request_lines (
  id          uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  request_id  uuid         NOT NULL REFERENCES b2b_quote_requests(id) ON DELETE CASCADE ON UPDATE CASCADE,
  variant_id  uuid         REFERENCES commerce_product_variants(id) ON DELETE SET NULL ON UPDATE CASCADE,
  description varchar(500) NOT NULL,
  quantity    int          NOT NULL,
  position    int          NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT b2b_quote_request_lines_quantity_check CHECK (quantity > 0)
);

CREATE INDEX b2b_quote_request_lines_tenant_id_request_id_idx
  ON b2b_quote_request_lines (tenant_id, request_id);

ALTER TABLE b2b_quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_quote_requests FORCE  ROW LEVEL SECURITY;
CREATE POLICY b2b_quote_requests_tenant_isolation ON b2b_quote_requests
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE b2b_quote_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_quote_request_lines FORCE  ROW LEVEL SECURITY;
CREATE POLICY b2b_quote_request_lines_tenant_isolation ON b2b_quote_request_lines
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
