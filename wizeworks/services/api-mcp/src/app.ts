// Fastify factory for the MCP server.
//
// Surface (dedicated mcp.sparx.works subdomain):
//   • GET  /health           — liveness/readiness probe
//   • POST /mcp              — MCP JSON-RPC over Streamable HTTP
//   • GET  /mcp              — SSE channel for server→client messages
//   • DELETE /mcp            — explicit session termination
//
// The endpoint is `/mcp` — matching the shopper site MCP (docs/113) and the
// de-facto MCP convention, so both servers connect the same way. (The earlier
// `/v1` path made every natural connect attempt 404.) `/v1` stays wired as a
// deprecated alias so any early connector keeps working; any OTHER path gets a
// helpful JSON 404 naming the real endpoint instead of a bare "route not found".
//
// Auth: bearer JWT (see ./auth.ts). One McpServer + transport pair is built
// per request — stateless mode — so each call is hermetic and easy to test.

import { randomUUID } from 'node:crypto';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { env } from './env.js';
import authPlugin, { AuthError, authenticate } from './auth.js';
import { buildServerForRequest } from './server.js';
import { enforceRateLimit, RateLimitError } from './rate-limit.js';
import { isWriteToolCall } from './tool-registry.js';
import { registerOAuthMetadataRoutes, wwwAuthenticate } from './oauth-metadata.js';

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

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions(),
    genReqId: () => `mcp_${randomUUID().replace(/-/g, '')}`,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'request_id',
    trustProxy: true,
    bodyLimit: 512 * 1024, // MCP payloads are JSON-RPC envelopes — 512 KiB ceiling.
  });

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof AuthError) {
      // RFC 9728: point the client at our Protected Resource Metadata so it can
      // discover the authorization server and run the OAuth flow. Expose the
      // header so browser-based MCP clients can read it cross-origin.
      return reply
        .code(401)
        .header('WWW-Authenticate', wwwAuthenticate(request))
        .header('access-control-expose-headers', 'WWW-Authenticate')
        .send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: err.message, request_id: request.id },
        });
    }
    if (err instanceof RateLimitError) {
      if (err.retryAfterSeconds > 0) {
        reply.header('retry-after', String(err.retryAfterSeconds));
      }
      return reply.code(429).send({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: err.message,
          details: {
            scope: err.scope,
            window: err.window,
            limit: err.limit,
            retry_after_seconds: err.retryAfterSeconds,
          },
          request_id: request.id,
        },
      });
    }
    request.log.error({ err }, 'unhandled mcp error');
    return reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred.',
        request_id: request.id,
      },
    });
  });

  await app.register(authPlugin);

  app.get('/health', (_request, reply) => {
    reply.code(200).send({ status: 'ok' });
  });

  // Public OAuth resource-server discovery (docs/07 §5) — no auth.
  registerOAuthMetadataRoutes(app);
  registerMcpRoutes(app);

  return app;
}

/** The MCP transport endpoint + its wrong-path safety net. `/mcp` is canonical;
 *  `/v1` is the deprecated alias (kept so early connectors keep working — the
 *  OAuth token audience is not path-bound, see auth.ts, so both resolve to the
 *  same tenant + scopes and an alias can't leak or widen access). Any OTHER path
 *  gets a JSON 404 naming the real endpoint rather than Fastify's bare "route not
 *  found" — the silent /v1-vs-/mcp 404s cost real debugging time. */
function registerMcpRoutes(app: FastifyInstance): void {
  // POST handles initialize + JSON-RPC requests. GET handles the SSE channel
  // the SDK opens for streaming responses; DELETE terminates a session.
  const mcpHandler = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const auth = await authenticate(request);
    // POST is the only method that carries a JSON-RPC body — GET opens the
    // SSE channel and DELETE terminates. Only count POST against the tenant's
    // quota; GET/DELETE are framing, not work.
    if (request.method === 'POST') {
      enforceRateLimit({ auth, isWriteCall: isWriteToolCall(request.body) });
    }
    const server = await buildServerForRequest(auth);
    // Stateless mode — no session id, every request stands alone.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
    // handleRequest takes over the response — tell Fastify to stop.
    reply.hijack();
  };

  const mcpMethods = ['POST', 'GET', 'DELETE'] as const;
  app.route({ method: [...mcpMethods], url: '/mcp', handler: mcpHandler });
  app.route({ method: [...mcpMethods], url: '/v1', handler: mcpHandler });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `No route for ${request.method} ${request.url}. The MCP endpoint is /mcp on this host.`,
        request_id: request.id,
      },
    });
  });
}
