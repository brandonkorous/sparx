-- Payment gateway abstraction (docs/94 ADR §11). The tenant→shopper payment surface,
-- distinct from platform module billing (73-billing). All tenant-scoped + RLS.

-- Sparx Pay connected account id is now unique on the non-RLS tenants root row so the
-- public payment webhook can resolve a tenant from a connected account id (docs/94 §6).
CREATE UNIQUE INDEX "tenants_stripe_account_id_key" ON "tenants"("stripe_account_id");

-- CreateTable
CREATE TABLE "tenant_payment_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "gateway_id" VARCHAR(50) NOT NULL DEFAULT 'sparx_pay',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "credentials_ref" VARCHAR(255),
    "onboarded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_payment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "gateway_id" VARCHAR(50) NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'usd',
    "platform_fee" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "order_id" UUID,
    "billing_doc_id" UUID,
    "customer_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "gateway_id" VARCHAR(50) NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_payment_configs_tenant_id_key" ON "tenant_payment_configs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_external_unique" ON "payment_intents"("gateway_id", "external_id");

-- CreateIndex
CREATE INDEX "payment_intents_tenant_id_status_idx" ON "payment_intents"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "payment_intents_tenant_id_order_id_idx" ON "payment_intents"("tenant_id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_idempotency" ON "payment_events"("gateway_id", "external_id");

-- CreateIndex
CREATE INDEX "payment_events_tenant_id_event_type_idx" ON "payment_events"("tenant_id", "event_type");

-- AddForeignKey
ALTER TABLE "tenant_payment_configs" ADD CONSTRAINT "tenant_payment_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- updated_at triggers (set_updated_at defined in 20260527000100_rls)
CREATE TRIGGER tenant_payment_configs_set_updated_at BEFORE UPDATE ON "tenant_payment_configs" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER payment_intents_set_updated_at        BEFORE UPDATE ON "payment_intents"        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row Level Security — tenant isolation (current_tenant_id() defined in 20260527000100_rls)
ALTER TABLE "tenant_payment_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_payment_configs" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_payment_configs_tenant_isolation ON "tenant_payment_configs"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "payment_intents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_intents" FORCE  ROW LEVEL SECURITY;
CREATE POLICY payment_intents_tenant_isolation ON "payment_intents"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_events" FORCE  ROW LEVEL SECURITY;
CREATE POLICY payment_events_tenant_isolation ON "payment_events"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
