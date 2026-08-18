-- import_jobs: tenant-scoped background import jobs (docs/68 §8).
--
-- FORCE RLS is required (sparx_owner is not a superuser in prod). Every
-- query must set app.current_tenant_id before touching these tables or
-- the isolation policy blocks it.

CREATE TABLE import_jobs (
  id              uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type     varchar(50)  NOT NULL,
  status          varchar(20)  NOT NULL DEFAULT 'pending',
  file_name       varchar(255),
  row_count       int          NOT NULL DEFAULT 0,
  imported_count  int          NOT NULL DEFAULT 0,
  updated_count   int          NOT NULL DEFAULT 0,
  error_count     int          NOT NULL DEFAULT 0,
  options         jsonb        NOT NULL DEFAULT '{}',
  raw_rows        jsonb        NOT NULL DEFAULT '[]',
  actor_id        uuid,
  completed_at    timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON import_jobs
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX import_jobs_tenant_idx        ON import_jobs (tenant_id);
CREATE INDEX import_jobs_tenant_status_idx ON import_jobs (tenant_id, status);

-- import_job_rows: per-row processing results for an import job.
-- tenant_id is denormalized (from the parent job) so the RLS policy can
-- filter without a join to import_jobs.

CREATE TABLE import_job_rows (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id      uuid        NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  row_index   int         NOT NULL,
  status      varchar(20) NOT NULL,
  natural_key varchar(255),
  error_msg   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE import_job_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_job_rows FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON import_job_rows
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX import_job_rows_job_idx    ON import_job_rows (job_id);
CREATE INDEX import_job_rows_tenant_idx ON import_job_rows (tenant_id);
