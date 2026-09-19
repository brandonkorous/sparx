// Email sequences — reusable multi-touch journeys (docs/81 §9). A sequence is an
// ordered list of steps (delay + email); people are enrolled (by the
// `email.sequence_add` action or manually here) and a worker drain advances each
// enrollment on its own clock.
//
//   GET    /v1/email/sequences                  → list (with per-status counts +
//                                                 how many automations enroll into each)
//   POST   /v1/email/sequences                  → create (draft)
//   GET    /v1/email/sequences/:id              → one
//   PATCH  /v1/email/sequences/:id              → update
//   DELETE /v1/email/sequences/:id              → delete a never-used draft, else archive
//   GET    /v1/email/sequences/:id/enrollments  → list enrollments
//   POST   /v1/email/sequences/:id/enroll       → manually enroll a person
//   POST   /v1/email/sequences/:id/unenroll     → cancel a person's active enrollment

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
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
  parseSteps,
  type CreateSequenceInput,
  type UpdateSequenceInput,
} from '@wizeworks/email-sequences';
import { settingsService } from '@wizeworks/email-platform';
import { countAutomationsByActionConfig, type ActionUseCount } from '@wizeworks/automation';
// Universal search (docs/39): a sequence is an `email_sequence` entity. Its name
// is what an owner types to find it, so every write that moves one re-indexes.
import { indexEntity } from '@wizeworks/events';
import { ok } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { badRequest, notFound } from '@wizeworks/api-core/errors';
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

/** The action that puts a person into a sequence. Named once, because it is the
 *  join between two modules and a typo here reports "nothing adds anyone" for a
 *  sequence three automations feed. */
const ENROLL_ACTION = 'email.sequence_add';

const NO_ENROLLERS: ActionUseCount = { total: 0, live: 0 };

/**
 * How many automations add people to each sequence.
 *
 * A sequence sends nothing on its own — something has to enroll a person, and the
 * only two somethings are an automation carrying `email.sequence_add` and a hand
 * enrollment from the Enrolled screen. Without this number the console can say
 * "this sequence is on" about a journey that will never reach one customer, which
 * is what it was saying: 2,411 automations on this platform, none of them
 * enrolling, and every one of the 15 sequences at zero enrollments forever
 * (issue 647).
 *
 * ONE query for the whole page, so the list can carry it too.
 */
async function enrollersFor(
  request: FastifyRequest,
  ids: string[]
): Promise<Map<string, ActionUseCount>> {
  if (ids.length === 0) return new Map();
  const ctx = toEmailContext(request);
  return countAutomationsByActionConfig({ tenantId: ctx.tenantId }, ENROLL_ACTION, 'sequenceId');
}

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
    const sequences = await listSequences(toEmailContext(request), {
      status: q.status,
      propertyId,
    });
    const enrollers = await enrollersFor(
      request,
      sequences.map((s) => s.id)
    );
    return ok(sequences.map((s) => ({ ...s, enrollers: enrollers.get(s.id) ?? NO_ENROLLERS })));
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
    const ctx = toEmailContext(request);
    const row = await createSequence(ctx, body as CreateSequenceInput);
    await indexEntity({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      entityType: 'email_sequence',
      recordId: row.id,
    });
    reply.code(201);
    return ok(row);
  });

  app.get('/v1/email/sequences/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    const sequence = await getSequence(toEmailContext(request), id);
    if (!sequence) throw notFound('EmailSequence', id);
    const enrollers = await enrollersFor(request, [id]);
    return ok({ ...sequence, enrollers: enrollers.get(id) ?? NO_ENROLLERS });
  });

  app.patch('/v1/email/sequences/:id', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    const ctx = toEmailContext(request);
    const patch = request.body as UpdateSequenceInput;

    // Turning a sequence ON is the sequence's Send button, so it carries the
    // same CAN-SPAM refusal a broadcast does (issue 617): a marketing step
    // needs a postal address in its footer, and `frame.ts` only prints one when
    // there IS one. Refused here rather than at the drain, where it would be a
    // silent omission in a worker nobody watches.
    //
    // The check sits in the ROUTE because `@wizeworks/email-sequences` is
    // deliberately backend-safe (db + email-sends only) and must not take on
    // email-platform. Re-deriving the site fallback inside it would be a second
    // implementation of the identity resolution, which is exactly how the
    // console once told an owner one sending address while her customers got
    // another.
    if (patch.status === 'active') {
      const sequence = await getSequence(ctx, id);
      if (!sequence) throw notFound('EmailSequence', id);
      const steps = parseSteps(patch.steps ?? sequence.steps);
      if (steps.some((step) => step.emailType === 'marketing')) {
        const settings = await settingsService.get(ctx, sequence.propertyId ?? null);
        if ((settings.physicalAddress ?? '').trim() === '') {
          throw badRequest(
            'Add your mailing address in Email settings before turning this on. ' +
              'Anti-spam law requires a real postal address in the footer of every ' +
              'marketing email, and this sequence sends one.'
          );
        }
      }
    }

    const updated = await updateSequence(ctx, id, patch);
    // The name, the description and the on/off status are all indexed.
    await indexEntity({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      entityType: 'email_sequence',
      recordId: id,
    });
    return ok(updated);
  });

  app.delete('/v1/email/sequences/:id', async (request) => {
    requireRole(request, 'editor');
    await requireEmailModule(request);
    const { id } = IdParam.parse(request.params);
    const ctx = toEmailContext(request);
    const result = await deleteSequence(ctx, id);
    // Deleted OR archived: either way it stops being a thing to find, and the
    // projector answers `null` for a row that is gone.
    await indexEntity({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      entityType: 'email_sequence',
      recordId: id,
      op: result.deleted ? 'delete' : 'upsert',
    });
    return ok(result);
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
