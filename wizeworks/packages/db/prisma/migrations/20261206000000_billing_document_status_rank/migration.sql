-- Sortable AR status for billing documents (docs/87 §8).
--
-- The invoicing list needs "show me what needs chasing first", and the obvious
-- implementation — ORDER BY status — is wrong: `status` is a VarChar, so it
-- sorts alphabetically (overdue, paid, partial, unpaid, void), which puts PAID
-- documents second. What an operator means by sorting on status is urgency:
--
--     overdue → unpaid → partial → paid → void
--
-- A GENERATED column rather than a maintained one, deliberately. The rank is a
-- pure function of `status`, so Postgres derives it on every insert and update
-- and there is no write path that can forget it — including the raw SQL used by
-- the aging/rollup jobs. It is STORED (not VIRTUAL) because it exists to be
-- indexed and sorted, which a virtual column cannot be.
--
-- Values are spaced by 10 so a future status can slot between two existing ones
-- without renumbering (and without a table rewrite on a large tenant).

ALTER TABLE billing_documents
  ADD COLUMN status_rank SMALLINT NOT NULL GENERATED ALWAYS AS (
    CASE status
      WHEN 'overdue' THEN 10
      WHEN 'unpaid'  THEN 20
      WHEN 'partial' THEN 30
      WHEN 'paid'    THEN 40
      WHEN 'void'    THEN 50
      -- An unrecognised status sorts last rather than first: a value this
      -- CASE has never heard of is far more likely to be junk than an
      -- emergency, and burying it beats leading the operator's list with it.
      ELSE 99
    END
  ) STORED;

-- Paging sorts on (status_rank, id) — see billing-document-service.orderByFor,
-- where `id` is the tiebreaker that stops rows repeating across pages. The
-- tenant prefix keeps the index usable under RLS, matching the existing
-- (tenant_id, status, due_at) index next to it.
CREATE INDEX IF NOT EXISTS billing_documents_tenant_status_rank_idx
  ON billing_documents (tenant_id, status_rank, id);
