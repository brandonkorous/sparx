// Social posts API (docs/133 §5, §7) — compose, list, edit, publish-now, delete. A
// sub-plugin of the social routes (a connection and a post are different resources
// with different lifecycles). Gated on the `social` module.
//
//   POST   /v1/social/posts             → create a draft + its fan-out targets   (editor)
//   GET    /v1/social/posts             → list (optional ?status=)               (viewer)
//   GET    /v1/social/posts/:id         → one post + per-target status           (viewer)
//   PATCH  /v1/social/posts/:id         → edit a draft                           (editor)
//   POST   /v1/social/posts/:id/submit  → send a draft to the approval inbox     (editor)
//   POST   /v1/social/posts/:id/schedule→ schedule for a future time             (editor)
//   POST   /v1/social/posts/:id/approve → approve → scheduled or publish now      (admin)
//   POST   /v1/social/posts/:id/reject  → reject → back to draft                  (admin)
//   POST   /v1/social/posts/:id/publish → publish now (→ social.post.due)         (admin)
//   DELETE /v1/social/posts/:id         → delete                                  (admin)
//
// The role split IS the approval permission (docs/133 §15.3): editors compose,
// schedule, and submit; admins approve, publish, and push to the live brand accounts.
//
// Publishing itself (token resolve, render, platform I/O) is the social-worker's job:
// the api-rest side only flips post state and emits the event the worker consumes —
// `social.post.due` when a post is publishing now, `social.post.scheduled` when it is
// queued for a future time (the scheduled drain later re-emits `social.post.due`).

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { publish } from '@sparx/api-core/pubsub';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import {
  requireSocialModule,
  resolveSocialProperty,
  toSocialContext,
} from '../../../lib/social-context.js';
import {
  createSocialPost,
  deleteSocialPost,
  duplicateSocialPost,
  getSocialPost,
  listSocialPosts,
  markPostPublishing,
  retrySocialPostTarget,
  setSocialPostEvergreen,
  updateSocialPost,
  updateSocialPostTargets,
} from '../../../lib/social-posts.js';
import {
  approveSocialPost,
  rejectSocialPost,
  scheduleSocialPost,
  submitForApproval,
  type LifecycleResult,
} from '../../../lib/social-lifecycle.js';
import { getPostMetrics } from '../../../lib/social-metrics.js';
import { SOCIAL_POST_SOURCES } from '@sparx/social';

const PathId = z.object({ id: z.string().uuid() });
const PathIdTarget = z.object({ id: z.string().uuid(), targetId: z.string().uuid() });
const ListQuery = z.object({ status: z.string().max(24).optional() });
const ScheduleBody = z.object({ scheduledAt: z.string().datetime() });
const RejectBody = z.object({ note: z.string().max(2000).optional() });
const EvergreenBody = z.object({ evergreen: z.boolean() });

/** Changing where a post goes, after it was created. Every field optional — the composer
 *  sends the whole selection and the service diffs it. */
const TargetsBody = z.object({
  add: z
    .array(
      z.object({
        targetId: z.string().uuid(),
        textOverride: z.string().max(63206).optional(),
        firstComment: z.string().max(2000).optional(),
      })
    )
    .optional(),
  remove: z.array(z.string().uuid()).optional(),
  update: z
    .array(
      z.object({
        id: z.string().uuid(),
        textOverride: z.string().max(63206).nullish(),
        firstComment: z.string().max(2000).nullish(),
        // A destination's OWN send time. `null` puts it back on the post's clock.
        scheduledAt: z.string().datetime().nullish(),
      })
    )
    .optional(),
});

const CreateBody = z.object({
  propertyId: z.string().uuid().nullish(),
  body: z.string().min(1).max(63206),
  link: z.string().url().nullish(),
  mediaAssetIds: z.array(z.string().uuid()).max(20).optional(),
  source: z.enum(SOCIAL_POST_SOURCES).optional(),
  sourceRef: z.string().max(255).nullish(),
  targets: z
    .array(
      z.object({
        targetId: z.string().uuid(),
        textOverride: z.string().max(63206).optional(),
        firstComment: z.string().max(2000).optional(),
      })
    )
    .min(1),
});

const UpdateBody = z.object({
  body: z.string().min(1).max(63206).optional(),
  link: z.string().url().nullish(),
  mediaAssetIds: z.array(z.string().uuid()).max(20).optional(),
});

/** Emit the Pub/Sub event a lifecycle transition asks for: `social.post.due` when the
 *  post is publishing now (the worker drains it), `social.post.scheduled` when it is
 *  queued for a future time. Kept on the route (mirrors publish-now) so the lifecycle
 *  helpers stay free of publisher plumbing. */
async function emitLifecycle(
  request: FastifyRequest,
  tenantId: string,
  actorId: string,
  postId: string,
  result: LifecycleResult
): Promise<void> {
  if (result.emitDue) {
    await publish(request.log, 'social.post.due', tenantId, actorId, { postId });
  } else if (result.emitScheduled) {
    await publish(request.log, 'social.post.scheduled', tenantId, actorId, {
      postId,
      scheduledAt: result.post.scheduledAt,
    });
  }
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature
const socialPostRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/social/posts', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const body = CreateBody.parse(request.body);
    const post = await createSocialPost(toSocialContext(request), {
      // Stamp the site being worked in, so a post belongs to ONE business the way its
      // destinations do. An explicit propertyId in the body still wins (an agent or an
      // automation targeting a specific site).
      propertyId: body.propertyId ?? (await resolveSocialProperty(request)),
      body: body.body,
      link: body.link ?? null,
      mediaAssetIds: body.mediaAssetIds,
      source: body.source,
      sourceRef: body.sourceRef ?? null,
      targets: body.targets,
    });
    return reply.status(201).send(ok(post));
  });

  app.get('/v1/social/posts', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'viewer');
    const { status } = ListQuery.parse(request.query);
    const posts = await listSocialPosts(toSocialContext(request), {
      status,
      propertyId: await resolveSocialProperty(request),
    });
    return reply.send(ok({ posts }));
  });

  app.get('/v1/social/posts/:id', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    const post = await getSocialPost(toSocialContext(request), id);
    if (!post) throw notFound('post', id);
    return reply.send(ok(post));
  });

  app.patch('/v1/social/posts/:id', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const patch = UpdateBody.parse(request.body);
    const post = await updateSocialPost(toSocialContext(request), id, {
      body: patch.body,
      link: patch.link,
      mediaAssetIds: patch.mediaAssetIds,
    });
    if (!post) throw notFound('post', id);
    return reply.send(ok(post));
  });

  // ── lifecycle ────────────────────────────────────────────────────────────────

  app.post('/v1/social/posts/:id/submit', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const post = await submitForApproval(toSocialContext(request), id);
    if (!post) throw notFound('post', id);
    return reply.send(ok(post));
  });

  app.post('/v1/social/posts/:id/schedule', async (request, reply) => {
    await requireSocialModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const { scheduledAt } = ScheduleBody.parse(request.body);
    const ctx = toSocialContext(request);
    const result = await scheduleSocialPost(ctx, id, new Date(scheduledAt));
    if (!result) throw notFound('post', id);
    await emitLifecycle(request, ctx.tenantId, auth.actorId, id, result);
    return reply.send(ok(result.post));
  });

  app.post('/v1/social/posts/:id/approve', async (request, reply) => {
    await requireSocialModule(request);
    const auth = requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    const ctx = toSocialContext(request);
    const result = await approveSocialPost(ctx, id);
    if (!result) throw notFound('post', id);
    await emitLifecycle(request, ctx.tenantId, auth.actorId, id, result);
    return reply.send(ok(result.post));
  });

  app.post('/v1/social/posts/:id/reject', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    const { note } = RejectBody.parse(request.body ?? {});
    const post = await rejectSocialPost(toSocialContext(request), id, note);
    if (!post) throw notFound('post', id);
    return reply.send(ok(post));
  });

  // ── where it goes ────────────────────────────────────────────────────────────

  // Change the destinations, the per-destination wording, or a destination's own send
  // time — after the post was created. Until this existed, all three were frozen at
  // creation, which made an almost-right post a rebuild (docs/social-audit GAP 4).
  app.patch('/v1/social/posts/:id/targets', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const body = TargetsBody.parse(request.body);
    const post = await updateSocialPostTargets(toSocialContext(request), id, {
      add: body.add,
      remove: body.remove,
      update: body.update?.map((u) => ({
        id: u.id,
        ...(u.textOverride !== undefined ? { textOverride: u.textOverride } : {}),
        ...(u.firstComment !== undefined ? { firstComment: u.firstComment } : {}),
        ...(u.scheduledAt !== undefined
          ? { scheduledAt: u.scheduledAt ? new Date(u.scheduledAt) : null }
          : {}),
      })),
    });
    if (!post) throw notFound('post', id);
    return reply.send(ok(post));
  });

  // Retry ONE destination that failed. The whole-post "publish again" re-arms everything
  // that hasn't succeeded; this is the surgical version for the common case — three of
  // four accounts went out and one didn't.
  app.post('/v1/social/posts/:id/targets/:targetId/retry', async (request, reply) => {
    await requireSocialModule(request);
    const auth = requireRole(request, 'admin');
    const { id, targetId } = PathIdTarget.parse(request.params);
    const ctx = toSocialContext(request);
    const result = await retrySocialPostTarget(ctx, id, targetId);
    if (!result) throw notFound('post target', targetId);
    await publish(request.log, 'social.post.due', ctx.tenantId, auth.actorId, { postId: id });
    return reply.send(ok({ retrying: true, postId: id, postTargetId: targetId }));
  });

  // ── post again ───────────────────────────────────────────────────────────────

  // Copy a post into a fresh draft — same words, pictures and destinations. The cheapest
  // real leverage in the module: a seasonal offer or a good explainer stops being retyped.
  app.post('/v1/social/posts/:id/duplicate', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const copy = await duplicateSocialPost(toSocialContext(request), id);
    if (!copy) throw notFound('post', id);
    return reply.status(201).send(ok(copy));
  });

  // Put a post in (or take it out of) the evergreen pool the slot filler draws from.
  app.patch('/v1/social/posts/:id/evergreen', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const { evergreen } = EvergreenBody.parse(request.body);
    const post = await setSocialPostEvergreen(toSocialContext(request), id, evergreen);
    if (!post) throw notFound('post', id);
    return reply.send(ok(post));
  });

  app.post('/v1/social/posts/:id/publish', async (request, reply) => {
    await requireSocialModule(request);
    const auth = requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    const ctx = toSocialContext(request);
    const result = await markPostPublishing(ctx, id);
    if (!result) throw notFound('post', id);
    // Hand the drain to the social-worker (heavy platform I/O off the request path).
    await publish(request.log, 'social.post.due', ctx.tenantId, auth.actorId, { postId: id });
    return reply.send(ok({ publishing: true, postId: id, targetCount: result.targetCount }));
  });

  app.delete('/v1/social/posts/:id', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'admin');
    const { id } = PathId.parse(request.params);
    const deleted = await deleteSocialPost(toSocialContext(request), id);
    if (!deleted) throw notFound('post', id);
    return reply.status(204).send();
  });

  // ── performance (docs/implementation/social.md "Measure") ──────────────────────

  // One post's per-destination numbers (with a snapshot history for a trend). Read of
  // whatever the worker has collected so far — never blocks on a live platform call.
  app.get('/v1/social/posts/:id/metrics', async (request, reply) => {
    await requireSocialModule(request);
    requireRole(request, 'viewer');
    const { id } = PathId.parse(request.params);
    const metrics = await getPostMetrics(toSocialContext(request), id);
    if (!metrics) throw notFound('post', id);
    return reply.send(ok(metrics));
  });

  // Ask the worker to pull fresh numbers (the Insights "Refresh" action). The heavy
  // per-platform I/O is the worker's job — here we just enqueue and 202.
  app.post('/v1/social/posts/:id/metrics/refresh', async (request, reply) => {
    await requireSocialModule(request);
    const auth = requireRole(request, 'editor');
    const { id } = PathId.parse(request.params);
    const ctx = toSocialContext(request);
    const post = await getSocialPost(ctx, id);
    if (!post) throw notFound('post', id);
    await publish(request.log, 'social.metrics.collect', ctx.tenantId, auth.actorId, {
      postId: id,
    });
    return reply.status(202).send(ok({ collecting: true, postId: id }));
  });
};

export default socialPostRoutes;
