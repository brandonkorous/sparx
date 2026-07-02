// Fastify factory for the storefront MCP server (docs/113 §3.2).
//
// Surface:
//   • GET    /health                              — liveness/readiness
//   • *      /mcp                                  — per-site (site from Host)
//   • *      /s/:tenant/mcp                        — canonical (primary site)
//   • *      /s/:tenant/:property/mcp              — canonical (named property)
//
// No auth in Phase 1 — the tools can only do what an anonymous storefront
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
import { buildStorefrontServer } from './mcp.js';
import { resolveSite, makeClient, fetchDisabledModules, UnknownStorefrontError } from './site.js';
import { enforceRateLimit, RateLimitError } from './rate-limit.js';

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

  const ctx = { tenantSlug: site.tenantSlug, propertySlug: site.propertySlug };
  const client = makeClient(site);
  const disabledModules = await fetchDisabledModules(client);
  const server = buildStorefrontServer(client, ctx, disabledModules);

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(request.raw, reply.raw, request.body);
  reply.hijack();
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
    if (err instanceof UnknownStorefrontError) {
      return reply.code(404).send({
        success: false,
        error: { code: 'UNKNOWN_STOREFRONT', message: err.message, request_id: request.id },
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
    request.log.error({ err }, 'unhandled storefront-mcp error');
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
 *  the canonical `/s/:tenant[/:property]/mcp` (site from the path). */
function registerMcpRoutes(app: FastifyInstance): void {
  const methods = ['POST', 'GET', 'DELETE'] as const;
  app.route({
    method: [...methods],
    url: '/mcp',
    handler: (request, reply) => handleMcp(request, reply, undefined),
  });
  app.route({
    method: [...methods],
    url: '/s/:tenant/mcp',
    handler: (request, reply) => handleMcp(request, reply, request.params as SubPath),
  });
  app.route({
    method: [...methods],
    url: '/s/:tenant/:property/mcp',
    handler: (request, reply) => handleMcp(request, reply, request.params as SubPath),
  });
}
