// Email sequences — reusable multi-touch journeys (docs/81 §9). A sequence is an
// ordered list of steps (delay + email); people are enrolled (by the
// `email.sequence_add` action or manually here) and a worker drain advances each
// enrollment on its own clock.
//
//   GET    /v1/email/sequences                  → list (with per-status counts)
//   POST   /v1/email/sequences                  → create (draft)
//   GET    /v1/email/sequences/:id              → one
//   PATCH  /v1/email/sequences/:id              → update
//   DELETE /v1/email/sequences/:id              → delete a never-used draft, else archive
//   GET    /v1/email/sequences/:id/enrollments  → list enrollments
//   POST   /v1/email/sequences/:id/enroll       → manually enroll a person
//   POST   /v1/email/sequences/:id/unenroll     → cancel a person's active enrollment

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createSequence,
  updateSequence,
  listSequences,
  getSequence,
  deleteSequence,
  enroll,
  unenroll,
  listEnrollments,
  SequenceStatus,
  EnrollmentStatus,
  type CreateSequenceInput,
  type UpdateSequenceInput,
} from '@wizeworks/email-sequences';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { notFound } from '@wizeworks/api-core/errors';
import { requireEmailModule, toEmailContext } from '../../../lib/email-context.js';
import { resolveListScope, resolvePropertyId } from '../../../lib/property.js';

const IdParam = z.object({ id: z.string().uuid() });

// `property` mirrors the shared list-scope contract (property.ts): a specific site
// id → that site, `all` → every site (tenant-wide + all sites), absent → the active
// site (`x-sparx-property-id`, else the tenant's primary).
const ListSequencesQuery = z.object({
  status: SequenceStatus.optional(),
  property: z.string().optional(),
});

const EnrollmentsQuery = z.object({
  status: EnrollmentStatus.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

// A manual enroll from the UI names a person by CRM id or bare address — the
// automation-driven fields (sourceAutomationId / sourceRefs) are not caller input.
const EnrollBody = z.object({
  customerId: z.string().uuid().nullish(),
  recipientEmail: z.string().email().nullish(),
});

const UnenrollBody = z.object({
  customerId: z.string().uuid().nullish(),
  email: z.string().email().nullish(),
});

const emailSequenceRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/email/sequences', async (request) => {
    const auth = requireRole(request, 'viewer');
    await requireEmailModule(request);
    const q = ListSequencesQuery.parse(request.query);
    // `undefined` here means "every site" to listSequences — exactly what `?property=all`
    // resolves to; a specific id scopes to that one site.
    const propertyId = await resolveListScope(
      auth,
      q.property,
      request.headers['x-sparx-property-id']
    );
    return ok(await listSequences(toEmailContext(request), { status: q.status, propertyId }));
  });

  app.post('/v1/email/sequences', async (request, reply) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const body = { ...((request.body ?? {}) as Record<string, unknown>) };
    // A new sequence belongs to the active site by default (docs/49) — the same
    // default a new broadcast/automation takes. An explicit propertyId (including
    // `null` = tenant-wide) is honored verbatim; only an OMITTED one is filled in.
    if (body.propertyId === undefined) {
      const requested = request.headers['x-sparx-property-id'];
      body.propertyId = await resolvePropertyId(
        requireAuth(request),
        typeof requested === 'string' ? requested : null
      );
    }
    const row = await createSequence(toEmailContext(request), body as CreateSequenceInput);
    reply.code(201);
    return ok(row);
  });

  app.get('/v1/email/sequences/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    const sequence = await getSequence(toEmailContext(request), id);
    if (!sequence) throw notFound('EmailSequence', id);
    return ok(sequence);
  });

  app.patch('/v1/email/sequences/:id', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    return ok(
      await updateSequence(toEmailContext(request), id, request.body as UpdateSequenceInput)
    );
  });

  app.delete('/v1/email/sequences/:id', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    return ok(await deleteSequence(toEmailContext(request), id));
  });

  app.get('/v1/email/sequences/:id/enrollments', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    const q = EnrollmentsQuery.parse(request.query);
    return ok(
      await listEnrollments(toEmailContext(request), id, { status: q.status, limit: q.limit })
    );
  });

  app.post('/v1/email/sequences/:id/enroll', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    const body = EnrollBody.parse(request.body);
    // Return the full EnrollResult — `reason` lets the UI explain a no-op enroll
    // (already active, do-not-contact, sequence not live, …) rather than failing.
    return ok(await enroll(toEmailContext(request), id, body));
  });

  app.post('/v1/email/sequences/:id/unenroll', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    const body = UnenrollBody.parse(request.body);
    return ok(await unenroll(toEmailContext(request), id, body));
  });

  return Promise.resolve();
};

export default emailSequenceRoutes;
