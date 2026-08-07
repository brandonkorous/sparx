-- CRM associations (docs/144 §6) — "these two records are related, and here is
-- HOW", across every CRM object, built-in and tenant-invented alike.
--
-- The problem in one line: a deal has one `customer_id`, and real deals are sold
-- to several people. Everything downstream of that — emailing everyone on a
-- deal, seeing a contact's deals when they are the evaluator rather than the
-- buyer, answering "who else is involved" — is unavailable until a record can be
-- related to more than one other record with a NAME on the relationship.
--
-- THE EXISTING FOREIGN KEYS ARE UNTOUCHED. `deals.customer_id`,
-- `deals.b2b_account_id`, `customers.b2b_account_id` all stay and keep their
-- indexes; the service keeps them in step with the association row flagged
-- `is_primary`. Every report, segment field, RLS policy and consumer that reads
-- them keeps working with no change. This is a graph layered OVER a fast primary
-- pointer.
--
-- from_id / to_id carry NO foreign key, deliberately: the table they point at
-- depends on the object key (customers / deals / b2b_accounts / crm_records), and
-- Postgres cannot express a polymorphic FK. The alternative — one nullable FK
-- column per object type — would need a migration every time a tenant invents a
-- record type, which is precisely what the registry exists to make unnecessary.
-- Referential cleanup lives in the services, which remove both directions when a
-- record is deleted.
--
-- RLS is hand-edited (Prisma generates no ENABLE/FORCE/policies). No backfill
-- loop is needed: both tables are new and empty, so the FORCE-RLS per-tenant
-- backfill footgun (packages/db CLAUDE.md §RLS) does not apply. No rows are
-- seeded here either — built-in association labels are created by the CRM
-- module-activation consumer, which must not run for tenants that have never
-- enabled CRM.

-- ─────────────────────────────────────────────────────────────────────────
-- crm_associations — the edges
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE "crm_associations" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"  UUID        NOT NULL,
    "from_type"  VARCHAR(63) NOT NULL,
    "from_id"    UUID        NOT NULL,
    "to_type"    VARCHAR(63) NOT NULL,
    "to_id"      UUID        NOT NULL,
    "label_key"  VARCHAR(63),
    "is_primary" BOOLEAN     NOT NULL DEFAULT FALSE,
    "note"       TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "crm_associations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_associations_tenant_id_fkey" FOREIGN KEY ("tenant_id")
        REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    -- A record related to itself is always a mistake, and one that produces an
    -- infinite walk in any graph traversal. Refused at the table.
    CONSTRAINT "crm_associations_not_self" CHECK (
        NOT ("from_type" = "to_type" AND "from_id" = "to_id")
    )
);

-- One link per (pair, label). The same two records may be linked more than once
-- under DIFFERENT labels — someone who both decides and pays is genuinely two
-- relationships, and collapsing them loses the one you needed.
--
-- NULLS NOT DISTINCT is what makes the unlabelled case behave: without it,
-- Postgres treats every NULL label as distinct and the same two records could be
-- linked "related, unlabelled" an unlimited number of times.
CREATE UNIQUE INDEX "crm_associations_pair_label_unique"
    ON "crm_associations" ("tenant_id", "from_type", "from_id", "to_type", "to_id", "label_key")
    NULLS NOT DISTINCT;

CREATE INDEX "crm_associations_from_idx"
    ON "crm_associations" ("tenant_id", "from_type", "from_id");
CREATE INDEX "crm_associations_to_idx"
    ON "crm_associations" ("tenant_id", "to_type", "to_id");
CREATE INDEX "crm_associations_label_idx"
    ON "crm_associations" ("tenant_id", "label_key");

-- At most ONE primary per (from record, to TYPE). Two "primary" customers on a
-- deal would make `deals.customer_id` ambiguous, and the drift between the FK and
-- the graph is exactly the failure this design is built to avoid. A partial
-- index, so the overwhelmingly common non-primary rows cost nothing.
CREATE UNIQUE INDEX "crm_associations_one_primary_per_target_type"
    ON "crm_associations" ("tenant_id", "from_type", "from_id", "to_type")
    WHERE "is_primary";

ALTER TABLE "crm_associations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_associations" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_associations_tenant_isolation ON "crm_associations"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────
-- crm_association_labels — what those relationships are CALLED
-- ─────────────────────────────────────────────────────────────────────────
--
-- Both directions are stored because a relationship reads differently from each
-- end: from the deal it is "Decision maker"; from the contact it is "Deal they
-- decide on". One label would force every panel on one side to read backwards.

CREATE TABLE "crm_association_labels" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"     UUID         NOT NULL,
    "from_type"     VARCHAR(63)  NOT NULL,
    "to_type"       VARCHAR(63)  NOT NULL,
    "key"           VARCHAR(63)  NOT NULL,
    "label"         VARCHAR(120) NOT NULL,
    "inverse_label" VARCHAR(120) NOT NULL,
    "is_builtin"    BOOLEAN      NOT NULL DEFAULT FALSE,
    "sort_order"    INTEGER      NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "crm_association_labels_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_association_labels_tenant_id_fkey" FOREIGN KEY ("tenant_id")
        REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "crm_association_labels_unique"
    ON "crm_association_labels" ("tenant_id", "from_type", "to_type", "key");
CREATE INDEX "crm_association_labels_pair_idx"
    ON "crm_association_labels" ("tenant_id", "from_type", "to_type");

ALTER TABLE "crm_association_labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_association_labels" FORCE  ROW LEVEL SECURITY;
CREATE POLICY crm_association_labels_tenant_isolation ON "crm_association_labels"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
