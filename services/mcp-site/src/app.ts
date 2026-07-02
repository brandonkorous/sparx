// Fastify factory for the site MCP server (docs/113 §3.2).
//
// Surface:
//   • GET    /health                              — liveness/readiness
//   • *      /mcp                                  — per-site (site from Host)
//   • *      /s/:tenant/mcp                        — canonical (primary site)
//   • *      /s/:tenant/:property/mcp              — canonical (named property)
//
// No auth in Phase 1 — the tools can only do what an anonymous site
// visitor can already do. One McpServer + transport per request (stateless).

import { randomUUID } from 'node:crypto';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { env } from './env.js';
import { buildSiteServer, invokesCustomerTool } from './mcp.js';
import { resolveSite, makeClient, fetchSiteInfo, UnknownSiteError } from './site.js';
import { enforceRateLimit, RateLimitError } from './rate-limit.js';
import { bearerToken, protectedResourceMetadata, wwwAuthenticate } from './oauth-resource.js';

function loggerOptions(): FastifyServerOptions['logger'] {
  if (env.NODE_ENV === 'test') return false;
  if (env.NODE_ENV === 'development') {
    return {
      level: env.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
      },
    };
  }
  return { level: env.LOG_LEVEL };
}

interface SubPath {
  tenant?: string;
  property?: string;
}

async function handleMcp(
  request: FastifyRequest,
  reply: FastifyReply,
  subpath: SubPath | undefined
): Promise<void> {
  const site = await resolveSite(request, subpath);

  // Only POST carries a JSON-RPC body (real work) — GET opens the SSE channel,
  // DELETE terminates; both are framing, not billable.
  if (request.method === 'POST') {
    enforceRateLimit(`${site.tenantSlug}:${request.ip}`);
  }

  const bearer = bearerToken(request);

  // Bootstrap the OAuth flow (docs/113 §5): a customer-tier tool call WITHOUT a
  // bearer is answered with a 401 + RFC 9728 challenge at the HTTP layer so the
  // shopper's client discovers the site's authorization server and connects. (An
  // expired/invalid bearer is caught downstream by api-rest, surfaced as a tool
  // error telling the client to reconnect.)
  if (request.method === 'POST' && !bearer && invokesCustomerTool(request.body)) {
    reply
      .code(401)
      .header('WWW-Authenticate', wwwAuthenticate(request))
      .header('access-control-expose-headers', 'WWW-Authenticate')
      .send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Connect your account to use this tool, then try again.',
          request_id: request.id,
        },
      });
    return;
  }

  const ctx = {
    tenantSlug: site.tenantSlug,
    propertySlug: site.propertySlug,
    customerBearer: bearer,
  };
  const client = makeClient(site, bearer);
  const { disabledModules } = await fetchSiteInfo(client);
  const server = buildSiteServer(client, ctx, disabledModules);

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(request.raw, reply.raw, request.body);
  reply.hijack();
}

/** Serve RFC 9728 Protected Resource Metadata for a site's MCP endpoint (docs/113
 *  §5) — the shopper's client fetches this from the WWW-Authenticate challenge to
 *  discover the site's authorization server. Public + cached. */
async function handleResourceMetadata(
  request: FastifyRequest,
  reply: FastifyReply,
  subpath: SubPath | undefined
): Promise<void> {
  const site = await resolveSite(request, subpath);
  const { siteUrl } = await fetchSiteInfo(makeClient(site));
  reply
    .header('access-control-allow-origin', '*')
    .header('cache-control', 'public, max-age=3600')
    .code(200)
    .send(protectedResourceMetadata(request, siteUrl));
}

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions(),
    genReqId: () => `smcp_${randomUUID().replace(/-/g, '')}`,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'request_id',
    trustProxy: true,
    bodyLimit: 512 * 1024,
  });

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof UnknownSiteError) {
      return reply.code(404).send({
        success: false,
        error: { code: 'UNKNOWN_SITE', message: err.message, request_id: request.id },
      });
    }
    if (err instanceof RateLimitError) {
      if (err.retryAfterSeconds > 0) reply.header('retry-after', String(err.retryAfterSeconds));
      return reply.code(429).send({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: err.message,
          details: { retry_after_seconds: err.retryAfterSeconds },
          request_id: request.id,
        },
      });
    }
    request.log.error({ err }, 'unhandled site-mcp error');
    return reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred.',
        request_id: request.id,
      },
    });
  });

  app.get('/health', (_request, reply) => {
    reply.code(200).send({ status: 'ok' });
  });

  registerMcpRoutes(app);
  return app;
}

/** The MCP endpoint on three URL shapes: per-site `/mcp` (site from Host) and
 *  the canonical `/s/:tenant[/:property]/mcp` (site from the path). Each shape also
 *  serves its RFC 9728 resource-metadata doc at `<mcp-path>/.well-known/
 *  oauth-protected-resource` (docs/113 §5). */
function registerMcpRoutes(app: FastifyInstance): void {
  const methods = ['POST', 'GET', 'DELETE'] as const;
  const WELL_KNOWN = '/.well-known/oauth-protected-resource';
  app.route({
    method: [...methods],
    url: '/mcp',
    handler: (request, reply) => handleMcp(request, reply, undefined),
  });
  app.get(`/mcp${WELL_KNOWN}`, (request, reply) =>
    handleResourceMetadata(request, reply, undefined)
  );
  app.route({
    method: [...methods],
    url: '/s/:tenant/mcp',
    handler: (request, reply) => handleMcp(request, reply, request.params as SubPath),
  });
  app.get(`/s/:tenant/mcp${WELL_KNOWN}`, (request, reply) =>
    handleResourceMetadata(request, reply, request.params as SubPath)
  );
  app.route({
    method: [...methods],
    url: '/s/:tenant/:property/mcp',
    handler: (request, reply) => handleMcp(request, reply, request.params as SubPath),
  });
  app.get(`/s/:tenant/:property/mcp${WELL_KNOWN}`, (request, reply) =>
    handleResourceMetadata(request, reply, request.params as SubPath)
  );
}
