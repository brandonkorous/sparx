// Refuses a NUL byte in the query string or path params before any route runs.
// Postgres cannot store one, so a scanner's `?slug=%00a` used to reach Prisma and
// come back as a 500 (WW-2). This answers the caller's mistake as their 400.

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

/** Does any string in this parsed query or params object hold a NUL byte? */
export function hasNulByte(value: unknown): boolean {
  if (typeof value === 'string') return value.includes('\u0000');
  if (Array.isArray(value)) return value.some(hasNulByte);
  if (value && typeof value === 'object') return Object.values(value).some(hasNulByte);
  return false;
}

function refuse(request: FastifyRequest, reply: FastifyReply) {
  return reply.code(400).send({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'The request has invalid characters.',
      request_id: request.id,
    },
  });
}

const nulGuard: FastifyPluginAsync = (app) => {
  app.addHook('preValidation', async (request, reply) => {
    if (hasNulByte(request.query) || hasNulByte(request.params)) return refuse(request, reply);
  });
  return Promise.resolve();
};

export default fp(nulGuard, { name: 'nul-guard' });
