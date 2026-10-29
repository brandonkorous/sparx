// The customer Better Auth instance (Layer 2 — site shoppers). See docs/27 v2.
//
// A DEDICATED instance, isolated from the staff instance (@wizeworks/auth) in every
// dimension: its own secret (CUSTOMER_AUTH_SECRET), its own cookie
// (sparx_customer_session), its own tenant-scoped tables (customer_*), and
// application-level multi-tenancy so the same email is a separate account per
// tenant. Tenant scoping is enforced by the tenant-scoping adapter (tenant-adapter.ts)
// + Postgres RLS; this file wires the Better Auth options.

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { jwt } from 'better-auth/plugins';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { oauthProvider } from '@better-auth/oauth-provider';

import { hashPassword, verifyPassword } from './hash';
import { publishCustomerAuthEmail } from './email';
import { resolveStoreBaseUrl, resolveStoreName } from './store-url';
import { CUSTOMER_COOKIE_PREFIX, SESSION_COOKIE_NAME } from './session';
import { tenantScopedClient } from './tenant-adapter';
import { redactingLogger } from './redacting-logger';
import { CUSTOMER_ALL_OAUTH_SCOPES } from './mcp-scopes';

declare global {
  var __sparxCustomerAuth: ReturnType<typeof createCustomerAuth> | undefined;
}

/** Reset-token lifetime surfaced in the email copy (Better Auth default is 1h). */
const RESET_EXPIRES_MINUTES = 60;
/** How long a "confirm it's you" link works (sparx persona issue 329). */
const CONFIRM_EXPIRES_MINUTES = 60;

/** The secret the customer Better Auth instance is constructed with — the SINGLE
 *  source, so the consent page's signature check (as-metadata.ts) verifies the
 *  signed authorization request with the exact key the provider signed it with. */
export function customerAuthSecret(): string {
  return process.env.CUSTOMER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET ?? '';
}

/** Where the store-branded consent page lives, relative to the store origin.
 *  It is also the login page: signed out, it sends the shopper to the store's
 *  own sign-in and back (wizeworks/apps/site components/authorize-consent.tsx). */
const CUSTOMER_CONSENT_PAGE = '/account/authorize';

/** `resource` on an authorize request, as a list (it may repeat, RFC 8707). */
function requestedResources(query: Record<string, unknown> | undefined): string[] {
  const raw = query?.resource;
  if (typeof raw === 'string') return raw ? [raw] : [];
  return Array.isArray(raw) ? raw.filter((r): r is string => typeof r === 'string' && !!r) : [];
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Register this store's MCP server as an OAuth resource the first time an
 * assistant asks for it (RFC 8707).
 *
 * The provider only issues a token for a resource it has a row for, and the
 * staff instance declares its one resource in config. A store cannot: every
 * site is its own resource (`https://<store>/mcp`), on a host only known when
 * the request arrives. So this hook runs before `/oauth2/authorize` and
 *
 *   • refuses a resource on any origin but the store's own (the AS origin,
 *     which is where the store's MCP endpoint lives). This is the rule the 1.6
 *     consent page enforced: a store's sign-in never mints a token for
 *     somebody else's server;
 *   • writes the row (tenant-scoped, through the RLS adapter) when it is
 *     missing, allowing the whole shopper vocabulary. The consent screen is
 *     what narrows a grant.
 *
 * The token the provider then mints is a JWT whose `aud` is that resource and
 * whose `iss` is `<store>/v1/public/auth`; verifyCustomerMcpToken checks both.
 */
const registerStoreResource = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/oauth2/authorize') return;
  const resources = requestedResources(ctx.query as Record<string, unknown> | undefined);
  if (resources.length === 0) return;

  const storeOrigin = originOf(ctx.context.baseURL);
  for (const identifier of resources) {
    if (!storeOrigin || originOf(identifier) !== storeOrigin) {
      throw new APIError('BAD_REQUEST', {
        error: 'invalid_target',
        error_description: 'This store can only authorize access to its own assistant.',
      });
    }
    const existing = await ctx.context.adapter.findOne({
      model: 'oauthResource',
      where: [{ field: 'identifier', value: identifier }],
    });
    if (existing) continue;
    const now = new Date();
    await ctx.context.adapter.create({
      model: 'oauthResource',
      data: {
        identifier,
        name: 'Store assistant',
        allowedScopes: [...CUSTOMER_ALL_OAUTH_SCOPES],
        disabled: false,
        dpopBoundAccessTokensRequired: false,
        policyVersion: 1,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
});

/** The shopper MCP OAuth authorization server (docs/113 customer tier), on
 *  `@better-auth/oauth-provider` (OAuth 2.1: PKCE required for public clients,
 *  S256 only, hashed tokens). The provider directly, not `@better-auth/mcp`:
 *  that wrapper declares ONE static resource and seeds it at boot, outside any
 *  tenant, which this tenant-scoped instance can neither express nor survive.
 *  Resources are registered per store by registerStoreResource instead. */
function customerOAuthPlugins() {
  return [
    // Signs the access tokens, one EdDSA key set per store (customer_jwks is
    // tenant-scoped). No fixed issuer: it follows the per-request base URL, so
    // each store's tokens say `https://<store>/v1/public/auth`, which is what
    // that store's discovery document says too.
    jwt({ disableSettingJwtHeader: true }),
    oauthProvider({
      loginPage: CUSTOMER_CONSENT_PAGE,
      consentPage: CUSTOMER_CONSENT_PAGE,
      scopes: [...CUSTOMER_ALL_OAUTH_SCOPES],
      // Anonymous Dynamic Client Registration: a shopper's assistant registers
      // itself with no account, exactly like the staff flow.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: 'infer',
      // Per-client resource links are a managed-client feature; a DCR client
      // reaches the store's own resource, and only that (registerStoreResource).
      enforcePerClientResources: false,
      refreshTokenReuseInterval: 30,
      accessTokenExpiresIn: 60 * 60, // 1h
      refreshTokenExpiresIn: 60 * 60 * 24 * 30, // 30d
      // Also the life of the signed link to the consent page, which may include
      // signing in first: 10 minutes, the OAuth ceiling for a code.
      codeExpiresIn: 10 * 60,
    }),
  ];
}

// Session config, extracted so createCustomerAuth stays cohesive. cookieCache is
// DELIBERATELY OFF (docs/27 §3): it stores the session in a secret-signed cookie
// and returns it WITHOUT a DB read — bypassing the RLS tenant scoping. Because the
// same person can hold a session at multiple tenants, a cached cookie presented
// under another tenant's context would resolve to the wrong tenant's user (a
// cross-tenant leak — caught by the smoke test). Every getSession must hit
// customer_sessions under withTenant so RLS enforces isolation (a single indexed
// query). `tenantId` is surfaced as an additionalField (populated by the DB
// default under withTenant) so getCustomerSession can assert it matches the
// request tenant — an app-layer check INDEPENDENT of RLS. input:false so it is
// never client-settable; no defaultValue so BA omits it on insert.
const CUSTOMER_SESSION_CONFIG = {
  modelName: 'customerSession',
  expiresIn: 60 * 60 * 24 * 30, // 30 days
  updateAge: 60 * 60 * 24, // slide daily
  cookieCache: { enabled: false },
  additionalFields: {
    tenantId: { type: 'string', input: false, required: false },
  },
} as const;

function createCustomerAuth() {
  return betterAuth({
    appName: 'sparx-customer',
    // Warn and up, emails masked: a failed sign-in logged the address (./redacting-logger).
    logger: redactingLogger,
    // Mounted by api-rest at /v1/public/auth/* (docs/27 §6), and reached on each
    // STORE's own origin (Caddy routes `<store>/v1/public/auth*` there with the
    // Host preserved). The base URL is therefore per request: every store is
    // its own authorization server, and the issuer, the endpoints in discovery
    // and the `iss` on a redirect all have to name the store the shopper is on.
    //
    // `*` because store hosts are unbounded (custom domains). What makes that
    // safe is api-rest, not this list: it resolves the Host to a real site
    // before calling in (resolveAuthTenant 404s anything else), and it only
    // forwards the OAuth endpoints over HTTP (lib/customer-oauth.ts), so no
    // endpoint that takes a callback URL is reachable from a browser. Calls
    // without a host (service.ts) use the fallback.
    baseURL: {
      allowedHosts: ['*'],
      fallback: process.env.CUSTOMER_AUTH_URL ?? 'http://localhost:3100',
      protocol: 'auto',
    },
    basePath: '/v1/public/auth',
    // The jwt() plugin's session-to-JWT `/token` is not an OAuth endpoint and is
    // never offered (the provider's `/oauth2/token` is the token endpoint).
    disabledPaths: ['/token'],
    secret: customerAuthSecret(),
    database: prismaAdapter(tenantScopedClient, { provider: 'postgresql' }),

    // Core model → tenant-scoped Prisma model key (the supported remap; the
    // plugin OAuth keys are remapped in tenant-adapter.ts instead).
    user: { modelName: 'customerUser' },
    account: { modelName: 'customerAccount' },
    verification: { modelName: 'customerVerification' },
    session: CUSTOMER_SESSION_CONFIG,

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // 5-minute-store goal (docs/27 §9)
      minPasswordLength: 8,
      autoSignIn: true,
      // Argon2id, identical params to Layer 1 — so the backfilled hashes verify
      // directly (docs/27 §4.2). Never store or log plaintext.
      password: {
        hash: (password) => hashPassword(password),
        verify: ({ hash, password }) => verifyPassword(hash, password),
      },
      // Publish `email.send` (never a direct send) — same path as staff auth.
      // BA's own `url` points at api-rest's baseURL; we build the STORE url so the
      // link lands on the shopper's actual site (never a client-supplied
      // origin — a token-phishing vector). Tenant comes from the ambient store.
      // In the shop's name, like the confirm link below: the staff template said
      // "Set your sparx password" to a shop's customer (sparx persona issue 345).
      sendResetPassword: async ({ user, token }) => {
        const [base, siteName] = await Promise.all([resolveStoreBaseUrl(), resolveStoreName()]);
        const resetUrl = `${base}/account/reset?token=${encodeURIComponent(token)}`;
        await publishCustomerAuthEmail({
          template: 'customer-password-reset',
          to: user.email,
          props: {
            siteName,
            name: user.name && user.name !== user.email ? user.name.split(' ')[0] : null,
            resetUrl,
            expiresInMinutes: RESET_EXPIRES_MINUTES,
          },
        });
      },
    },

    // Confirming the address (sparx persona issue 329). Sign-up stays instant
    // (`requireEmailVerification: false`); what waits for the link is the
    // history a guest left under the same email, which `ensureMembership` will
    // not hand to a login until it is confirmed. The link lands on the shopper's
    // own site, built here for the same reason the reset link is.
    emailVerification: {
      expiresIn: CONFIRM_EXPIRES_MINUTES * 60,
      sendVerificationEmail: async ({ user, token }) => {
        const [base, siteName] = await Promise.all([resolveStoreBaseUrl(), resolveStoreName()]);
        await publishCustomerAuthEmail({
          template: 'customer-email-confirm',
          to: user.email,
          props: {
            siteName,
            name: user.name && user.name !== user.email ? user.name.split(' ')[0] : null,
            confirmUrl: `${base}/account/verify?token=${encodeURIComponent(token)}`,
            expiresInMinutes: CONFIRM_EXPIRES_MINUTES,
          },
        });
      },
    },

    advanced: {
      // DB generates ids (gen_random_uuid()), mirroring the staff instance.
      database: { generateId: false },
      // First-party cookie name expected by the site + the /account routes.
      cookies: { session_token: { name: SESSION_COOKIE_NAME } },
      // Never the staff instance's prefix: see CUSTOMER_COOKIE_PREFIX.
      cookiePrefix: CUSTOMER_COOKIE_PREFIX,
    },

    // Throttle the public MCP OAuth surface (mirrors staff, docs/07 §5). DCR is
    // unauthenticated so registration is capped hard.
    rateLimit: {
      customRules: {
        '/oauth2/register': { window: 60, max: 5 },
        '/oauth2/authorize': { window: 60, max: 30 },
        '/oauth2/consent': { window: 60, max: 30 },
        '/oauth2/token': { window: 60, max: 60 },
      },
    },

    // Register the store's MCP server as a resource on first use (see
    // registerStoreResource).
    hooks: {
      before: registerStoreResource,
    },

    plugins: customerOAuthPlugins(),
  });
}

// Lazy + cached, mirroring @wizeworks/auth: importing the barrel for a helper must
// not construct the instance (which throws when CUSTOMER_AUTH_SECRET is unset).
let cached: ReturnType<typeof createCustomerAuth> | undefined = globalThis.__sparxCustomerAuth;

export function getCustomerAuth(): ReturnType<typeof createCustomerAuth> {
  if (cached) return cached;
  cached = createCustomerAuth();
  if (process.env.NODE_ENV !== 'production') globalThis.__sparxCustomerAuth = cached;
  return cached;
}

export type CustomerAuth = ReturnType<typeof createCustomerAuth>;
