// Single error-handling plugin. Every thrown error exits as the
// `{ success: false, error: { code, message, details?, request_id } }` envelope (docs/06 §3).
// Service-specific error classes are mapped via `extraMappers`, so api-core stays feature-free.

import type { FastifyError, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { ApiError } from './errors.js';
import { prismaErrorReply, RETRY_AFTER_SECONDS } from './prisma-errors.js';

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    request_id: string;
  };
}

// A mapper sends a reply (claiming the error) or returns `undefined` so the next one can try.
export type ErrorMapper = (
  err: unknown,
  request: FastifyRequest,
  reply: FastifyReply
) => FastifyReply | undefined;

export interface ErrorsPluginOptions {
  extraMappers?: ErrorMapper[];
}

function envelope(request: FastifyRequest, code: string, message: string, details?: unknown) {
  return {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}), request_id: request.id },
  } satisfies ErrorEnvelope;
}

const apiErrorMapper: ErrorMapper = (err, request, reply) => {
  if (!(err instanceof ApiError)) return undefined;
  return reply.code(err.statusCode).send(envelope(request, err.code, err.message, err.details));
};

// `field` aliases `path`: dashboard forms match a server error back to a field by it.
const zodMapper: ErrorMapper = (err, request, reply) => {
  if (!(err instanceof ZodError)) return undefined;
  const details = err.issues.map((i) => ({
    path: i.path.join('.'),
    field: i.path.join('.'),
    message: i.message,
    code: i.code,
  }));
  return reply
    .code(422)
    .send(envelope(request, 'VALIDATION_ERROR', 'Request validation failed.', details));
};

// Fastify's own schema validation: same VALIDATION_ERROR shape, kept at 400.
const fastifyValidationMapper: ErrorMapper = (err, request, reply) => {
  const e = err as FastifyError;
  if (e.statusCode !== 400 || !Array.isArray(e.validation)) return undefined;
  return reply.code(400).send(envelope(request, 'VALIDATION_ERROR', e.message, e.validation));
};

// A 401 keeps an attached code (INVALID_PREVIEW_TOKEN); Fastify's FST_* codes stay internal.
const unauthorizedMapper: ErrorMapper = (err, request, reply) => {
  const e = err as FastifyError;
  if (e.statusCode !== 401) return undefined;
  const code = typeof e.code === 'string' && !e.code.startsWith('FST_') ? e.code : 'UNAUTHORIZED';
  return reply.code(401).send(envelope(request, code, e.message || 'Authentication required.'));
};

const rateLimitMapper: ErrorMapper = (err, request, reply) => {
  const e = err as FastifyError;
  if (e.statusCode !== 429) return undefined;
  return reply.code(429).send(envelope(request, 'RATE_LIMITED', e.message || 'Too many requests.'));
};

// Fastify framework 4xx (bad JSON body, payload too large): its message is safe to show.
const fastifyClientErrorMapper: ErrorMapper = (err, request, reply) => {
  const e = err as FastifyError;
  const status = e.statusCode;
  if (typeof e.code !== 'string' || !e.code.startsWith('FST_ERR_')) return undefined;
  if (typeof status !== 'number' || status < 400 || status >= 500) return undefined;
  return reply.code(status).send(envelope(request, 'BAD_REQUEST', e.message));
};

// Pool exhaustion is a 503 the caller can retry (WW-1).
const prismaMapper: ErrorMapper = (err, request, reply) => {
  const mapped = prismaErrorReply(err);
  if (!mapped) return undefined;
  if (mapped.status === 503) {
    request.log.warn({ err }, 'database unavailable');
    reply.header('retry-after', String(RETRY_AFTER_SECONDS));
  }
  return reply.code(mapped.status).send(envelope(request, mapped.code, mapped.message));
};

const BUILTIN_MAPPERS: ErrorMapper[] = [
  apiErrorMapper,
  zodMapper,
  fastifyValidationMapper,
  unauthorizedMapper,
  rateLimitMapper,
  fastifyClientErrorMapper,
  prismaMapper,
];

function sendNotFound(request: FastifyRequest, reply: FastifyReply) {
  const message = `Route ${request.method} ${request.url} not found.`;
  return reply.code(404).send(envelope(request, 'NOT_FOUND', message));
}

export function createErrorsPlugin(options: ErrorsPluginOptions = {}): FastifyPluginAsync {
  const mappers = [...(options.extraMappers ?? []), ...BUILTIN_MAPPERS];

  const errorsPlugin: FastifyPluginAsync = (app) => {
    app.setErrorHandler((err: FastifyError, request, reply) => {
      for (const mapper of mappers) {
        const handled = mapper(err, request, reply);
        if (handled) return handled;
      }
      // Anything else is a bug: log it in full, answer generically; request_id finds it.
      request.log.error({ err }, 'unhandled error');
      return reply
        .code(500)
        .send(envelope(request, 'INTERNAL_ERROR', 'An internal error occurred.'));
    });
    app.setNotFoundHandler(sendNotFound);
    return Promise.resolve();
  };

  // fastify-plugin makes the handlers apply to the root scope, not only this child scope.
  return fp(errorsPlugin, { name: 'envelope-errors' });
}
