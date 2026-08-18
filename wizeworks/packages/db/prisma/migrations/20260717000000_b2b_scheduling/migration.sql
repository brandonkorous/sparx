-- B2B service scheduling: service_types + service_appointments
-- docs/64 B2B Ph7

-- ── service_types ──────────────────────────────────────────────────────────

CREATE TABLE service_types (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  duration_minutes INT         NOT NULL DEFAULT 60,
  color            VARCHAR(7),
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  requires_vehicle BOOLEAN     NOT NULL DEFAULT false,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX service_types_tenant_active_idx ON service_types (tenant_id, is_active);

ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_types FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON service_types
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ── service_appointments ───────────────────────────────────────────────────

CREATE TABLE service_appointments (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_type_id       UUID        NOT NULL REFERENCES service_types(id),
  b2b_account_id        UUID        REFERENCES b2b_accounts(id) ON DELETE SET NULL,
  customer_id           UUID        REFERENCES customers(id) ON DELETE SET NULL,

  scheduled_at          TIMESTAMPTZ NOT NULL,
  duration_minutes      INT         NOT NULL DEFAULT 60,
  status                VARCHAR(20) NOT NULL DEFAULT 'requested',

  vehicle_ref           JSONB,
  parts_linked          JSONB       NOT NULL DEFAULT '[]',

  notes                 TEXT,
  staff_notes           TEXT,

  confirmed_by_user_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at          TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancellation_reason   TEXT,
  reminder_sent_at      TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX service_appointments_tenant_status_idx     ON service_appointments (tenant_id, status);
CREATE INDEX service_appointments_tenant_scheduled_idx  ON service_appointments (tenant_id, scheduled_at);
CREATE INDEX service_appointments_tenant_account_idx    ON service_appointments (tenant_id, b2b_account_id);

ALTER TABLE service_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_appointments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON service_appointments
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
