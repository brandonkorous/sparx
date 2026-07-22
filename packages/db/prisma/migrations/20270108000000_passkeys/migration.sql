-- WebAuthn passkeys (Better Auth `@better-auth/passkey` plugin, docs/16 §3.5).
--
-- Per-user credential store, no tenant_id — same class as sessions/accounts.
-- ENABLE RLS with a user_isolation policy, but deliberately NO FORCE: passkey
-- AUTHENTICATION resolves a credential by credential_id BEFORE any session or
-- user_id context exists, so the auth service (sparx_owner) must bypass the
-- policy to read it. sparx_app cannot bypass and stays row-filtered.

-- CreateTable
CREATE TABLE "passkeys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255),
    "public_key" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "credential_id" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "device_type" VARCHAR(50) NOT NULL,
    "backed_up" BOOLEAN NOT NULL DEFAULT false,
    "transports" TEXT,
    "aaguid" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "passkeys_credential_id_key" ON "passkeys"("credential_id");

-- CreateIndex
CREATE INDEX "passkeys_user_id_idx" ON "passkeys"("user_id");

-- AddForeignKey
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security — user-keyed, NO FORCE (see header; mirrors sessions/accounts).
ALTER TABLE "passkeys" ENABLE ROW LEVEL SECURITY;

CREATE POLICY passkeys_user_isolation ON "passkeys"
    AS PERMISSIVE FOR ALL
    USING (user_id = current_user_id())
    WITH CHECK (user_id = current_user_id());
