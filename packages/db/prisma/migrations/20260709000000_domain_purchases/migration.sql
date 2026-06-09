-- Domain Purchase — Phase 1 schema (docs/24 §7, docs/64 Module 1 Ph1).
--
-- 1. Extend `domains` with the two reseller columns deferred from
--    20260629000000_domains: `whois_privacy` and `renewal_price_cents`. Also
--    adds `dkim_public_key` and `dkim_private_key` to hold the per-domain DKIM
--    keypair generated at purchase time (the public key goes into the DKIM TXT
--    record; the private key is kept for outbound email signing).
--
-- 2. New `domain_purchases` table: an append-only audit and billing ledger for
--    every registration, renewal, and transfer processed through Sparx's
--    GoDaddy reseller account. Tenant-scoped with FORCE RLS.
--
-- NOTE: `domains` itself remains a NON-RLS dispatch table (docs/24 §1). The
-- sensitive billing record lives in `domain_purchases` which IS FORCE-RLS.
-- The DKIM private key on `domains` is also implicitly protected — `domains`
-- is only readable by authenticated tenants (management routes filter by
-- tenant_id in the app layer, exactly as the `tenants` table is managed).

-- ── 1. Extend domains ────────────────────────────────────────────────────────

ALTER TABLE "domains"
  ADD COLUMN IF NOT EXISTS "whois_privacy"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "renewal_price_cents"  INTEGER,
  ADD COLUMN IF NOT EXISTS "dkim_public_key"      TEXT,
  ADD COLUMN IF NOT EXISTS "dkim_private_key"     TEXT;

-- ── 2. domain_purchases ──────────────────────────────────────────────────────

CREATE TABLE "domain_purchases" (
    "id"                       UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"                UUID         NOT NULL,
    -- The FQDN that was registered / renewed (denormalised for fast queries and
    -- to survive the domain row being deleted post-transfer).
    "domain"                   VARCHAR(255) NOT NULL,
    "registrar"                VARCHAR(50)  NOT NULL DEFAULT 'godaddy',
    -- Returned by GoDaddy POST /v1/domains/purchase or POST .../renew.
    "registrar_order_id"       VARCHAR(255),
    -- Stubbed until Stripe billing lands; non-null once wired.
    "stripe_payment_intent_id" VARCHAR(255),
    "amount_cents"             INTEGER      NOT NULL,
    "years"                    SMALLINT     NOT NULL DEFAULT 1,
    -- registration | renewal | transfer
    "type"                     VARCHAR(20)  NOT NULL DEFAULT 'registration',
    -- pending | completed | failed
    "status"                   VARCHAR(20)  NOT NULL DEFAULT 'pending',
    "created_at"               TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_purchases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "domain_purchases_tenant_id_idx"     ON "domain_purchases"("tenant_id");
CREATE INDEX "domain_purchases_domain_idx"        ON "domain_purchases"("domain");
CREATE INDEX "domain_purchases_tenant_domain_idx" ON "domain_purchases"("tenant_id", "domain");

ALTER TABLE "domain_purchases"
    ADD CONSTRAINT "domain_purchases_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. RLS — ENABLE + FORCE on domain_purchases ──────────────────────────────

ALTER TABLE "domain_purchases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "domain_purchases" FORCE  ROW LEVEL SECURITY;
CREATE POLICY domain_purchases_tenant_isolation ON "domain_purchases"
    AS PERMISSIVE FOR ALL
    USING  (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Drop the table-level DEFAULT on updated_at — Prisma's @updatedAt manages it
-- and leaving the default in place causes `prisma migrate diff` drift.
ALTER TABLE "domain_purchases" ALTER COLUMN "updated_at" DROP DEFAULT;
