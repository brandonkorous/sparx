import { LEGAL_DOC_VERSIONS, ONBOARDING_LEGAL_DOCS } from '@sparx/legal';
import { authPrisma } from './prisma';
import { generateUniqueTenantSlug, provisionTenant, workspaceNameFor } from './provision-tenant';

// Tenant provisioning for the Google OAuth path. Better Auth creates the User
// row itself for a social signup, but `User.tenantId` is required — so we mint
// the tenant in the `user.create.before` hook (provisionTenantForOAuth) and
// inject the id, then finish the side-effects in `after` (finalizeOAuthSignup)
// once the user id exists. Both reuse the shared provisionTenant() so the Google
// path lands the same tenant + primary property + subdomain as email/password
// signup, and the onboarding wizard takes over (finishedAt is null → forced in).

function logErr(message: string, err: unknown, ctx: { tenantId: string; userId: string }): void {
  process.stderr.write(
    JSON.stringify({
      severity: 'ERROR',
      source: 'auth.oauth-provisioning',
      message,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
    }) + '\n'
  );
}

/**
 * Provision a placeholder tenant for a brand-new OAuth user (generated friendly
 * slug + display name derived from their profile). Returns the tenant id to
 * stamp onto the user. Runs in its own transaction; the user insert that follows
 * is Better Auth's, so a failure there could orphan this tenant — acceptable and
 * rare (vs. a nullable tenantId breaking the RLS invariant).
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
 * After the OAuth user row exists: record platform legal acceptance (consent
 * captured via clickwrap on the "Continue with Google" button) and publish the
 * same side-effects as email/password signup — `tenant.created` (legal-seed
 * worker) + the welcome email. All fire-and-forget: a hiccup must not break the
 * social sign-in. No request context in the hook → ip/ua are null.
 */
export async function finalizeOAuthSignup(input: {
  userId: string;
  tenantId: string;
  email: string;
  name?: string | null;
}): Promise<void> {
  const ctx = { tenantId: input.tenantId, userId: input.userId };

  try {
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
  } catch (err) {
    logErr('oauth legal acceptance failed', err, ctx);
  }

  try {
    const tenant = await authPrisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { slug: true, name: true },
    });
    if (tenant) {
      const { publishTenantCreated } = await import('./tenant-events');
      await publishTenantCreated({
        tenantId: input.tenantId,
        actorId: input.userId,
        slug: tenant.slug,
        name: tenant.name,
      });
      const { publishAuthEmail } = await import('./email-events');
      const dashboardUrl =
        (process.env.BETTER_AUTH_URL ?? 'http://localhost:3001').replace(/\/$/, '') + '/welcome';
      await publishAuthEmail({
        tenantId: input.tenantId,
        actorId: input.userId,
        template: 'welcome-merchant',
        to: input.email,
        props: { name: input.name ?? undefined, dashboardUrl },
      });
    }
  } catch (err) {
    logErr('oauth tenant.created / welcome publish failed', err, ctx);
  }
}
