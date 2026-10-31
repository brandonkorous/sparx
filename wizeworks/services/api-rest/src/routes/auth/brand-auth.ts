// Staff sign-in for every brand, served from api-rest (docs/154 §2-4).
//
// Each brand's Better Auth instance used to run inside that brand's Next.js app.
// It now runs here, so the apps hold no database connection and no auth secret.
// The public address does NOT move: each app rewrites its own `/api/auth/*` to
// `/auth/<brand>/*` on this service, so cookies stay first-party on the app's
// domain, emailed links keep working, and the redirect URIs registered with
// Google and the MCP issuer stay byte-identical.
//
//   ALL  /auth/<brand>/*                    the brand's Better Auth handler
//
// and, for the app's SERVER only, under `/platform` (a segment Better Auth
// does not use, so nothing here can shadow one of its paths):
//
//   GET  /platform/session                  the request's SparxSession
//   POST /platform/api-token                the internal JWT a console's browser
//                                           calls api-rest with
//   ANY  /platform/account/<op>             the person's own account security
//                                           and businesses (account-operations)
//   POST /platform/handoff                  mint a cross-domain session token
//   POST /platform/handoff/consume          redeem one for the console's cookies
//   POST /platform/sign-out                 end the session, return cookies to clear
//
// An app's public `/api/auth/*` proxy refuses `/platform` (auth-client-server),
// so a browser reaches these only through the app's own server code.
//
// INTERNAL ONLY. api.sparx.works proxies every path to this service, so the
// routes refuse any request whose Host is a public name. A Next.js rewrite
// sends the Host of its target (`api-rest.<ns>.svc.cluster.local`), and Caddy
// sends the public Host it matched, so the Host header tells the two apart. It
// is read raw, never through `request.hostname`: with `trustProxy` on, Fastify
// prefers X-Forwarded-Host, which a rewrite sets to the APP's public host.
//
// Brands are opt-in through PLATFORM_AUTH_BRANDS. Unset, nothing is mounted and
// api-rest behaves exactly as before, which is what lets this ship ahead of the
// apps switching over (docs/154 "Rollout").

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { SignJWT } from 'jose';
import {
  authBrandConfigForBrand,
  brandAuthHandler,
  registerAuthBrands,
  resolveSession,
  runAccountOperation,
  mintSessionHandoff,
  consumeSessionHandoff,
  signOutSession,
  type SparxSession,
} from '@wizeworks/auth';
import { normalizeBrandKey } from '@wizeworks/brand-core';
import { runAsBrand } from '@wizeworks/brand-core/request-scope';
import { env } from '../../env.js';
import platformBusinessRoutes from './platform-business.js';
import platformFlowRoutes from './platform-flows.js';
import { HOP_BY_HOP, jsonBody, requestHeaders, servedBrand } from './platform-scope.js';

/** Better Auth's own mount point under each brand's base URL. */
const BETTER_AUTH_BASE_PATH = '/api/auth';

/** Ten minutes, as the consoles minted it. The client refreshes at 80% of life. */
const API_TOKEN_TTL_SECONDS = 10 * 60;

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

/** `sparx,piggles` → `['sparx', 'piggles']`. Exported for its test. */
export function parseBrandList(raw: string | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean)
        .map(normalizeBrandKey)
    ),
  ];
}

/**
 * Whether a raw Host header names this service from inside the cluster (or a
 * developer's machine), as opposed to a public hostname. Exported for its test.
 */
export function isInternalHost(host: string | undefined): boolean {
  if (!host) return false;
  const name = host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/^\[(.*)\]$/, '$1');
  return (
    name === 'localhost' ||
    name === '127.0.0.1' ||
    name === '::1' ||
    name === 'api-rest' ||
    name.endsWith('.svc') ||
    name.endsWith('.svc.cluster.local')
  );
}

/**
 * The URL Better Auth must see for a proxied request: the brand's PUBLIC
 * address, so its origin check, its callback URLs and its cookie attributes all
 * derive from what the browser used. `rest` is the path after
 * `/auth/<brand>/`; `rawUrl` is the request's own URL, for its query string.
 * Exported for its test.
 */
export function betterAuthUrl(baseURL: string, rest: string, rawUrl: string): string {
  const base = new URL(baseURL);
  const q = rawUrl.indexOf('?');
  const query = q === -1 ? '' : rawUrl.slice(q);
  return `${base.origin}${BETTER_AUTH_BASE_PATH}/${rest}${query}`;
}

function requestBody(request: FastifyRequest): string | undefined {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') return undefined;
  // The scoped parsers below keep json and form bodies as the raw string, so
  // Better Auth parses exactly what the browser sent.
  if (typeof request.body === 'string') return request.body;
  return request.body != null ? JSON.stringify(request.body) : undefined;
}

async function relay(reply: FastifyReply, response: Response): Promise<void> {
  reply.status(response.status);
  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'set-cookie' || HOP_BY_HOP.has(lower)) return;
    reply.header(key, value);
  });
  // getSetCookie(), never forEach: forEach joins several cookies with commas,
  // and a cookie's Expires attribute contains a comma.
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) reply.header('set-cookie', cookies);
  await reply.send(Buffer.from(await response.arrayBuffer()));
}

/** The body of `POST /auth/<brand>/platform/api-token`. A console adds its own `apiUrl`
 *  and `propertyId`, which come from its own configuration and cookie. */
export interface ApiTokenResponse {
  token: string;
  /** Absolute epoch-ms expiry, so the client schedules refresh without clock-skew maths. */
  expiresAt: number;
  userId: string;
  /** The business the token acts for (the token's `tid`). A console binds its
   *  active-site cookie to it, so a site left by another business's operator
   *  on a shared computer is never forwarded. */
  tenantId: string;
  role: string;
  /** Empty when the account has no name set. Display only, never a control. */
  userName: string;
  email: string;
  emailVerified: boolean;
}

/** Mints the internal JWT api-rest's auth plugin verifies. Exported for its test. */
export async function mintApiToken(
  session: SparxSession,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<ApiTokenResponse> {
  const token = await new SignJWT({
    // `tid` is stamped HERE, from the session. The browser cannot choose its
    // own tenant, which is what keeps tenant isolation intact.
    tid: session.user.tenantId,
    role: session.user.role,
    ev: session.user.emailVerified,
    // For traces only: WizeLens shows the name on its Users page.
    name: session.user.name ?? undefined,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(session.user.id)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + API_TOKEN_TTL_SECONDS)
    .sign(new TextEncoder().encode(secret));
  return {
    token,
    expiresAt: (nowSeconds + API_TOKEN_TTL_SECONDS) * 1000,
    userId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
    userName: session.user.name ?? '',
    email: session.user.email,
    emailVerified: session.user.emailVerified,
  };
}

const brandAuthRoutes: FastifyPluginAsync = async (app) => {
  const brands = parseBrandList(env.PLATFORM_AUTH_BRANDS);
  if (brands.length === 0) return;

  // Fail at boot, not on a request. In a process serving two brands, an auth
  // call outside a brand scope must throw rather than answer as the default
  // brand, and that only holds in request mode.
  if (process.env.PLATFORM_BRAND_SOURCE !== 'request') {
    throw new Error(
      'PLATFORM_AUTH_BRANDS is set, so api-rest serves more than one brand, but ' +
        'PLATFORM_BRAND_SOURCE is not "request". Set it, or an unscoped auth call ' +
        'would silently answer as the default brand.'
    );
  }
  // Throws for a brand with no secret or base URL: refuse to start rather than
  // serve sign-in that cannot verify a cookie.
  registerAuthBrands(brands.map(authBrandConfigForBrand));

  app.addHook('onRequest', async (request, reply) => {
    if (!isInternalHost(request.headers.host)) {
      await reply.code(404).send({ error: 'not_found' });
      return reply;
    }
    if (!servedBrand(request)) {
      await reply.code(404).send({ error: 'unknown_brand' });
      return reply;
    }
    return undefined;
  });

  app.get('/auth/:brand/platform/session', async (request, reply) => {
    const brand = servedBrand(request)!;
    const session = await runAsBrand(brand, () => resolveSession(requestHeaders(request)));
    reply.header('cache-control', 'no-store, private');
    if (!session) return reply.code(401).send({ error: 'unauthenticated' });
    return reply.send({ session });
  });

  app.post('/auth/:brand/platform/api-token', async (request, reply) => {
    const brand = servedBrand(request)!;
    const session = await runAsBrand(brand, () => resolveSession(requestHeaders(request)));
    // Never cache a bearer token — not in a browser, not at Cloudflare.
    reply.header('cache-control', 'no-store, private');
    if (!session) return reply.code(401).send({ error: 'unauthenticated' });
    return reply.send(await mintApiToken(session, env.SPARX_INTERNAL_JWT_SECRET));
  });

  app.route({
    method: ['GET', 'POST'],
    url: '/auth/:brand/platform/account/*',
    handler: async (request, reply) => {
      const brand = servedBrand(request)!;
      const op = (request.params as { '*': string })['*'].replace(/\/+$/, '');
      const result = await runAsBrand(brand, () =>
        runAccountOperation(request.method, op, requestHeaders(request), jsonBody(request))
      );
      reply.header('cache-control', 'no-store, private');
      // A rotated session's new cookie, for the app to pass to the browser.
      if (result.setCookies.length > 0) reply.header('set-cookie', result.setCookies);
      return reply.code(result.status).send(result.body);
    },
  });

  app.post('/auth/:brand/platform/handoff', async (request, reply) => {
    const brand = servedBrand(request)!;
    const body = jsonBody(request);
    const audience = typeof body.audience === 'string' ? body.audience : '';
    reply.header('cache-control', 'no-store, private');
    if (!audience) return reply.code(400).send({ error: 'audience is required' });
    const minted = await runAsBrand(brand, () =>
      mintSessionHandoff(brand, requestHeaders(request), { audience, next: body.next })
    );
    if (!minted) return reply.code(401).send({ error: 'unauthenticated' });
    return reply.send(minted);
  });

  // No session cookie here, by design: the console has none yet, and the token
  // is what proves the person. Single use, sixty seconds, internal Host only.
  app.post('/auth/:brand/platform/handoff/consume', async (request, reply) => {
    const brand = servedBrand(request)!;
    const body = jsonBody(request);
    const audience = typeof body.audience === 'string' ? body.audience : '';
    reply.header('cache-control', 'no-store, private');
    if (!audience) return reply.code(400).send({ error: 'audience is required' });
    return reply.send(
      await runAsBrand(brand, () => consumeSessionHandoff(brand, body.token, audience))
    );
  });

  // The person's own business (consent, setup, billing) and the sign-in flows
  // that need more than Better Auth's endpoints (sign-up, invitations, MCP
  // consent). Registered after the hook above, so they answer only to the
  // internal Host and a served brand.
  await app.register(platformBusinessRoutes);
  await app.register(platformFlowRoutes);

  app.post('/auth/:brand/platform/sign-out', async (request, reply) => {
    const brand = servedBrand(request)!;
    const cookies = await runAsBrand(brand, () => signOutSession(brand, requestHeaders(request)));
    reply.header('cache-control', 'no-store, private');
    return reply.send({ cookies });
  });

  // The handler itself, in a child scope whose parsers keep json and form
  // bodies as raw strings (the parsers above it would hand over an object).
  // eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
  await app.register(async (scoped) => {
    for (const ct of ['application/json', 'application/x-www-form-urlencoded']) {
      scoped.addContentTypeParser(ct, { parseAs: 'string' }, (_req, body, done) =>
        done(null, body)
      );
    }
    scoped.route({
      method: [...METHODS],
      url: '/auth/:brand/*',
      handler: async (request, reply) => {
        const brand = servedBrand(request)!;
        // An unknown `/platform/...` path is ours and not found, never Better Auth's.
        const rest = (request.params as { '*': string })['*'];
        if (/^platform(\/|$)/i.test(rest)) return reply.code(404).send({ error: 'not_found' });
        await runAsBrand(brand, async () => {
          const { baseURL, handler } = brandAuthHandler(brand);
          const url = betterAuthUrl(baseURL, (request.params as { '*': string })['*'], request.url);
          const headers = requestHeaders(request);
          headers.set('host', new URL(baseURL).host);
          const response = await handler(
            new Request(url, {
              method: request.method,
              headers,
              body: requestBody(request),
              redirect: 'manual',
            })
          );
          await relay(reply, response);
        });
      },
    });
  });
};

export default brandAuthRoutes;
