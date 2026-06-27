-- Bring-your-own gateway credentials (docs/111 §2). Merchant-entered API keys for
-- Square / Authorize.net / 1stPayGateway / custom gateways, AES-256-GCM encrypted in
-- the row (the @sparx/channels/crypto box) — never plaintext, never Secret Manager
-- (the app SA has no write grant; this mirrors how channel OAuth tokens + market bank
-- accounts store merchant secrets). Tenant-scoped + FORCE RLS.

-- CreateTable
CREATE TABLE "tenant_gateway_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "gateway_id" VARCHAR(50) NOT NULL,
    "environment" VARCHAR(20) NOT NULL DEFAULT 'production',
    "secret_enc" TEXT,
    "public_meta" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(20) NOT NULL DEFAULT 'unverified',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tenant_gateway_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_gateway_credentials_tenant_gateway" ON "tenant_gateway_credentials"("tenant_id", "gateway_id");

-- AddForeignKey
ALTER TABLE "tenant_gateway_credentials" ADD CONSTRAINT "tenant_gateway_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- updated_at trigger (set_updated_at defined in 20260527000100_rls)
CREATE TRIGGER tenant_gateway_credentials_set_updated_at BEFORE UPDATE ON "tenant_gateway_credentials" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row Level Security — tenant isolation (current_tenant_id() defined in 20260527000100_rls)
ALTER TABLE "tenant_gateway_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_gateway_credentials" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_gateway_credentials_tenant_isolation ON "tenant_gateway_credentials"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
