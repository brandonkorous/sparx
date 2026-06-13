import { LEGAL_DOC_VERSIONS, ONBOARDING_LEGAL_DOCS } from '@sparx/legal';
import { authPrisma } from './prisma';
import { generateUniqueTenantSlug, provisionTenant, workspaceNameFor } from './provision-tenant';

// Tenant provisioning for the Google OAuth path. Better Auth creates the User
// row itself for a social signup, but `User.tenantId` is required — so we mint
// the tenant in the `user.create.before` hook and inject the id, then record
// legal acceptance in `after` once the user id exists. Both reuse the shared
// provisionTenant() so the Google path lands the same tenant + primary property
// + subdomain as email/password signup, and the onboarding wizard takes over.

/**
 * Provision a placeholder tenant for a brand-new OAuth user (generated friendly
 * slug + display name derived from their profile). Returns the tenant id to
 * stamp onto the user. Runs in its own transaction; the user insert that follows
 * is Better Auth's, so a failure there could orphan this tenant — acceptable and
 * rare (vs. the alternative of a nullable tenantId breaking the RLS invariant).
 */
export async function provisionTenantForOAuth(input: {
  email: string;
  name?: string | null;
}): Promise<string> {
  const slug = await generateUniqueTenantSlug(authPrisma);
  const result = await authPrisma.$transaction((tx) =>
    provisionTenant(tx, {
      slug,
      name: workspaceNameFor(input.name),
      email: input.email.trim().toLowerCase(),
    })
  );
  return result.tenantId;
}

/**
 * Record platform legal acceptance for an OAuth signup. Consent is captured via
 * clickwrap on the "Continue with Google" button ("By continuing you agree to
 * …"), so reaching here means the owner accepted. Sets the tenant RLS GUC so the
 * FORCE-RLS insert passes. No request context in the hook → ip/ua are null.
 */
export async function recordOAuthLegalAcceptance(input: {
  tenantId: string;
  userId: string;
}): Promise<void> {
  await authPrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${input.tenantId}::text, true)`;
    await tx.platformLegalAcceptance.createMany({
      data: ONBOARDING_LEGAL_DOCS.map((docType) => ({
        tenantId: input.tenantId,
        userId: input.userId,
        docType,
        docVersion: LEGAL_DOC_VERSIONS[docType].version,
        ipAddress: null,
        userAgent: null,
      })),
    });
  });
}
