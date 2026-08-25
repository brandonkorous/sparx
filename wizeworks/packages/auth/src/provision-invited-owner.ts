import { randomBytes } from 'node:crypto';
import { currentPlatformBrand } from '@wizeworks/brand-core';
import { authPrisma } from './prisma';
import { auth } from './server';
import { SignUpError, isEmailUniqueViolation } from './sign-up';
import { publishAuthEmail } from './email-events';
import { provisionTenant, generateUniqueTenantSlug, workspaceNameFor } from './provision-tenant';

// Admin-initiated account provisioning — the operator-approved-partner path
// (docs/114 §B.2). A partner IS a tenant, so approving an accountless applicant
// has to mint a tenant to key the `partners` row to. Two branches, one contract:
//
//   • Brand-new email → create the tenant + owner login (password-less) and email a
//     SET-PASSWORD invite (Better Auth's reset flow). Mirrors signUpMerchant minus
//     the self-chosen password + minus platform-legal acceptance (the invitee never
//     clicked the checkbox — the dashboard legal banner prompts them at first sign-in).
//   • Email already has a login → give that existing user a NEW partner workspace
//     (a fresh org they own). No new user, no password reset — they already sign in;
//     the workspace simply appears in their account switcher. This is why an existing
//     account is NOT an error: approval always lands the applicant a partner workspace.
//
// Both branches publish `tenant.created` (legal-seed etc.) and a branded
// `partner-welcome` email. Runs where Better Auth lives (the dashboard); api-rest
// reaches it through the dashboard's token-gated internal provisioning route.

export interface ProvisionInvitedOwnerInput {
  /** The invitee's email — their login within this brand (existing or new). */
  email: string;
  /** Person / business name; seeds the owner name + a placeholder workspace name. */
  name: string;
  /**
   * Which product the invitee is being provisioned into. Declared by the caller,
   * exactly as `signUpMerchant` and `provisionTenant` require it.
   *
   * It is a PARAMETER rather than something read from the environment because
   * this function decides whether an address already has a login, and that
   * question only has an answer once you say "on which product". Reading the
   * ambient brand would make this correct only in the process that happens to be
   * the same brand as the caller — which is true today, by accident, because the
   * one caller is sparx-only. Defaults to the deployment's brand so that stays
   * true rather than becoming a required change at every call site.
   */
  platformBrand?: string;
}

export interface ProvisionInvitedOwnerResult {
  ok: true;
  userId: string;
  tenantId: string;
  slug: string;
  /** True when a brand-new login was created (and a set-password invite sent);
   *  false when an existing login gained a new partner workspace. */
  createdAccount: boolean;
}

function dashboardUrl(): string {
  const base = (process.env.BETTER_AUTH_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  return `${base}/partner`;
}

export async function provisionInvitedOwner(
  input: ProvisionInvitedOwnerInput
): Promise<ProvisionInvitedOwnerResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!email) {
    throw new SignUpError('INVALID_INPUT', 'An email is required to provision an account.');
  }

  const platformBrand = input.platformBrand ?? currentPlatformBrand();

  // Scoped to the brand being provisioned into. Unscoped, this branch would hand
  // a workspace on THIS product to a login that belongs to the other one —
  // the cross-brand leak this whole change exists to close, wearing the shape of
  // a helpful "you already have an account" fast path.
  const existingUser = await authPrisma.user.findFirst({
    where: { email, platformBrand },
    select: { id: true, name: true },
  });

  const slug = await generateUniqueTenantSlug(authPrisma);
  // A person may not have supplied a name (public partner form allows email-only);
  // fall back to the email so the workspace + owner name are never blank.
  const displayName = name.length > 0 ? name : email;
  const tenantName = workspaceNameFor(displayName);

  let userId: string;
  let tenantId: string;
  const createdAccount = !existingUser;

  if (existingUser) {
    // Existing login → a new partner workspace they own. No user/credential row, no
    // set-password invite; the org just joins their account switcher.
    const provisioned = await authPrisma.$transaction(async (tx) => {
      const t = await provisionTenant(tx, {
        slug,
        name: tenantName,
        email,
        acquisition: null,
        platformBrand,
      });
      await tx.member.create({
        data: {
          organizationId: t.tenantId,
          userId: existingUser.id,
          role: 'owner',
          memberType: 'owner',
          status: 'active',
        },
      });
      return t;
    });
    userId = existingUser.id;
    tenantId = provisioned.tenantId;
  } else {
    // Brand-new login. A random, discarded password seeds the credential row purely
    // so Better Auth's reset flow has something to overwrite (via $context to match
    // the configured hasher); the invitee sets the real one via the emailed link.
    const ctx = await auth.$context;
    const passwordHash = await ctx.password.hash(randomBytes(32).toString('base64url'));
    try {
      const provisioned = await authPrisma.$transaction(async (tx) => {
        const t = await provisionTenant(tx, {
          slug,
          name: tenantName,
          email,
          acquisition: null,
          platformBrand,
        });
        const user = await tx.user.create({
          data: {
            email,
            name: displayName,
            emailVerified: false,
            platformBrand,
            tenantId: t.tenantId,
            role: 'owner',
          },
        });
        await tx.account.create({
          data: {
            userId: user.id,
            providerId: 'credential',
            accountId: user.id,
            password: passwordHash,
          },
        });
        await tx.member.create({
          data: {
            organizationId: t.tenantId,
            userId: user.id,
            role: 'owner',
            memberType: 'owner',
            status: 'active',
          },
        });
        return { tenantId: t.tenantId, userId: user.id };
      });
      userId = provisioned.userId;
      tenantId = provisioned.tenantId;
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        const target = (err as { meta?: { target?: unknown } }).meta?.target;
        // A concurrent signup grabbed the email/slug between our check and insert.
        if (isEmailUniqueViolation(target)) {
          throw new SignUpError('EMAIL_TAKEN', 'An account with that email already exists.');
        }
        const parts = Array.isArray(target) ? target : [];
        if (parts.includes('slug')) throw new SignUpError('SLUG_TAKEN', 'Please try again.');
      }
      throw err;
    }

    // The set-password invite — Better Auth mints a scoped reset token and its
    // sendResetPassword callback publishes the `email.send` event. Awaited so a
    // delivery failure surfaces rather than silently stranding a new invitee.
    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset-password' } });
  }

  // Branded "you're in" note (both branches). needsPassword tells new invitees to
  // expect the separate set-password email; existing users just switch workspaces.
  try {
    await publishAuthEmail({
      tenantId,
      actorId: userId,
      template: 'partner-welcome',
      to: email,
      props: {
        name: existingUser?.name ?? displayName,
        dashboardUrl: dashboardUrl(),
        needsPassword: createdAccount,
      },
    });
  } catch (err) {
    logSoftFailure('partner-welcome email publish failed', tenantId, userId, err);
  }

  // tenant.created → legal-seed worker seeds starter legal pages + footer
  // placements (docs/42 §3), same as signUpMerchant. Fire-and-forget.
  try {
    const { publishTenantCreated } = await import('./tenant-events');
    await publishTenantCreated({ tenantId, actorId: userId, slug, name: tenantName });
  } catch (err) {
    logSoftFailure('tenant.created publish failed', tenantId, userId, err);
  }

  return { ok: true, userId, tenantId, slug, createdAccount };
}

function logSoftFailure(message: string, tenantId: string, userId: string, err: unknown): void {
  process.stderr.write(
    JSON.stringify({
      severity: 'ERROR',
      source: 'auth.provision-invited-owner',
      message,
      tenantId,
      userId,
      err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
    }) + '\n'
  );
}
