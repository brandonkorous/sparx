-- docs/144 §11 — the Company object.
--
-- `b2b_accounts` was doing two jobs at once: it is the platform's ONLY company
-- record, and it is the B2B trading relationship. A design agency tracking the
-- firms it works with should never meet a credit limit — but it had to, because
-- the only place to put a company was a table named after wholesale.
--
-- This migration splits the NAME from the JOB. The table becomes `companies`;
-- every column stays exactly where it is, including the AR/pricing/fleet ones.
-- What changes above the database is that those columns are presented as a
-- "Trade terms" panel gated on the `b2b` module, so a CRM-only tenant gets a
-- company record with none of the wholesale vocabulary on it.
--
-- RENAME, NOT COPY. `ALTER TABLE … RENAME` is a catalog update: no rows move, no
-- FK is dropped and re-added, and the RLS policy travels with the table. A
-- create-copy-drop would have been minutes of downtime on the widest-referenced
-- table in the schema, and would have invalidated every foreign key pointing at
-- it. Nothing here rewrites a page.
--
-- Index and constraint names are renamed alongside, because Prisma derives its
-- expected names from the MAPPED TABLE NAME. Leaving `b2b_accounts_pkey` on a
-- table called `companies` is invisible at runtime and shows up forever after as
-- drift in `migrate diff` — the sort of difference that trains people to ignore
-- drift output.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. The table itself
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE "b2b_accounts" RENAME TO "companies";

ALTER INDEX "b2b_accounts_pkey"                            RENAME TO "companies_pkey";
ALTER INDEX "b2b_accounts_custom_properties_gin"           RENAME TO "companies_custom_properties_gin";
ALTER INDEX "b2b_accounts_tenant_id_status_idx"            RENAME TO "companies_tenant_id_status_idx";
ALTER INDEX "b2b_accounts_tenant_id_assigned_rep_id_idx"   RENAME TO "companies_tenant_id_assigned_rep_id_idx";
ALTER INDEX "b2b_accounts_tenant_id_updated_at_idx"        RENAME TO "companies_tenant_id_updated_at_idx";
ALTER INDEX "b2b_accounts_tenant_id_pricing_tier_id_idx"   RENAME TO "companies_tenant_id_pricing_tier_id_idx";

ALTER TABLE "companies" RENAME CONSTRAINT "b2b_accounts_tenant_id_fkey"       TO "companies_tenant_id_fkey";
ALTER TABLE "companies" RENAME CONSTRAINT "b2b_accounts_assigned_rep_id_fkey" TO "companies_assigned_rep_id_fkey";
ALTER TABLE "companies" RENAME CONSTRAINT "b2b_accounts_pricing_tier_id_fkey" TO "companies_pricing_tier_id_fkey";

-- PostgreSQL 18 names NOT NULL constraints, and those names are derived from the
-- table at CREATE time. A database built fresh from this migration history would
-- name them `companies_*`; a migrated one would keep `b2b_accounts_*`. Same
-- behaviour either way, but two databases claiming to be at the same migration
-- should not disagree about what is in them.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'companies'::regclass AND conname LIKE 'b2b\_accounts\_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE "companies" RENAME CONSTRAINT %I TO %I',
      c.conname, 'companies_' || substring(c.conname from 14)
    );
  END LOOP;
END $$;

COMMENT ON TABLE "companies" IS
  'The platform company record (docs/144 §11). Renamed from b2b_accounts: the AR/pricing/fleet columns remain but are presented only when the `b2b` module is on.';

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Email domains, for opt-in association
-- ══════════════════════════════════════════════════════════════════════════
--
-- A company's email domains. `website` already existed and is NOT the same
-- thing: a firm at `acme.com` may send mail from `acme-group.com`, and a
-- consultancy may have no website at all while every contact shares a domain.
--
-- An ARRAY rather than one column because that is the shape reality has — an
-- acquired brand keeps its old domain for years, and a company with two of them
-- is not two companies.
ALTER TABLE "companies" ADD COLUMN "domains" TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN "companies"."domains" IS
  'Lowercased email domains belonging to this company (docs/144 §11). Used to OFFER an association on a new contact — never to apply one.';

-- Association lookup is "which company owns @acme.com", i.e. a containment
-- search over the array. GIN is the index that answers it; a btree cannot.
CREATE INDEX "companies_domains_gin" ON "companies" USING GIN ("domains");

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Every column that points at a company
-- ══════════════════════════════════════════════════════════════════════════
--
-- `deals.b2b_account_id` referencing a table called `companies` would read as a
-- leftover rather than a decision, and the next person to touch it would have to
-- go and find out which it was.
--
-- `crm_activities` is PARTITIONED: renaming a column on the parent recurses to
-- every partition automatically, so the five monthly partitions need nothing
-- here. Their per-partition index names are cosmetic and left alone — they are
-- generated from the parent index at ATTACH time, so partitions created from
-- here on carry the new name.

ALTER TABLE "customers"                  RENAME COLUMN "b2b_account_id" TO "company_id";
ALTER TABLE "deals"                      RENAME COLUMN "b2b_account_id" TO "company_id";
ALTER TABLE "crm_activities"             RENAME COLUMN "b2b_account_id" TO "company_id";
ALTER TABLE "crm_tickets"                RENAME COLUMN "b2b_account_id" TO "company_id";
ALTER TABLE "commerce_price_lists"       RENAME COLUMN "b2b_account_id" TO "company_id";
ALTER TABLE "commerce_contract_prices"   RENAME COLUMN "b2b_account_id" TO "company_id";
ALTER TABLE "commerce_checkout_sessions" RENAME COLUMN "b2b_account_id" TO "company_id";
ALTER TABLE "commerce_tax_exemptions"    RENAME COLUMN "b2b_account_id" TO "company_id";
ALTER TABLE "billing_documents"          RENAME COLUMN "b2b_account_id" TO "company_id";
ALTER TABLE "b2b_fleet_holds"            RENAME COLUMN "b2b_account_id" TO "company_id";
ALTER TABLE "bookings"                   RENAME COLUMN "b2b_account_id" TO "company_id";

ALTER TABLE "customers"                  RENAME CONSTRAINT "customers_b2b_account_id_fkey"                  TO "customers_company_id_fkey";
ALTER TABLE "deals"                      RENAME CONSTRAINT "deals_b2b_account_id_fkey"                      TO "deals_company_id_fkey";
ALTER TABLE "crm_activities"             RENAME CONSTRAINT "crm_activities_b2b_account_id_fkey"             TO "crm_activities_company_id_fkey";
ALTER TABLE "crm_tickets"                RENAME CONSTRAINT "crm_tickets_b2b_account_fkey"                   TO "crm_tickets_company_fkey";
ALTER TABLE "commerce_price_lists"       RENAME CONSTRAINT "commerce_price_lists_b2b_account_id_fkey"       TO "commerce_price_lists_company_id_fkey";
ALTER TABLE "commerce_contract_prices"   RENAME CONSTRAINT "commerce_contract_prices_b2b_account_id_fkey"   TO "commerce_contract_prices_company_id_fkey";
ALTER TABLE "commerce_checkout_sessions" RENAME CONSTRAINT "commerce_checkout_sessions_b2b_account_id_fkey" TO "commerce_checkout_sessions_company_id_fkey";
ALTER TABLE "commerce_tax_exemptions"    RENAME CONSTRAINT "commerce_tax_exemptions_b2b_account_id_fkey"    TO "commerce_tax_exemptions_company_id_fkey";
ALTER TABLE "billing_documents"          RENAME CONSTRAINT "billing_documents_b2b_account_id_fkey"          TO "billing_documents_company_id_fkey";
ALTER TABLE "b2b_fleet_holds"            RENAME CONSTRAINT "b2b_fleet_holds_b2b_account_id_fkey"            TO "b2b_fleet_holds_company_id_fkey";

ALTER INDEX "customers_tenant_id_b2b_account_id_idx"                  RENAME TO "customers_tenant_id_company_id_idx";
ALTER INDEX "deals_tenant_id_b2b_account_id_idx"                      RENAME TO "deals_tenant_id_company_id_idx";
ALTER INDEX "crm_activities_tenant_id_b2b_account_id_occurred_at_idx" RENAME TO "crm_activities_tenant_id_company_id_occurred_at_idx";
ALTER INDEX "commerce_price_lists_tenant_id_b2b_account_id_idx"       RENAME TO "commerce_price_lists_tenant_id_company_id_idx";
ALTER INDEX "commerce_contract_prices_tenant_id_b2b_account_id_idx"   RENAME TO "commerce_contract_prices_tenant_id_company_id_idx";
ALTER INDEX "commerce_tax_exemptions_tenant_id_b2b_account_id_idx"    RENAME TO "commerce_tax_exemptions_tenant_id_company_id_idx";
ALTER INDEX "billing_documents_tenant_id_b2b_account_id_idx"          RENAME TO "billing_documents_tenant_id_company_id_idx";
ALTER INDEX "b2b_fleet_holds_tenant_id_b2b_account_id_status_idx"     RENAME TO "b2b_fleet_holds_tenant_id_company_id_status_idx";
ALTER INDEX "bookings_tenant_id_b2b_account_id_idx"                   RENAME TO "bookings_tenant_id_company_id_idx";

-- `crm_tickets_account_idx` and `contract_prices_unique` were already
-- hand-named and carry no `b2b_account` in them, so they stay as they are.

-- `customers.company` is FREE TEXT — the employer someone typed into a checkout
-- form, which exists on contacts that have no company record and never will. It
-- is not the same fact as `customers.company_id`, and once the second one is
-- called "company" the first one needs its own name.
--
-- `company_name` is what it always was. The API field, the segment source
-- (`customer.company`), the scoring path and the CSV import header all KEEP the
-- key `company` — those are a tenant's stored vocabulary, and renaming them
-- would rewrite saved segments and break every import mapping anyone has made
-- to fix a name nobody outside the schema ever sees.
ALTER TABLE "customers" RENAME COLUMN "company" TO "company_name";

COMMENT ON COLUMN "customers"."company_name" IS
  'Free-text employer as given by the contact. The LINKED company record is company_id — the two disagree routinely and that is not a bug (docs/144 §11).';

-- The two B2B-module join tables keep their names on purpose. A
-- `b2b_account_contact` is not "a company's contact" — it is a buyer authorised
-- to trade on an account, with a purchase limit and an approver. The trading
-- relationship keeps the trading vocabulary; only the COMPANY was renamed.

-- ══════════════════════════════════════════════════════════════════════════
-- 4. CRM workspace settings
-- ══════════════════════════════════════════════════════════════════════════
--
-- One row per (tenant, site) holding the CRM preferences that are decisions
-- rather than data: whether to offer domain association, and how duplicates are
-- matched. Site-scoped per docs/131 — two unrelated businesses under one owner
-- will not agree on what counts as the same person.
--
-- Every column has a default, so a tenant with no row behaves as the defaults
-- say. That is deliberate: the surface can render before anything is saved.
CREATE TABLE "crm_settings" (
  "id"                        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"                 UUID        NOT NULL,
  "property_id"               UUID,

  -- OFF by default. Silent auto-association is how CRM data gets quietly wrong,
  -- and even OFFERING it is a choice a business should make rather than find
  -- already made (docs/144 §11).
  "domain_association"        BOOLEAN     NOT NULL DEFAULT false,

  -- Which signals mean "same person". Defaults to what the duplicate scanner
  -- already did before it was configurable.
  "duplicate_match_rules"     TEXT[]      NOT NULL DEFAULT '{email,name_company}',

  -- Above this confidence (0-100) a duplicate pair may be merged without a
  -- person looking. NULL = never, which is the default and the safe answer:
  -- merging is irreversible.
  "auto_merge_threshold"      INTEGER,

  "created_at"                TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "crm_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_settings_auto_merge_threshold_check"
    CHECK ("auto_merge_threshold" IS NULL
           OR ("auto_merge_threshold" >= 50 AND "auto_merge_threshold" <= 100)),
  CONSTRAINT "crm_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "crm_settings_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
);

-- NULLS NOT DISTINCT so the tenant-wide row (property_id IS NULL) is covered by
-- the same uniqueness as every site row — otherwise a tenant accumulates several
-- "tenant-wide" settings rows and the one that wins is whichever was read first.
CREATE UNIQUE INDEX "crm_settings_tenant_property_unique"
  ON "crm_settings" ("tenant_id", "property_id") NULLS NOT DISTINCT;

ALTER TABLE "crm_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "crm_settings"
  USING ("tenant_id" = current_tenant_id());
