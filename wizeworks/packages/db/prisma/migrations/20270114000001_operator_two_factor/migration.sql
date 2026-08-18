-- Operator authenticator-app MFA (docs/16 §2.4, docs/apps/admin build-plan D8).
--
-- The wize_admin half of the two-step verification work: the operator console is
-- a CROSS-TENANT capability, so docs/16 requires MFA there, not merely offers it.
-- This lands the storage; `requireOperator()` in @sparx/operator-auth is what
-- makes it mandatory (an operator without an enrollment can sign in but reaches
-- only the setup screen).
--
-- Separate from the tenant instance's `two_factors` in every way — different
-- schema, different Better Auth instance, different secret — so an operator
-- enrollment and a tenant staff enrollment can never be confused. Column names
-- stay Better Auth's camelCase defaults (quoted), matching the other
-- platform_operator_* tables; no RLS here because the whole wize_admin schema is
-- reachable only by the `wize_operator` role.

-- The flag Better Auth's twoFactor plugin owns. Existing operators default to
-- false and are walked through setup on their next visit.
ALTER TABLE "wize_admin"."platform_operators"
  ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "wize_admin"."platform_operator_two_factors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    -- Base32 TOTP shared secret, encrypted at rest with OPERATOR_AUTH_SECRET.
    "secret" TEXT NOT NULL,
    -- Remaining single-use backup codes, encrypted at rest as one JSON array
    -- (storeBackupCodes: 'encrypted' on the plugin — the default is PLAIN).
    "backupCodes" TEXT NOT NULL,
    -- False between minting the secret and proving a code, so a half-finished
    -- setup never counts as protection.
    "verified" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "platform_operator_two_factors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_operator_two_factors_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "wize_admin"."platform_operators" ("id") ON DELETE CASCADE
);
CREATE INDEX "platform_operator_two_factors_userId_idx"
  ON "wize_admin"."platform_operator_two_factors" ("userId");
CREATE INDEX "platform_operator_two_factors_secret_idx"
  ON "wize_admin"."platform_operator_two_factors" ("secret");

-- Explicit, not relying on ALTER DEFAULT PRIVILEGES from the original schema
-- migration — that only covers tables created by the same role, which is not
-- guaranteed across separately-applied migrations.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON "wize_admin"."platform_operator_two_factors" TO "wize_operator";
