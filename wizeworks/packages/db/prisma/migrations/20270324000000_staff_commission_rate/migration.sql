-- Staff commission: the rate to calculate from, and who the sale belongs to.
--
-- docs/149 §10 listed "a commission surface" as still-to-build and said the
-- calculation was the missing piece rather than the screen. It was missing for
-- two concrete reasons, and both are schema:
--
--   1. `staff_pay_rates.basis` already accepted 'commission', but there was no
--      PERCENTAGE anywhere. `amount_cents` is per-hour under 'hourly' and per
--      YEAR under 'salary', so 'commission' was a basis the model could name and
--      could not describe.
--
--   2. An `Order` carries no salesperson. None. A `Deal` has `assigned_rep_id`,
--      but nothing on an order says who sold it, so an order could never earn
--      anyone a commission whatever the rate said.
--
-- Directory name sorts after 20270323000000_tenant_platform_brand, per the
-- monotonic-name rule in packages/db/CLAUDE.md.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. The rate
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE "staff_pay_rates"
  ADD COLUMN "commission_percent" DECIMAL(6,3) NOT NULL DEFAULT 0;

-- Non-zero only where it means something. Mirrors `staff_pay_rates_amount_check`,
-- which pins `amount_cents` to zero under 'none' for the same reason: a rate left
-- on the wrong basis must not keep a stale figure that some future deriver reads.
--
-- The ceiling is 100 because this is a percentage OF a sale. A commission above
-- the sale itself is a typo every time, and catching it here is much cheaper than
-- explaining a negative-margin job later.
ALTER TABLE "staff_pay_rates"
  ADD CONSTRAINT "staff_pay_rates_commission_check" CHECK (
    "commission_percent" >= 0
    AND "commission_percent" <= 100
    AND ("basis" = 'commission' OR "commission_percent" = 0)
  );

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Who sold it
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "staff_sale_attributions" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"       UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,
    "property_id"     UUID,
    "source_type"     VARCHAR(20) NOT NULL,
    "source_id"       UUID NOT NULL,
    "note"            TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staff_sale_attributions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staff_sale_attributions"
  ADD CONSTRAINT "staff_sale_attributions_source_check" CHECK (
    "source_type" IN ('order','deal')
  );

ALTER TABLE "staff_sale_attributions"
  ADD CONSTRAINT "staff_sale_attributions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "staff_sale_attributions"
  ADD CONSTRAINT "staff_sale_attributions_staff_member_id_fkey"
  FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE CASCADE;
ALTER TABLE "staff_sale_attributions"
  ADD CONSTRAINT "staff_sale_attributions_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;

-- ONE seller per sale. Split commissions are a real arrangement and a real
-- design — a share per row, a rule for shares that do not total 100%, and a UI
-- that can express both. Without this unique, "several rows" would silently pay
-- each named person the FULL commission.
CREATE UNIQUE INDEX "staff_sale_attributions_tenant_source_unique"
  ON "staff_sale_attributions" ("tenant_id", "source_type", "source_id");
CREATE INDEX "staff_sale_attributions_tenant_member_idx"
  ON "staff_sale_attributions" ("tenant_id", "staff_member_id");

ALTER TABLE "staff_sale_attributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_sale_attributions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "staff_sale_attributions"
  USING ("tenant_id" = current_tenant_id());

-- No backfill. There is nothing to backfill FROM: no order has ever recorded a
-- salesperson, and inventing an attribution from, say, whoever last touched the
-- record would put a number in somebody's commission that no human agreed to.
-- Existing sales stay unattributed, which reads correctly as "nobody was
-- credited" rather than as a guess.
