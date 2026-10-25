// Headers every api-rest response carries, success or failure.
// Caddy adds nosniff at the edge too; setting it here covers in-cluster callers (WW-12).

import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const responseHeaders: FastifyPluginAsync = (app) => {
  app.addHook('onSend', async (request, reply) => {
    // request_id lets a caller logging a 5xx send support something to look up.
    reply.header('x-request-id', request.id);
    reply.header('x-content-type-options', 'nosniff');
  });
  return Promise.resolve();
};

export default fp(responseHeaders, { name: 'response-headers' });
