-- Two-step verification lockout columns (Better Auth 1.6.33's twoFactor plugin).
--
-- WW-5 moved better-auth from 1.6.11 to 1.6.33. That release counts wrong codes
-- per enrollment and locks the enrollment for a while after too many, so the
-- plugin's schema grew two fields: `failedVerificationCount` and `lockedUntil`.
-- Every verify writes them — a wrong code increments the count, a right one
-- resets it — so without the columns BOTH outcomes fail with 42703 and no
-- enrolled operator can finish signing in to the console.
--
-- Same two columns on both instances' tables. The operator table keeps Better
-- Auth's quoted camelCase like the rest of wize_admin; the tenant table maps to
-- snake_case like the rest of the auth models (03-auth-twofactor.prisma).
-- Existing rows start unlocked with no failures, which is what the plugin's own
-- defaults would have given them.

ALTER TABLE "wize_admin"."platform_operator_two_factors"
  ADD COLUMN "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMPTZ;

ALTER TABLE "two_factors"
  ADD COLUMN "failed_verification_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMPTZ;
