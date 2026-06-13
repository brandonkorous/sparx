import { LEGAL_DOC_VERSIONS, ONBOARDING_LEGAL_DOCS } from '@sparx/legal';
import { authPrisma } from './prisma';
import { auth } from './server';
import {
  provisionTenant,
  generateUniqueTenantSlug,
  type SignUpAcquisition,
} from './provision-tenant';

// Tenant self-service signup. Better Auth's stock `signUpEmail` assumes one
// user = one account. Sparx needs each new tenant to also get a Tenant row (+
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
}

export interface SignUpMerchantResult {
  ok: true;
  userId: string;
  tenantId: string;
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

// A readable placeholder workspace name from the person's first name —
// "Brandon's workspace". The user renames it (and the generated slug) in the
// onboarding Workspace step, by which point they know what they're building.
function workspaceNameFor(personName: string): string {
  // Caller guarantees a non-empty trimmed name, so [0] is always a real token;
  // ?? only guards the TS `string | undefined` index type.
  const first = personName.trim().split(/\s+/)[0] ?? 'My';
  return `${first}'s workspace`;
}

export async function signUpMerchant(input: SignUpMerchantInput): Promise<SignUpMerchantResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (!name) {
    throw new SignUpError('INVALID_INPUT', 'Your name is required.');
  }

  // Email must be globally unique — Better Auth's sign-in queries by email
  // alone, so duplicates produce ambiguous lookups (and historically caused
  // "Invalid password hash" failures matching an older row). The DB also
  // enforces this; pre-checking gives the caller a clean typed error.
  const existingUser = await authPrisma.user.findFirst({
    where: { email },
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
      });

      const user = await tx.user.create({
        data: {
          email,
          name,
          emailVerified: false,
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

      // Record acceptance of Sparx's platform legal docs (docs/42 §6) atomically
      // with account creation — the sign-up form gates on the agreement
      // checkbox, so reaching here means the owner accepted. DPA is EU-only and
      // handled post-onboarding, so it's not in ONBOARDING_LEGAL_DOCS.
      await tx.platformLegalAcceptance.createMany({
        data: ONBOARDING_LEGAL_DOCS.map((docType) => ({
          tenantId: provisioned.tenantId,
          userId: user.id,
          docType,
          docVersion: LEGAL_DOC_VERSIONS[docType].version,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        })),
      });

      return { userId: user.id, tenantId: provisioned.tenantId };
    });

    // Welcome email is fire-and-forget via Pub/Sub — email-worker pulls the
    // event and handles the send. A Pub/Sub outage must never roll back an
    // otherwise successful sign-up, so we log + swallow. Greets the person; the
    // workspace name is still the placeholder at this point.
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
          storeName: tenantName,
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
      const target = (err as { meta?: { target?: string[] } }).meta?.target ?? [];
      if (target.includes('email')) {
        throw new SignUpError('EMAIL_TAKEN', 'An account with that email already exists.');
      }
      if (target.includes('slug')) {
        // Astronomically rare (the slug was just confirmed free) — a concurrent
        // signup grabbed the same generated slug between check and insert.
        throw new SignUpError('SLUG_TAKEN', 'Please try again.');
      }
    }
    throw err;
  }
}
