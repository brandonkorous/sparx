// Required columns on Better Auth's tables that sparx fills in, declared to
// Better Auth so its schema check counts them as written.
//
// Better Auth 1.7 compares its tables with the Prisma schema before its first
// database call. A required column with no default that it does not know about
// is, to it, a column every insert will leave out, so it refuses to run at all:
// each request that touches auth throws "Prisma schema mismatch". That took down
// both Piggles sign-in apps when 1.7 shipped. Two columns trip it:
//
//   • jwks.platformBrand: brand-scoped-prisma.ts stamps it on every create, so
//     an insert never leaves it out.
//   • tenant.email: the tenant IS the organization, and sparx creates tenants
//     itself (signUpMerchant, OAuth provisioning). The organization plugin is
//     configured never to create one (`allowUserToCreateOrganization: false`).
//
// `input: false` keeps both out of any client payload, and `required: false`
// because the guarantee is the one above, not a value Better Auth supplies; the
// same shape as `user.additionalFields.platformBrand` in server.ts.
//
// The `jwt()` plugin only lets a field be renamed, not added, so this is a plugin
// of its own: Better Auth merges every plugin's fields for a table by its key.
// `modelName` must be repeated, because the merge takes the LAST plugin's name
// and `organization` would otherwise lose its mapping onto `tenant`.
//
// schema-check.test.ts runs Better Auth's own check on the real configuration.

import type { BetterAuthPlugin } from 'better-auth';

const sparxFilled = { type: 'string', required: false, input: false } as const;

export function authOwnedColumns(): BetterAuthPlugin {
  return {
    id: 'sparx-auth-owned-columns',
    schema: {
      jwks: {
        modelName: 'jwks',
        fields: { platformBrand: sparxFilled },
      },
      organization: {
        modelName: 'tenant',
        fields: { email: sparxFilled },
      },
    },
  };
}
