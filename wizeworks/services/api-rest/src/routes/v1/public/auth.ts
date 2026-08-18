// Shopper OAuth authorization server — the customer Better Auth instance mounted
// on api-rest (docs/113 §5, docs/27 §6). The AS lives on the STORE's own origin:
// Caddy routes `<store>/v1/public/auth/*` and the store-root `.well-known` docs to
// api-rest, so the browser keeps its sparx_customer_session cookie through the
// authorize → consent flow. Every leg resolves its tenant from the store Host
// (fallback `?tenant=`) and runs Better Auth inside the ambient tenantStore (RLS).
//
// Surface:
//   *    /v1/public/auth/*                              → Better Auth handler
//        (mcp/register · mcp/authorize · mcp/token · mcp/jwks · get-session · …)
//   GET  /.well-known/oauth-authorization-server        → our AS metadata (real
//   GET  /.well-known/openid-configuration                shopper scope vocab)
//   GET  /v1/public/auth/consent                        → consent render data
//   POST /v1/public/auth/consent                        → approve/deny (mints the
//                                                          signed consent grant)
//
// The `/mcp/authorize` guard (server.ts) bounces any authorize without a valid
// grant to `<store>/account/authorize` (the store-branded consent page), which
// calls the consent endpoints below.

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  buildCustomerAuthServerMetadata,
  capCustomerScopes,
  customerAuthSecret,
  customerAuthorizeParamsRecord,
  getCustomerSession,
  parseCustomerAuthorizeParams,
  signCustomerConsentGrant,
  validateCustomerAuthorizeRequest,
  CUSTOMER_MCP_SCOPE_CATALOG,
  CUSTOMER_OIDC_BASE_SCOPES,
} from '@wizeworks/customer-auth';
import { ok } from '@wizeworks/api-core/envelope';
import { unauthorized, validationError } from '@wizeworks/api-core/errors';

import { resolveActivePropertyName } from '../../../lib/property.js';
import { resolveAuthTenant, runCustomerAuthHandler } from '../../../lib/customer-oauth.js';

const BA_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as const;

/** Serve OUR authorization-server metadata (not Better Auth's default, which only
 *  knows the openid framing scopes) so discovery advertises the real shopper scope
 *  vocabulary + this store's endpoints. Cached + CORS-open (public discovery). */
async function metadataHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { storeOrigin } = await resolveAuthTenant(request);
  reply
    .header('access-control-allow-origin', '*')
    .header('cache-control', 'public, max-age=3600')
    .code(200)
    .send(buildCustomerAuthServerMetadata(storeOrigin));
}

// The store-branded consent page (wizeworks/apps/site) posts here. Approve caps the selected
// scopes, mints a signed session-bound grant, and returns the store-origin
// /mcp/authorize URL carrying it; deny returns the client redirect with an error.
const ConsentBody = z.object({
  action: z.enum(['approve', 'deny']),
  response_type: z.string().default('code'),
  client_id: z.string(),
  redirect_uri: z.string(),
  scope: z.string().default(''),
  state: z.string().optional(),
  code_challenge: z.string().default(''),
  code_challenge_method: z.string().default('S256'),
  resource: z.string().optional(),
  nonce: z.string().optional(),
  /** Space-joined shopper-selected business scopes (approve only). */
  granted: z.string().default(''),
});

const publicAuthRoutes: FastifyPluginAsync = async (app) => {
  // ── Discovery metadata (store-root .well-known) ──────────────────────────────
  app.get('/.well-known/oauth-authorization-server', metadataHandler);
  app.get('/.well-known/openid-configuration', metadataHandler);

  // ── Consent render data ──────────────────────────────────────────────────────
  // Validates the authorize request + resolves the shopper's session so the page
  // can render "who is asking", the scope picker, and whether a sign-in is needed.
  app.get('/v1/public/auth/consent', async (request) => {
    const { tenantId, storeOrigin } = await resolveAuthTenant(request);
    const params = parseCustomerAuthorizeParams(request.query as Record<string, string>);
    const validation = await validateCustomerAuthorizeRequest(tenantId, params, storeOrigin);
    if (!validation.ok) return ok({ valid: false, error: validation.error });

    const session = await getCustomerSession({ tenantId }, request.headers.cookie);
    const requested = new Set(params.scope.split(' ').filter(Boolean));
    // Offer the shopper the scopes the client asked for that we recognise; if the
    // client requested none, offer the read scopes as a sensible default.
    const scopes = CUSTOMER_MCP_SCOPE_CATALOG.filter(
      (s) => requested.size === 0 || requested.has(s.scope)
    ).map((s) => ({
      scope: s.scope,
      label: s.label,
      description: s.description,
      // Pre-check reads; the shopper opts into writes explicitly.
      checked: s.kind === 'read',
    }));

    return ok({
      valid: true,
      storeName: await resolveActivePropertyName(tenantId),
      clientName: validation.client.name,
      redirectUri: params.redirectUri,
      scopes,
      signedIn: session !== null,
      email: session?.email ?? null,
    });
  });

  // ── Consent approve / deny ───────────────────────────────────────────────────
  app.post('/v1/public/auth/consent', async (request, reply) => {
    const { tenantId, storeOrigin } = await resolveAuthTenant(request);
    const body = ConsentBody.parse(request.body);
    const params = parseCustomerAuthorizeParams(body);

    // Never redirect to an unvalidated redirect_uri, even on deny.
    const validation = await validateCustomerAuthorizeRequest(tenantId, params, storeOrigin);
    if (!validation.ok) throw validationError(validation.error);

    if (body.action === 'deny') {
      const url = new URL(params.redirectUri);
      url.searchParams.set('error', 'access_denied');
      url.searchParams.set('error_description', 'The shopper declined the authorization request.');
      if (params.state) url.searchParams.set('state', params.state);
      return ok({ redirectUrl: url.toString() });
    }

    // Approve requires a signed-in shopper (the page redirects to /account/login
    // first otherwise). The session is tenant-bound + RLS-scoped.
    const session = await getCustomerSession({ tenantId }, request.headers.cookie);
    if (!session) throw unauthorized('Sign in to authorize this connection.');

    // Cap the selected scopes to the known shopper vocabulary (a tampered form can
    // never widen beyond it), frame with OIDC scopes, and mint the session-bound
    // grant the /mcp/authorize guard requires.
    const capped = capCustomerScopes(body.granted.split(' ').filter(Boolean));
    const fullScope = [...CUSTOMER_OIDC_BASE_SCOPES, ...capped].join(' ');
    const grant = signCustomerConsentGrant(
      {
        clientId: params.clientId,
        redirectUri: params.redirectUri,
        scope: fullScope,
        userId: session.userId,
      },
      customerAuthSecret()
    );

    // Hand back to Better Auth's /mcp/authorize ON THE STORE ORIGIN (same-origin so
    // the session cookie rides along). No `prompt` → the plugin mints a code once
    // our guard accepts the grant. `scope` MUST equal grant.scope.
    const q = new URLSearchParams(customerAuthorizeParamsRecord(params));
    q.set('scope', fullScope);
    q.set('code_challenge_method', 'S256');
    q.set('sparx_grant', grant);
    reply.header('cache-control', 'no-store');
    return ok({ authorizeUrl: `${storeOrigin}/v1/public/auth/mcp/authorize?${q.toString()}` });
  });

  // ── Better Auth handler mount ────────────────────────────────────────────────
  // In a child scope with RAW-string content-type parsers so Better Auth re-parses
  // the body itself (the /mcp/token endpoint is application/x-www-form-urlencoded).
  // Encapsulated parsers don't touch the JSON-parsing consent routes above.
  // eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
  await app.register(async (scoped) => {
    for (const ct of ['application/json', 'application/x-www-form-urlencoded']) {
      scoped.addContentTypeParser(ct, { parseAs: 'string' }, (_req, bodyStr, done) =>
        done(null, bodyStr)
      );
    }
    scoped.route({
      method: [...BA_METHODS],
      url: '/v1/public/auth/*',
      handler: async (request, reply) => {
        const tenant = await resolveAuthTenant(request);
        await runCustomerAuthHandler(request, reply, tenant);
      },
    });
  });
};

export default publicAuthRoutes;
