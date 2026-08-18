// Layer-3 calendar push webhook (docs/79 §8.3). Google watch-channels and Microsoft
// Graph subscriptions POST here when a connected calendar changes; we resolve the
// connection from the signed token the provider echoes back (Google: the channel
// `token` header; Microsoft: the subscription `clientState`) — so there is NO
// cross-tenant scan, and a forged push can't address a connection it doesn't own.
//
// Lives under /v1/public/ (the provider has no sparx session; the signed token IS the
// auth). It must answer FAST — Google drops slow channels and Microsoft retries — so
// the actual re-sync is fired-and-forgotten and the route returns immediately.
//
//   POST /v1/public/scheduling/calendar/push
//     · Microsoft validation handshake → echo ?validationToken (text/plain, 200)
//     · Microsoft change notice  (body.value[].clientState) → re-sync each, 202
//     · Google change notice     (X-Goog-Channel-Token header) → re-sync, 200

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { verifyCalendarPushToken } from '../../../lib/scheduling-calendar-oauth.js';
import { handleCalendarPush } from '../../../lib/scheduling-calendar-oauth-sync.js';

/** Re-sync the connection a verified push token points at, without blocking the
 *  provider's request (Google/MS expect a near-instant ack). */
function dispatch(request: FastifyRequest, token: string | undefined): void {
  if (!token) return;
  void verifyCalendarPushToken(token)
    .then((resolved) => {
      if (!resolved) return;
      return handleCalendarPush(request.log, resolved.tenantId, resolved.connectionId);
    })
    .catch((err: unknown) => request.log.warn({ err }, 'calendar-push: re-sync failed'));
}

interface MsNotification {
  clientState?: string;
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; registration is sync.
const schedulingCalendarPushRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/public/scheduling/calendar/push', async (request, reply): Promise<FastifyReply> => {
    // Microsoft subscription validation: echo the token verbatim, fast.
    const query = (request.query ?? {}) as { validationToken?: string };
    if (query.validationToken) {
      return reply.code(200).type('text/plain').send(query.validationToken);
    }

    // Microsoft change notifications carry a value[] with our clientState per item.
    const body = (request.body ?? {}) as { value?: MsNotification[] };
    if (Array.isArray(body.value)) {
      for (const item of body.value) dispatch(request, item.clientState);
      return reply.code(202).send();
    }

    // Google watch: the channel token rides a header; ignore the initial `sync` ping.
    const state = request.headers['x-goog-resource-state'];
    const token = request.headers['x-goog-channel-token'];
    if (state !== 'sync') {
      dispatch(request, typeof token === 'string' ? token : undefined);
    }
    return reply.code(200).send();
  });
};

export default schedulingCalendarPushRoutes;
