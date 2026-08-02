import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins';
import { operatorPool } from './db';
import { publishOperatorEmail } from './email';

// The WizeWorks operator Better Auth instance (docs/16 §2.4, docs/apps/admin
// build-plan §2 D3). A SECOND, fully separate auth boundary from the tenant
// instance in @sparx/auth:
//
//   • Separate identity store — its own tables in the `wize_admin` schema, via
//     Better Auth's native Kysely/pg adapter over `operatorPool` (NOT Prisma,
//     NOT the tenant client). Operators are never a row in a tenant's `users`.
//   • No `tid`, no organization plugin — operators are tenant-less until they
//     read a specific tenant through api-rest /internal/operator/*.
//   • Its own secret + cookie namespace, so an operator session and a tenant
//     session can never be confused for one another.
//   • Shorter sessions + a higher password floor than the tenant instance.
//   • MFA is MANDATORY here, not optional as it is for tenant staff (docs/16
//     §2.4). The plugin is registered below; `requireOperator()` in ./next is
//     what enforces it — an operator with no enrollment can hold a session but
//     reaches nothing except the setup screen. Cloudflare Access + the IP
//     allowlist on admin.wize.works remain in front of all of it.

declare global {
  var __sparxOperatorAuth: ReturnType<typeof createOperatorAuth> | undefined;
}

function operatorSecret(): string {
  const explicit = process.env.OPERATOR_AUTH_SECRET;
  if (explicit) return explicit;
  if (process.env.NODE_ENV === 'production') {
    // Fail loud in prod — a cross-tenant console must never boot on a default
    // secret. Better Auth would also reject an empty secret, but we surface a
    // clearer message.
    throw new Error('OPERATOR_AUTH_SECRET is required in production.');
  }
  return 'dev-operator-secret-change-me-000000000000';
}

/** Better Auth's `baseURL`, which is also what it validates request origins against.
 *
 *  Unset in production is a configuration bug, exactly like the secret above.
 *  The Azure deployment shipped without OPERATOR_AUTH_URL, so this resolved to
 *  http://localhost:3002 while the console was served from
 *  https://admin.wize.works — Better Auth compared the two and rejected every
 *  sign-in with "invalid origin". The pod was healthy and the credentials were
 *  correct; only the configured origin was wrong, and the localhost default is
 *  what made that survivable enough to reach production.
 */
function operatorBaseUrl(): string {
  const url = process.env.OPERATOR_AUTH_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'OPERATOR_AUTH_URL is required in production. Better Auth validates ' +
        'request origins against it, so an unset value rejects every sign-in ' +
        'with "invalid origin". Set it to the console origin, e.g. ' +
        'https://admin.wize.works.'
    );
  }
  return 'http://localhost:3002';
}

function createOperatorAuth() {
  return betterAuth({
    appName: 'sparx-operator',
    baseURL: operatorBaseUrl(),
    secret: operatorSecret(),
    // pg Pool → Better Auth wraps it with the Kysely postgres dialect.
    database: operatorPool,

    emailAndPassword: {
      enabled: true,
      // Operators are provisioned by an existing operator (or the seed), never
      // self-signup, so email verification isn't a gate. A higher password floor
      // than the tenant instance's 8.
      requireEmailVerification: false,
      minPasswordLength: 12,
      autoSignIn: false,
      sendResetPassword: async ({ user, url }) => {
        await publishOperatorEmail({
          template: 'password-reset',
          to: user.email,
          actorId: user.id,
          props: { name: user.name ?? undefined, resetUrl: url, expiresInMinutes: 60 },
        });
      },
    },

    // Map Better Auth's core models onto the wize_admin tables. Column names
    // stay Better Auth's defaults (camelCase, quoted in the DDL) so no per-field
    // mapping is needed — see the migration.
    user: { modelName: 'platform_operators' },
    account: { modelName: 'platform_operator_accounts' },
    verification: { modelName: 'platform_operator_verifications' },
    session: {
      modelName: 'platform_operator_sessions',
      // Much shorter than the tenant instance's 30d — an operator session is a
      // cross-tenant capability, kept as short as is practical.
      expiresIn: 60 * 60 * 8, // 8h
      updateAge: 60 * 60, // refresh at most hourly
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    advanced: {
      // Distinct cookie namespace from the tenant instance (belt-and-suspenders;
      // they're on different domains anyway).
      cookiePrefix: 'sparx-operator',
    },

    plugins: [
      // Authenticator-app MFA for operators (docs/16 §2.4). Deliberately
      // STRICTER than the tenant instance's copy of this plugin:
      //   • no `allowPasswordless` — every operator is an email+password
      //     account, so enabling, disabling, or re-reading backup codes always
      //     costs the password. There is no passwordless operator to
      //     accommodate, so the looser branch is simply not offered.
      //   • its own table in wize_admin, so an operator enrollment shares
      //     nothing with a tenant staff enrollment.
      // storeBackupCodes: 'encrypted' overrides a PLAIN default — without it,
      // ten working cross-tenant recovery credentials per operator would sit
      // readable in the database.
      twoFactor({
        issuer: 'sparx operations',
        twoFactorTable: 'platform_operator_two_factors',
        skipVerificationOnEnable: false,
        totpOptions: { digits: 6, period: 30 },
        backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: 'encrypted' },
      }),
      // nextCookies() must stay LAST so it can flush Set-Cookie for the plugins
      // registered before it.
      nextCookies(),
    ],
  });
}

// Lazy Proxy (mirrors @sparx/auth): construct on first property access, not at
// module load, so importing the barrel for a capability/audit helper doesn't
// build the auth instance (which would require the secret + a DB connection).
let cached: ReturnType<typeof createOperatorAuth> | undefined = globalThis.__sparxOperatorAuth;

function getOperatorAuth(): ReturnType<typeof createOperatorAuth> {
  if (cached) return cached;
  cached = createOperatorAuth();
  if (process.env.NODE_ENV !== 'production') globalThis.__sparxOperatorAuth = cached;
  return cached;
}

export const operatorAuth = new Proxy({} as ReturnType<typeof createOperatorAuth>, {
  get: (_t, prop) => (getOperatorAuth() as Record<string | symbol, unknown>)[prop],
  has: (_t, prop) => prop in (getOperatorAuth() as object),
});

export type OperatorAuth = ReturnType<typeof createOperatorAuth>;
