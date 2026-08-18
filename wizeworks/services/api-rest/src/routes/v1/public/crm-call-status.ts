// The call status callback (docs/144 §5.6).
//
// A vendor POSTs here when a call reaches a terminal state — which is the
// moment the platform learns whether anyone actually picked up, and therefore
// the moment the timeline entry can honestly be written.
//
// PUBLIC, because the provider has no sparx session. The signed `t` token IS
// the auth: it carries the tenant, so the handler resolves which database rows
// this may touch WITHOUT a cross-tenant scan, and a forged callback cannot
// write an outcome onto a call it does not own.
//
// It answers FAST and unconditionally 200. Providers treat a non-2xx as a
// failure and retry, and a retry storm caused by our own slow write is a worse
// outcome than a status update landing a second later.

import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { callService } from '@wizeworks/crm';
import { resolveVoiceProvider } from '@wizeworks/voice';

import { verifyCallStatusToken } from '../../../lib/crm-voice.js';

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; registration is sync.
const crmCallStatusRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/v1/public/crm/calls/status',
    // Vendors post `application/x-www-form-urlencoded`, not JSON.
    { config: { rawBody: false } },
    async (request, reply): Promise<FastifyReply> => {
      const query = (request.query ?? {}) as { t?: string };
      const tenantId = query.t ? await verifyCallStatusToken(query.t) : null;
      if (!tenantId) {
        // An unsigned or forged callback is answered 200 and dropped. Telling a
        // caller their token was rejected only helps somebody probing for one.
        return reply.code(200).send();
      }

      const body = (request.body ?? {}) as Record<string, unknown>;
      // The provider's own parser turns its vocabulary into ours. `null` means
      // this is not a terminal status (`ringing`, `in-progress`) and there is
      // nothing yet to record.
      const update = resolveVoiceProvider({
        provider: 'twilio',
        accountSid: 'webhook',
        authToken: 'webhook',
        fromNumber: '+10000000000',
      }).parseStatus(body);
      if (!update) return reply.code(200).send();

      // Fire and forget: the write is idempotent on the provider's call id, so a
      // retry updates the row it belongs to rather than creating a second call.
      void callService
        .recordStatus({ tenantId }, update)
        .catch((err: unknown) =>
          request.log.warn({ err, tenantId }, 'crm-call-status: write failed')
        );

      return reply.code(200).send();
    }
  );
};

export default crmCallStatusRoutes;
