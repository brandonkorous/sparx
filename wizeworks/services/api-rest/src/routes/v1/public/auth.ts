// Shopper OAuth authorization server — the customer Better Auth instance mounted
// on api-rest (docs/113 §5, docs/27 §6). The AS lives on the STORE's own origin:
// Caddy routes `<store>/v1/public/auth*` and the store-root `.well-known` docs to
// api-rest, so the browser keeps its sparx_customer_session cookie through the
// authorize → consent flow. Every leg resolves its tenant from the store Host
// (fallback `?tenant=`) and runs Better Auth inside the ambient tenantStore (RLS).
//
// Surface:
//   *    /v1/public/auth/oauth2/* · /jwks · /.well-known/*  → Better Auth handler
//        (only the OAuth endpoints are forwarded; lib/customer-oauth.ts)
//   GET  /.well-known/oauth-authorization-server[/v1/public/auth]
//   GET  /.well-known/openid-configuration[/v1/public/auth]
//        → the provider's discovery document for this store. The issuer has a
//          path (`<store>/v1/public/auth`), so RFC 8414 clients fetch the
//          path-inserted form; the bare form is kept for those that don't.
//   GET  /v1/public/auth/consent?<signed request>  → consent render data
//   POST /v1/public/auth/consent                   → approve / deny
//
// The provider sends a shopper who must sign in or approve to
// `<store>/account/authorize?<signed request>` (the store-branded consent page),
// which calls the consent endpoints below.

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  customerApprovedScope,
  customerDiscoveryDocument,
  getCustomerSession,
  readCustomerConsentRequest,
  submitCustomerConsent,
  CUSTOMER_MCP_SCOPE_CATALOG,
} from '@wizeworks/customer-auth';
import { ok } from '@wizeworks/api-core/envelope';
import { unauthorized, validationError } from '@wizeworks/api-core/errors';

import { resolveActivePropertyName } from '../../../lib/property.js';
import {
  resolveAuthTenant,
  runCustomerAuthHandler,
  webHeaders,
} from '../../../lib/customer-oauth.js';

const BA_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as const;

/** Serve the provider's discovery document for this store. Cached + CORS-open
 *  (public discovery). 404s on a host that is not a store. */
function discoveryHandler(kind: 'oauth' | 'openid') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await resolveAuthTenant(request);
    const doc = await customerDiscoveryDocument(kind, webHeaders(request));
    reply
      .header('access-control-allow-origin', '*')
      .header('cache-control', 'public, max-age=3600')
      .code(200)
      .send(doc);
  };
}

/** The query string of a request URL, repeated keys intact. */
function searchOf(request: FastifyRequest): URLSearchParams {
  const q = request.url.indexOf('?');
  return new URLSearchParams(q === -1 ? '' : request.url.slice(q + 1));
}

// The store-branded consent page (wizeworks/apps/site) posts here with the
// provider's signed request, the decision, and the shopper's picks.
const ConsentBody = z.object({
  action: z.enum(['approve', 'deny']),
  oauth_query: z.string().min(1),
  /** Space-joined shopper-selected business scopes (approve only). */
  granted: z.string().default(''),
});

const publicAuthRoutes: FastifyPluginAsync = async (app) => {
  // ── Discovery metadata (store-root .well-known) ──────────────────────────────
  app.get('/.well-known/oauth-authorization-server', discoveryHandler('oauth'));
  app.get('/.well-known/oauth-authorization-server/v1/public/auth', discoveryHandler('oauth'));
  app.get('/.well-known/openid-configuration', discoveryHandler('openid'));
  app.get('/.well-known/openid-configuration/v1/public/auth', discoveryHandler('openid'));

  // ── Consent render data ──────────────────────────────────────────────────────
  // Verifies the signed request + resolves the shopper's session so the page can
  // render "who is asking", the scope picker, and whether a sign-in is needed.
  app.get('/v1/public/auth/consent', async (request) => {
    const { tenantId } = await resolveAuthTenant(request);
    const read = await readCustomerConsentRequest(tenantId, searchOf(request));
    if (!read.ok) return ok({ valid: false, error: read.error });

    const session = await getCustomerSession({ tenantId }, request.headers.cookie);
    const requested = new Set(read.request.requestedScopes);
    // Only what the client asked for: the provider refuses to approve a scope
    // that was not in the signed request.
    const scopes = CUSTOMER_MCP_SCOPE_CATALOG.filter((s) => requested.has(s.scope)).map((s) => ({
      scope: s.scope,
      label: s.label,
      description: s.description,
      // Pre-check reads; the shopper opts into writes explicitly.
      checked: s.kind === 'read',
    }));

    return ok({
      valid: true,
      storeName: await resolveActivePropertyName(tenantId),
      clientName: read.request.client.name,
      redirectUri: read.request.redirectUri,
      scopes,
      signedIn: session !== null,
      email: session?.email ?? null,
    });
  });

  // ── Consent approve / deny ───────────────────────────────────────────────────
  app.post('/v1/public/auth/consent', async (request, reply) => {
    const { tenantId, storeOrigin } = await resolveAuthTenant(request);
    const body = ConsentBody.parse(request.body);

    // Never act on an unverified request, even a denial: the redirect address
    // comes from the signed request and nowhere else.
    const read = await readCustomerConsentRequest(tenantId, new URLSearchParams(body.oauth_query));
    if (!read.ok) throw validationError(read.error);

    const accept = body.action === 'approve';
    let scope: string | undefined;
    if (accept) {
      // Approving needs a signed-in shopper (the page sends them to the store
      // login first otherwise). The session is tenant-bound + RLS-scoped.
      const session = await getCustomerSession({ tenantId }, request.headers.cookie);
      if (!session) throw unauthorized('Sign in to authorize this connection.');
      scope = customerApprovedScope(
        read.request.requestedScopes,
        body.granted.split(' ').filter(Boolean)
      );
      if (!scope) throw validationError('Choose at least one thing it can do.');
    }

    let next: string;
    try {
      next = await submitCustomerConsent({
        tenantId,
        oauthQuery: read.request.oauthQuery,
        accept,
        scope,
        headers: webHeaders(request),
      });
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'unknown error';
      throw validationError(
        `This connection could not be completed (${message}). Start again from your assistant.`
      );
    }
    reply.header('cache-control', 'no-store');
    // Usually the app's own redirect address (absolute); resolved against the
    // store in case the provider answers with one of its own pages.
    return ok({ redirectUrl: new URL(next, storeOrigin).toString() });
  });

  // ── Better Auth handler mount ────────────────────────────────────────────────
  // In a child scope with RAW-string content-type parsers so Better Auth re-parses
  // the body itself (the /oauth2/token endpoint is application/x-www-form-urlencoded).
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
