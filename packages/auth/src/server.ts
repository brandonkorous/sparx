import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { mcp, organization } from 'better-auth/plugins';
import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { authPrisma } from './prisma';
import { publishAuthEmail } from './email-events';
import { finalizeOAuthSignup, provisionTenantForOAuth } from './oauth-provisioning';
import { MCP_ALL_OAUTH_SCOPES, verifyConsentGrant } from './mcp-scopes';
import { ac, roles } from './org-roles';

// sparx Better Auth server instance. One per process — same caching strategy
// as @sparx/db's prisma client so dev HMR does not leak adapters.
//
// Schema dependencies (packages/db/prisma/schema.prisma):
//   - User has sparx extensions `tenantId` + `role` exposed via additionalFields
//   - Session / Account / Verification shapes match Better Auth's expectations
//
// The organization plugin (docs/16 §2, docs/114 Part A) is enabled below — the
// tenant IS the org, with `members`/`invitations` tables + `session.activeOrganizationId`
// (migration 20261002000000_organizations_and_teams). A user can belong to many
// orgs (team members + consultants); the active org drives the JWT `tid`/`role`,
// resolved in session.ts. `User.tenantId` remains the default (home) membership.

declare global {
  var __sparxAuth: ReturnType<typeof createAuth> | undefined;
}

// Consent guard for Better Auth's `/mcp/authorize` (docs/07 §5). That endpoint
// mints an auth code for ANY requested scope the moment a staff user has a
// session — it only shows a consent screen when the client sends
// `prompt=consent`, which an attacker's self-registered DCR client won't. On a
// PUBLIC surface that's a confused-deputy hole. So we require a signed,
// session-bound, short-lived consent grant (minted only by our first-party
// /oauth/consent page after the user explicitly picks scopes); any
// /mcp/authorize hit without a valid grant is bounced to that page.
const mcpAuthorizeGuard = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/mcp/authorize') return;

  const origin = typeof ctx.context.options.baseURL === 'string' ? ctx.context.options.baseURL : '';
  const query = (ctx.query ?? {}) as Record<string, unknown>;

  // Rebuild the consent-page URL from the original authorize params (minus our
  // own grant param) so the user can review + approve. toConsent() returns
  // `never`, so each guard below both terminates and narrows.
  const toConsent = (): never => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (k === 'sparx_grant') continue;
      if (typeof v === 'string') params.set(k, v);
    }
    throw ctx.redirect(`${origin}/oauth/consent?${params.toString()}`);
  };

  const grant = verifyConsentGrant(
    typeof query.sparx_grant === 'string' ? query.sparx_grant : null,
    ctx.context.secret
  );
  if (!grant) return toConsent();

  // The grant must bind the EXACT client, redirect, and scope in this request —
  // a signed approval can't be replayed onto a different one.
  if (
    grant.clientId !== query.client_id ||
    grant.redirectUri !== query.redirect_uri ||
    grant.scope !== query.scope
  ) {
    return toConsent();
  }

  // …and it must belong to the user who is actually signed in now.
  const session = await getSessionFromCtx(ctx);
  if (session?.user.id !== grant.userId) return toConsent();

  // Valid, bound, and session-matched — let Better Auth mint the code.
});

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

    // Throttle the public MCP OAuth surface (docs/07 §5). DCR is unauthenticated
    // so registration is capped hard; authorize/token are per-IP capped to blunt
    // brute force. Better Auth enables rate limiting in production by default;
    // these custom rules apply on top. (Memory storage = per-instance; acceptable
    // at the dashboard's current replica count.)
    rateLimit: {
      customRules: {
        '/mcp/register': { window: 60, max: 5 },
        '/mcp/authorize': { window: 60, max: 30 },
        '/mcp/token': { window: 60, max: 60 },
      },
    },

    // Guard the MCP authorization endpoint (docs/07 §5). See mcpAuthorizeGuard.
    hooks: {
      before: mcpAuthorizeGuard,
    },

    plugins: [
      // MCP OAuth authorization server (docs/07 §5). Hardened per OAuth 2.1:
      //   • requirePKCE + S256 only (both OFF by default in this build).
      //   • short access-token + code TTLs.
      //   • our full MCP scope vocabulary is the allow-list; the user picks the
      //     subset on the consent page (the `before` hook above enforces it).
      // storeClientSecret stays "plain": the plugin's token endpoint compares
      // client secrets raw, so hashing would break confidential clients.
      // Claude connects as a PUBLIC (PKCE, secret-less) client regardless.
      mcp({
        loginPage: '/sign-in',
        resource: mcpResourceUrl(),
        oidcConfig: {
          loginPage: '/sign-in',
          requirePKCE: true,
          allowPlainCodeChallengeMethod: false,
          accessTokenExpiresIn: 60 * 60, // 1h
          refreshTokenExpiresIn: 60 * 60 * 24 * 30, // 30d (offline_access)
          codeExpiresIn: 5 * 60, // 5m
          scopes: [...MCP_ALL_OAUTH_SCOPES],
          metadata: {
            scopes_supported: [...MCP_ALL_OAUTH_SCOPES],
          },
        },
      }),
      // Organizations & Teams (docs/114 Part A). The tenant IS the organization,
      // so the plugin's `organization` model maps onto the `tenant` Prisma model
      // (its `logo`/`metadata` fields → tenants.org_logo/org_metadata); `member`,
      // `invitation`, and `session.activeOrganizationId` already match the plugin's
      // default field names (members/invitations tables + the sessions column).
      //
      // We own the tenant lifecycle (signUpMerchant / OAuth provisioning) and mint
      // the owner `member` there, so the plugin NEVER creates or deletes an org —
      // it manages memberships, invitations, and the active-org on the session
      // (setActiveOrganization, which correctly refreshes the 5-min cookie cache).
      organization({
        schema: {
          organization: {
            modelName: 'tenant',
            fields: { logo: 'orgLogo', metadata: 'orgMetadata' },
          },
        },
        allowUserToCreateOrganization: false,
        disableOrganizationDeletion: true,
        creatorRole: 'owner',
        membershipLimit: 1000,
        invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days
        // Team invitations ride the email bus (docs/114 §A.4): publish an
        // `email.send` event with the `team-invitation` template — email-worker
        // renders + relays it, so invite latency never couples to Postal. Better
        // Auth does not generate the accept URL; we point it at our own
        // /accept-invite page carrying the invitation id.
        async sendInvitationEmail(data) {
          const appUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';
          const acceptUrl = `${appUrl}/accept-invite?invitation=${encodeURIComponent(data.id)}`;
          const inviterName = data.inviter.user.name?.trim() || data.inviter.user.email;
          await publishAuthEmail({
            tenantId: data.organization.id,
            actorId: data.inviter.user.id,
            template: 'team-invitation',
            to: data.email,
            props: {
              inviteeEmail: data.email,
              orgName: data.organization.name,
              inviterName,
              role: data.role,
              acceptUrl,
              expiresInDays: 7,
            },
          });
        },
        ac,
        roles,
      }),
      // nextCookies() must stay LAST so it can flush Set-Cookie for the
      // plugins registered before it.
      nextCookies(),
    ],
  });
}

/** Canonical resource identifier for the MCP server (the audience the OAuth
 *  tokens are for). Prod: https://mcp.sparx.works/v1. */
function mcpResourceUrl(): string {
  return process.env.MCP_RESOURCE_URL ?? 'http://localhost:3000/v1';
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
