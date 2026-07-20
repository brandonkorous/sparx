// AI prompt-template library routes (docs/07 §9). CRUD over the tenant's reusable
// AI prompts + an "install the platform defaults" action. AI-module-gated; reads
// are viewer, writes are editor, the bulk default-install is admin (matches the
// sample-data / starter provisioning bar).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';

import { requireAiModule, toAiContext } from '../../../lib/ai-context.js';
import { resolvePropertyId } from '../../../lib/property.js';
import {
  createPromptTemplate,
  deletePromptTemplate,
  ensureDefaultPromptTemplates,
  getPromptTemplate,
  listPromptTemplates,
  updatePromptTemplate,
} from '../../../lib/ai/prompt-templates.js';
import {
  PROMPT_CATEGORIES,
  PromptTemplateCreateSchema,
  PromptTemplateUpdateSchema,
} from '../../../lib/ai/types.js';

const ListQuery = z.object({ category: z.enum(PROMPT_CATEGORIES).optional() });
const IdParam = z.object({ id: z.string().uuid() });

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; route registration is sync.
const aiPromptTemplateRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/ai/prompt-templates', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireAiModule(request);
    const { category } = ListQuery.parse(request.query);
    // This site's prompts plus the tenant-wide ones (docs/131 §3.5).
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    return ok(
      await listPromptTemplates(toAiContext(request), {
        category: category,
        propertyId,
      })
    );
  });

  app.get('/v1/ai/prompt-templates/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireAiModule(request);
    const { id } = IdParam.parse(request.params);
    return ok(await getPromptTemplate(toAiContext(request), id));
  });

  app.post('/v1/ai/prompt-templates', async (request, reply) => {
    const auth = requireRole(request, 'editor');
    await requireAiModule(request);
    const input = PromptTemplateCreateSchema.parse(request.body);
    const propertyId = await resolvePropertyId(
      auth,
      request.headers['x-sparx-property-id'] as string | undefined
    );
    const created = await createPromptTemplate(toAiContext(request), {
      ...input,
      // Omitted → the site being worked in; only an EXPLICIT null shares it
      // across every site. A persona authored while looking at one business
      // should belong to that business without the author having to say so.
      propertyId: input.propertyId === undefined ? propertyId : input.propertyId,
    });
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/ai/prompt-templates/:id', async (request) => {
    requireRole(request, 'editor');
    await requireAiModule(request);
    const { id } = IdParam.parse(request.params);
    const patch = PromptTemplateUpdateSchema.parse(request.body);
    return ok(await updatePromptTemplate(toAiContext(request), id, patch));
  });

  app.delete('/v1/ai/prompt-templates/:id', async (request) => {
    requireRole(request, 'editor');
    await requireAiModule(request);
    const { id } = IdParam.parse(request.params);
    await deletePromptTemplate(toAiContext(request), id);
    return ok({ deleted: true });
  });

  // Install (ensure-by-key) every platform-default prompt. Idempotent — returns how
  // many were added. The dashboard's empty-state CTA + the `ai` preset both use it.
  app.post('/v1/ai/prompt-templates/install-defaults', async (request, reply) => {
    requireRole(request, 'admin');
    await requireAiModule(request);
    const added = await ensureDefaultPromptTemplates(toAiContext(request));
    reply.code(201);
    return ok({ added });
  });
};

export default aiPromptTemplateRoutes;
