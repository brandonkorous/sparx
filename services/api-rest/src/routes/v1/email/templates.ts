// Email templates — built-in TRANSACTIONAL templates only (OTP / password reset /
// welcome / order-confirmation, …). Tenants customize a constrained layer (subject
// + intro/outro slots); branding is global. Marketing emails are authored in the
// Email Builder (docs/52, /builder/email) — the section-list "authored template"
// model is retired (docs/52 §8), so there are no authored-template routes here.
//
//   GET    /v1/email/templates                          → list (builtins)
//   GET    /v1/email/templates/builtin/:key             → one built-in (+ override)
//   PATCH  /v1/email/templates/builtin/:key             → save override (subject + slots)
//   GET    /v1/email/templates/builtin/:key/preview     → rendered HTML
//   POST   /v1/email/templates/builtin/:key/test-send   → send a test

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { templateService } from '@sparx/email-platform';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireEmailModule, toEmailContext } from '../../../lib/email-context.js';

const KeyParam = z.object({ key: z.string().min(1).max(63) });

const emailTemplateRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/email/templates', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    return ok(await templateService.list(toEmailContext(request)));
  });

  app.get('/v1/email/templates/builtin/:key', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const { key } = KeyParam.parse(request.params);
    return ok(await templateService.getBuiltin(toEmailContext(request), key));
  });

  app.patch('/v1/email/templates/builtin/:key', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const { key } = KeyParam.parse(request.params);
    return ok(
      await templateService.saveBuiltinOverride(toEmailContext(request), key, request.body)
    );
  });

  app.get('/v1/email/templates/builtin/:key/preview', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const { key } = KeyParam.parse(request.params);
    return ok(
      await templateService.renderPreview(toEmailContext(request), { source: 'builtin', key })
    );
  });

  app.post('/v1/email/templates/builtin/:key/test-send', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const { key } = KeyParam.parse(request.params);
    return ok(
      await templateService.testSend(
        toEmailContext(request),
        { source: 'builtin', key },
        request.body
      )
    );
  });

  return Promise.resolve();
};

export default emailTemplateRoutes;
