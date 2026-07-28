// Social planning API — the things a person sets up ONCE and then leans on every week:
// the saved hashtag blocks, the weekly posting cadence, and the honest answer to "when
// should I post?" (docs/social-audit slices 17, 19, 20).
//
//   GET/PUT/DELETE /v1/social/hashtag-sets[/:id]  → saved hashtag blocks   (editor)
//   GET/PUT/DELETE /v1/social/slots[/:id]         → the weekly cadence     (editor)
//   GET           /v1/social/best-time            → from their OWN history (viewer)
//
// A sub-plugin of the social routes: none of these is a post or a connection, and
// bundling them into either file would give that file a second job.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import {
  buildComposeSeed,
  createSocialPostsBulk,
  deleteHashtagSet,
  deletePostingSlot,
  getBestTimeToPost,
  listHashtagSets,
  listPostingSlots,
  parseSocialCsv,
  upsertHashtagSet,
  upsertPostingSlot,
} from '@sparx/social/service';
import {
  requireSocialModule,
  resolveSocialProperty,
  toSocialContext,
} from '../../../lib/social-context.js';

const PathId = z.object({ id: z.string().uuid() });

const HashtagSetBody = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  tags: z.array(z.string().max(140)).min(1).max(60),
  platform: z.string().max(40).nullish(),
});

const SlotBody = z.object({
  id: z.string().uuid().optional(),
  weekday: z.number().int().min(0).max(6),
  minuteOfDay: z.number().int().min(0).max(1439),
  timezone: z.string().min(1).max(64),
  targetIds: z.array(z.string().uuid()).max(50),
  enabled: z.boolean().optional(),
  autoFill: z.boolean().optional(),
});

const SeedQuery = z.object({
  type: z.enum(['product', 'collection', 'content']),
  id: z.string().uuid(),
});

const ImportPreviewBody = z.object({ csv: z.string().min(1).max(2_000_000) });
const ImportBody = ImportPreviewBody.extend({
  /** Used for any row that names no accounts of its own — what the import screen
   *  pre-selects. */
  defaultTargetIds: z.array(z.string().uuid()).max(50).optional(),
});

const BestTimeQuery = z.object({
  // The zone the answer is expressed in — a recommendation in UTC is useless to a
  // person deciding when to post.
  timezone: z.string().min(1).max(64).default('UTC'),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const socialPlanningRoutes: FastifyPluginAsync = async (app) => {
  // ── saved hashtag blocks ─────────────────────────────────────────────────────

  app.get('/v1/social/hashtag-sets', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'viewer');
    const sets = await listHashtagSets(
      toSocialContext(request),
      await resolveSocialProperty(request)
    );
    return reply.send(ok({ sets }));
  });

  app.put('/v1/social/hashtag-sets', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const body = HashtagSetBody.parse(request.body);
    const set = await upsertHashtagSet(toSocialContext(request), {
      ...body,
      propertyId: await resolveSocialProperty(request),
    });
    return reply.send(ok(set));
  });

  app.delete('/v1/social/hashtag-sets/:id', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const deleted = await deleteHashtagSet(toSocialContext(request), id);
    if (!deleted) throw notFound('hashtag set', id);
    return reply.status(204).send();
  });

  // ── the weekly cadence ───────────────────────────────────────────────────────

  app.get('/v1/social/slots', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'viewer');
    const slots = await listPostingSlots(
      toSocialContext(request),
      await resolveSocialProperty(request)
    );
    return reply.send(ok({ slots }));
  });

  app.put('/v1/social/slots', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const body = SlotBody.parse(request.body);
    const slot = await upsertPostingSlot(toSocialContext(request), {
      ...body,
      propertyId: await resolveSocialProperty(request),
    });
    return reply.send(ok(slot));
  });

  app.delete('/v1/social/slots/:id', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const deleted = await deletePostingSlot(toSocialContext(request), id);
    if (!deleted) throw notFound('posting slot', id);
    return reply.status(204).send();
  });

  // ── when to post ─────────────────────────────────────────────────────────────

  // Drawn from THIS business's published posts and the numbers they got — not an
  // industry average, which tells a parts distributor the same thing it tells a bakery.
  // Reports `confident: false` rather than guessing when the history is too thin.
  app.get('/v1/social/best-time', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'viewer');
    const { timezone } = BestTimeQuery.parse(request.query);
    const report = await getBestTimeToPost(
      toSocialContext(request),
      timezone,
      await resolveSocialProperty(request)
    );
    return reply.send(ok(report));
  });

  // ── share something you published ────────────────────────────────────────────

  // Turn a product, collection or article into a suggested draft — the moment someone
  // is most likely to want to post is right after publishing, and until now the composer
  // opened blank and they retyped the title by hand (docs/social-audit slice 8).
  app.get('/v1/social/compose-seed', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const { type, id } = SeedQuery.parse(request.query);
    const seed = await buildComposeSeed(toSocialContext(request), type, id);
    if (!seed) throw notFound(type, id);
    return reply.send(ok(seed));
  });

  // ── a month of posts from a spreadsheet ──────────────────────────────────────

  // Two steps on purpose: PREVIEW parses and reports what is wrong with line 14 before
  // anything exists, then IMPORT creates. Nobody should discover a broken import by
  // finding thirty half-right drafts.
  app.post('/v1/social/import/preview', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const { csv } = ImportPreviewBody.parse(request.body);
    const parsed = parseSocialCsv(csv);
    return reply.send(
      ok({
        rows: parsed.rows.map((r) => ({
          ...r,
          scheduledAt: r.scheduledAt?.toISOString() ?? null,
        })),
        problems: parsed.problems,
      })
    );
  });

  app.post('/v1/social/import', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const body = ImportBody.parse(request.body);
    const parsed = parseSocialCsv(body.csv);
    const result = await createSocialPostsBulk(toSocialContext(request), parsed.rows, {
      propertyId: await resolveSocialProperty(request),
      defaultTargetIds: body.defaultTargetIds,
    });
    return reply.status(201).send(
      ok({
        ...result,
        // Parse problems and import problems are the same thing to the person reading
        // them: "these lines didn't make it, here's why".
        problems: [...parsed.problems, ...result.problems].sort((a, b) => a.line - b.line),
      })
    );
  });
};

export default socialPlanningRoutes;
