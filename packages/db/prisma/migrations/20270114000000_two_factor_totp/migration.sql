-- Authenticator-app two-step verification (Better Auth `twoFactor` plugin,
-- docs/16 §2.4, §3.5).
--
-- Additive and safe to apply live: a new per-user table plus one NOT NULL
-- column on `users` with a `false` default, so every existing row backfills to
-- "two-step verification off" and no sign-in path changes for anyone who has
-- not opted in.
--
-- RLS: per-user, no tenant_id — same class as sessions/accounts/passkeys.
-- ENABLE with a user_isolation policy, deliberately NO FORCE. The second-factor
-- challenge is resolved BETWEEN the password check and session issue, so there
-- is no session for `current_user_id()` to read at that moment and the auth
-- service (sparx_owner) must bypass the policy. sparx_app cannot bypass and
-- stays row-filtered.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "two_factors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "secret" TEXT NOT NULL,
    "backup_codes" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "two_factors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "two_factors_user_id_idx" ON "two_factors"("user_id");

-- CreateIndex
CREATE INDEX "two_factors_secret_idx" ON "two_factors"("secret");

-- AddForeignKey
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security — user-keyed, NO FORCE (see header; mirrors passkeys).
ALTER TABLE "two_factors" ENABLE ROW LEVEL SECURITY;

CREATE POLICY two_factors_user_isolation ON "two_factors"
    AS PERMISSIVE FOR ALL
    USING (user_id = current_user_id())
    WITH CHECK (user_id = current_user_id());
