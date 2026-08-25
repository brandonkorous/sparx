import { acceptanceRows } from '@wizeworks/legal';
import { currentPlatformBrand } from '@wizeworks/brand-core';
import { authPrisma } from './prisma';
import { auth } from './server';
import {
  provisionTenant,
  generateUniqueTenantSlug,
  workspaceNameFor,
  type SignUpAcquisition,
} from './provision-tenant';

// Tenant self-service signup. Better Auth's stock `signUpEmail` assumes one
// user = one account. sparx needs each new tenant to also get a Tenant row (+
// primary property + `<slug>.sparx.zone` subdomain), so we do those writes
// ourselves via provisionTenant() and let Better Auth handle session creation
// via signIn afterwards. The same provisionTenant() backs the Google OAuth path,
// so both account-creation paths land a tenant the onboarding wizard can refine.

// Re-exported for callers that built an acquisition snapshot before the type
// moved into provision-tenant.
export type { SignUpAcquisition };

export interface SignUpMerchantInput {
  email: string;
  password: string;
  /** The person's name. The tenant gets a derived placeholder display name. */
  name: string;
  /** Captured from the sign-up request for the legal-acceptance record
   *  (docs/42 §6). Null when unavailable (e.g. a non-HTTP caller). */
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Marketing attribution (docs/80 §6.1) — the first-party acquisition snapshot
   *  read from the attribution cookies at signup. Null when absent or unconsented. */
  acquisition?: SignUpAcquisition | null;
  /** Which product the account is being created under. Passed straight through
   *  to provisionTenant — see the note there on why this is a parameter and
   *  never a conditional. Defaults to `sparx`. */
  platformBrand?: string;
  /** Zone for the tenant's always-on subdomain. Passed through; defaults to
   *  `SPARX_ZONE_DOMAIN`. Piggles passes `piggles.site`. */
  zoneDomain?: string;
}

export interface SignUpMerchantResult {
  ok: true;
  userId: string;
  tenantId: string;
}

/**
 * Did this P2002 come from the email uniqueness rule?
 *
 * Prisma reports the violated index in `meta.target`, and the shape varies: a
 * field list for an unnamed constraint, the mapped NAME for one that carries a
 * `map`, and occasionally a bare string rather than an array. Since the rule
 * became `@@unique([platformBrand, email], map: "users_brand_email_unique")`,
 * the old `target.includes('email')` was one Prisma release away from silently
 * answering "no" — and the cost of that is not an outage, it is a person being
 * shown "something went wrong at our end" for an address that is simply already
 * taken. So every shape it can arrive in is accepted.
 */
export function isEmailUniqueViolation(target: unknown): boolean {
  const parts = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
  return parts.some((p) => typeof p === 'string' && (p === 'email' || p.includes('email')));
}

export class SignUpError extends Error {
  constructor(
    public code: 'EMAIL_TAKEN' | 'SLUG_TAKEN' | 'INVALID_INPUT',
    message: string
  ) {
    super(message);
    this.name = 'SignUpError';
  }
}

export async function signUpMerchant(input: SignUpMerchantInput): Promise<SignUpMerchantResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!name) {
    throw new SignUpError('INVALID_INPUT', 'Your name is required.');
  }

  // The brand this account is being created under. Declared by the caller —
  // never inferred here — for the same reason provisionTenant takes it as a
  // parameter: both brands run in the same processes, so anything read from the
  // environment would be right for one of them and wrong for the other.
  const platformBrand = input.platformBrand ?? currentPlatformBrand();

  // Email must be unique WITHIN THE BRAND, not across the platform. Scoping this
  // check is what lets one person hold an account on each product under the same
  // address — without it, signing up on the second brand is refused as
  // EMAIL_TAKEN by an account they cannot sign in to from here, which is a dead
  // end with no way out but a different email address.
  //
  // The DB enforces the same rule (`users_brand_email_unique`); pre-checking
  // gives the caller a clean typed error instead of a P2002.
  const existingUser = await authPrisma.user.findFirst({
    where: { email, platformBrand },
    select: { id: true },
  });
  if (existingUser) {
    throw new SignUpError('EMAIL_TAKEN', 'An account with that email already exists.');
  }

  // Generated friendly slug + derived display name — the user personalizes both
  // in the onboarding Workspace step. No store name is asked for at signup.
  const slug = await generateUniqueTenantSlug(authPrisma);
  const tenantName = workspaceNameFor(name);

  // Better Auth's password hasher (scrypt by default; configurable to Argon2).
  // Going through $context keeps us aligned with whatever the auth instance is
  // configured to use — no risk of mismatched hashes at sign-in time.
  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(input.password);

  try {
    const { userId, tenantId } = await authPrisma.$transaction(async (tx) => {
      const provisioned = await provisionTenant(tx, {
        slug,
        name: tenantName,
        email,
        acquisition: input.acquisition ?? null,
        platformBrand,
        zoneDomain: input.zoneDomain,
      });

      // Written through the plain client, so the brand is set explicitly here —
      // the proxy in brand-scoped-prisma.ts only covers what Better Auth's own
      // adapter does, and this transaction deliberately is not that.
      const user = await tx.user.create({
        data: {
          email,
          name,
          emailVerified: false,
          platformBrand,
          tenantId: provisioned.tenantId,
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

      // The owner membership (docs/114 §A.2). Makes the user a member of their own
      // org (org == tenant) so the client-accounts list, the Team view, and
      // active-org resolution all see it. Every future team member / consultant is
      // added as another `members` row.
      await tx.member.create({
        data: {
          organizationId: provisioned.tenantId,
          userId: user.id,
          role: 'owner',
          memberType: 'owner',
          status: 'active',
        },
      });

      // Record acceptance of THIS BRAND's legal docs (docs/42 §6) atomically
      // with account creation — the sign-up form gates on the agreement
      // checkbox, so reaching here means the owner accepted.
      //
      // Keyed by brand, and that is load-bearing rather than tidy: this used to
      // write sparx's versions for every tenant, so a Piggles owner who agreed
      // to the Piggles terms on meetpiggles.com got a row saying they accepted
      // sparx's — plus an acceptable-use policy Piggles does not publish. An
      // acceptance record naming a document the person never saw is evidence of
      // the wrong thing while looking like evidence of the right one.
      //
      // The DPA is in neither brand's list: it is EU-only (docs/16 §10) and
      // offered after onboarding, because an addendum nobody read is not one.
      await tx.platformLegalAcceptance.createMany({
        data: acceptanceRows(input.platformBrand).map((row) => ({
          tenantId: provisioned.tenantId,
          userId: user.id,
          docType: row.docType,
          docVersion: row.docVersion,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        })),
      });

      return { userId: user.id, tenantId: provisioned.tenantId };
    });

    // Welcome email is fire-and-forget via Pub/Sub — email-worker pulls the
    // event and handles the send. A Pub/Sub outage must never roll back an
    // otherwise successful sign-up, so we log + swallow. Greets the PERSON only —
    // no site/tenant name (a tenant has many sites, named later; docs/49).
    try {
      const dashboardUrl =
        (process.env.BETTER_AUTH_URL ?? 'http://localhost:3001').replace(/\/$/, '') + '/welcome';
      const { publishAuthEmail } = await import('./email-events');
      await publishAuthEmail({
        tenantId,
        actorId: userId,
        template: 'welcome-merchant',
        to: email,
        props: {
          name,
          dashboardUrl,
        },
      });
    } catch (err) {
      // Structured stdout JSON — GKE Cloud Logging parses `severity` + the rest
      // as labels, so this is greppable in Logs Explorer without dragging pino
      // into the Next.js server bundle for one log line.
      process.stderr.write(
        JSON.stringify({
          severity: 'ERROR',
          source: 'auth.sign-up',
          message: 'welcome email publish failed',
          tenantId,
          userId,
          err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
        }) + '\n'
      );
    }

    // Verification email — verify-but-don't-block (Slice 2). Our signup bypasses
    // Better Auth's own signUpEmail (we write the rows + provision the tenant
    // ourselves), so `sendOnSignUp` never fires; trigger it explicitly here. The
    // `emailVerification.sendVerificationEmail` callback publishes the `email.send`
    // event. Fire-and-forget: a hiccup must not roll back an otherwise good signup
    // (the user can resend from the dashboard banner).
    try {
      await auth.api.sendVerificationEmail({
        body: { email, callbackURL: '/verify-email' },
      });
    } catch (err) {
      process.stderr.write(
        JSON.stringify({
          severity: 'ERROR',
          source: 'auth.sign-up',
          message: 'verification email trigger failed',
          tenantId,
          userId,
          err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
        }) + '\n'
      );
    }

    // tenant.created → legal-seed worker seeds starter legal pages + footer
    // placements (docs/42 §3). Fire-and-forget, same swallow ethos as above.
    try {
      const { publishTenantCreated } = await import('./tenant-events');
      await publishTenantCreated({ tenantId, actorId: userId, slug, name: tenantName });
    } catch (err) {
      process.stderr.write(
        JSON.stringify({
          severity: 'ERROR',
          source: 'auth.sign-up',
          message: 'tenant.created publish failed',
          tenantId,
          userId,
          err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
        }) + '\n'
      );
    }

    return { ok: true, userId, tenantId };
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      const target = (err as { meta?: { target?: unknown } }).meta?.target;
      if (isEmailUniqueViolation(target)) {
        throw new SignUpError('EMAIL_TAKEN', 'An account with that email already exists.');
      }
      if (Array.isArray(target) && target.includes('slug')) {
        // Astronomically rare (the slug was just confirmed free) — a concurrent
        // signup grabbed the same generated slug between check and insert.
        throw new SignUpError('SLUG_TAKEN', 'Please try again.');
      }
    }
    throw err;
  }
}
