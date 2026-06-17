import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { authPrisma } from './prisma';
import { publishAuthEmail } from './email-events';
import { finalizeOAuthSignup, provisionTenantForOAuth } from './oauth-provisioning';

// sparx Better Auth server instance. One per process — same caching strategy
// as @sparx/db's prisma client so dev HMR does not leak adapters.
//
// Schema dependencies (packages/db/prisma/schema.prisma):
//   - User has sparx extensions `tenantId` + `role` exposed via additionalFields
//   - Session / Account / Verification shapes match Better Auth's expectations
//
// The organization plugin (docs/16 §2) is intentionally NOT enabled yet — it
// would need an Organization/Member/Invitation table set the data layer has not
// landed. Tenant context is carried on User.tenantId until then.

declare global {
  var __sparxAuth: ReturnType<typeof createAuth> | undefined;
}

function createAuth() {
  // Google OAuth is opt-in via env — the provider is only registered when both
  // creds are present, so the social button stays inert until the OAuth app +
  // Secret Manager values exist. Redirect URI in Google Console:
  // `${BETTER_AUTH_URL}/api/auth/callback/google`.
  const googleId = process.env.GOOGLE_CLIENT_ID;
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    appName: 'sparx',
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
    secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(authPrisma, { provider: 'postgresql' }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      autoSignIn: true,
      sendResetPassword: async ({ user, url }) => {
        // Publish an `email.send` Pub/Sub event — email-worker pulls it,
        // renders via @sparx/email, and relays through the active provider.
        // No direct send here so signin/reset latency is decoupled from
        // Postal availability. See CLAUDE.md → "Outbound email".
        //
        // tenantId is added at runtime via `additionalFields` above but
        // Better Auth's User typing doesn't surface custom fields in the
        // callback signature; cast through unknown to read it.
        const extras = user as unknown as { tenantId?: string };
        await publishAuthEmail({
          tenantId: extras.tenantId ?? '',
          actorId: user.id,
          template: 'password-reset',
          to: user.email,
          props: {
            name: user.name ?? undefined,
            resetUrl: url,
            expiresInMinutes: 60,
          },
        });
      },
    },

    // Verify-but-don't-block (docs: auth pages redesign Slice 2). We keep
    // `requireEmailVerification: false` above so a fresh signup is auto-signed-in
    // and lands in onboarding immediately (the "live in 5 minutes" goal). The
    // verification email is still sent (triggered explicitly after signUpMerchant,
    // since our signup bypasses Better Auth's own signUpEmail), a banner nudges in
    // the dashboard, and sensitive actions gate on `emailVerified`. Same platform
    // path as password-reset: publish `email.send`, email-worker renders + relays.
    emailVerification: {
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const extras = user as unknown as { tenantId?: string };
        await publishAuthEmail({
          tenantId: extras.tenantId ?? '',
          actorId: user.id,
          template: 'email-verification',
          to: user.email,
          props: {
            name: user.name ?? undefined,
            verifyUrl: url,
            expiresInMinutes: 60,
          },
        });
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    user: {
      additionalFields: {
        tenantId: {
          type: 'string',
          required: true,
          input: false,
        },
        role: {
          type: 'string',
          required: false,
          defaultValue: 'editor',
          input: false,
        },
      },
    },

    ...(googleId && googleSecret
      ? {
          socialProviders: {
            google: { clientId: googleId, clientSecret: googleSecret },
          },
        }
      : {}),

    account: {
      // Link a Google sign-in to an existing user when the verified email
      // matches — so an email/password user who later clicks "Continue with
      // Google" lands on their existing tenant instead of spawning a duplicate.
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
      },
    },

    databaseHooks: {
      user: {
        create: {
          // OAuth signups: Better Auth creates the user itself, but
          // `User.tenantId` is required — mint a tenant here and inject the id.
          // (Our email/password path uses signUpMerchant directly and never
          // hits this hook; account-LINKING fires `account.create`, not
          // `user.create`, so this only runs for genuinely new social users.)
          before: async (user) => {
            const extras = user as unknown as { tenantId?: string };
            if (extras.tenantId) return;
            const email = (user as { email?: string }).email;
            if (!email) return;
            const name = (user as { name?: string | null }).name ?? null;
            const tenantId = await provisionTenantForOAuth({ email, name });
            return { data: { ...user, tenantId, role: 'owner' } };
          },
          after: async (user) => {
            const u = user as unknown as {
              id: string;
              tenantId?: string;
              email?: string;
              name?: string | null;
            };
            if (!u.tenantId || !u.email) return;
            await finalizeOAuthSignup({
              userId: u.id,
              tenantId: u.tenantId,
              email: u.email,
              name: u.name ?? null,
            });
          },
        },
      },
    },

    advanced: {
      database: { generateId: false },
    },

    plugins: [nextCookies()],
  });
}

// Construct the Better Auth server lazily, on first property access — NOT at
// module-evaluation time. Importing `@sparx/auth` for a utility (e.g.
// `isModuleEnabled` from ./module-gate) pulls this module in via the barrel;
// eager construction would call betterAuth() — which throws in production when
// BETTER_AUTH_SECRET is unset — and crash workers that never touch auth at all
// (e.g. commerce-indexer reaches here through @sparx/commerce → @sparx/crm).
// The Proxy is transparent: every `auth.api.*` / `auth.handler` / `auth.$context`
// access resolves against the same cached instance, so consumers are unchanged.
let cachedAuth: ReturnType<typeof createAuth> | undefined = globalThis.__sparxAuth;

function getAuth(): ReturnType<typeof createAuth> {
  if (cachedAuth) return cachedAuth;
  cachedAuth = createAuth();
  // Survive dev HMR without leaking adapters (mirrors @sparx/db's prisma client).
  if (process.env.NODE_ENV !== 'production') globalThis.__sparxAuth = cachedAuth;
  return cachedAuth;
}

export const auth = new Proxy({} as ReturnType<typeof createAuth>, {
  get: (_target, prop) => (getAuth() as Record<string | symbol, unknown>)[prop],
  has: (_target, prop) => prop in (getAuth() as object),
});

export type Auth = ReturnType<typeof createAuth>;
