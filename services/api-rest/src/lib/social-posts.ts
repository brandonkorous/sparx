// Social post composition + lifecycle (docs/133 §5, §7). DB orchestration over
// social_posts / social_post_targets — the compose/list/edit/publish-now/delete
// surface. The actual publishing (token resolve, render, platform I/O) lives in the
// social-worker; here we only build the post + its fan-out rows and flip it to
// `publishing`, then emit `social.post.due` for the worker to drain.

import { withTenant } from '@sparx/db';
import { badRequest } from '@sparx/api-core/errors';
import type { SocialContext } from './social-context.js';

export interface SocialPostTargetView {
  id: string;
  socialTargetId: string;
  targetName: string;
  platform: string;
  status: string;
  externalId: string | null;
  permalink: string | null;
  error: string | null;
  publishedAt: string | null;
}

export interface SocialPostView {
  id: string;
  propertyId: string | null;
  body: string;
  link: string | null;
  mediaAssetIds: string[];
  status: string;
  source: string;
  sourceRef: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  targets: SocialPostTargetView[];
}

export interface PostRow {
  id: string;
  propertyId: string | null;
  body: string;
  link: string | null;
  mediaAssetIds: string[];
  status: string;
  source: string;
  sourceRef: string | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  targets: {
    id: string;
    socialTargetId: string;
    targetName: string;
    platform: string;
    status: string;
    externalId: string | null;
    permalink: string | null;
    error: string | null;
    publishedAt: Date | null;
  }[];
}

export function toPostView(post: PostRow): SocialPostView {
  return {
    id: post.id,
    propertyId: post.propertyId,
    body: post.body,
    link: post.link,
    mediaAssetIds: post.mediaAssetIds,
    status: post.status,
    source: post.source,
    sourceRef: post.sourceRef,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    targets: post.targets.map((t) => ({
      id: t.id,
      socialTargetId: t.socialTargetId,
      targetName: t.targetName,
      platform: t.platform,
      status: t.status,
      externalId: t.externalId,
      permalink: t.permalink,
      error: t.error,
      publishedAt: t.publishedAt?.toISOString() ?? null,
    })),
  };
}

// ── compose ─────────────────────────────────────────────────────────────────────

export interface CreateSocialPostTargetInput {
  /** A `social_targets.id` the tenant owns + has enabled. */
  targetId: string;
  textOverride?: string;
  firstComment?: string;
}

export interface CreateSocialPostInput {
  propertyId?: string | null;
  body: string;
  link?: string | null;
  mediaAssetIds?: string[];
  source?: string;
  sourceRef?: string | null;
  scheduledAt?: Date | null;
  targets: CreateSocialPostTargetInput[];
}

/** Create a draft post + one fan-out row per selected target. Target name + platform
 *  are denormalized onto each row so publish history survives a later disconnect. */
export async function createSocialPost(
  ctx: SocialContext,
  input: CreateSocialPostInput
): Promise<SocialPostView> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const ids = input.targets.map((t) => t.targetId);
    const rows = await tx.socialTarget.findMany({
      where: { id: { in: ids }, tenantId: ctx.tenantId },
      select: { id: true, name: true, platform: true, enabled: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const t of input.targets) {
      const row = byId.get(t.targetId);
      if (!row) throw badRequest(`Unknown social target: ${t.targetId}`);
      if (!row.enabled) throw badRequest(`Target "${row.name}" is turned off.`);
    }

    const post = await tx.socialPost.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? null,
        body: input.body,
        link: input.link ?? null,
        mediaAssetIds: input.mediaAssetIds ?? [],
        source: input.source ?? 'manual',
        sourceRef: input.sourceRef ?? null,
        scheduledAt: input.scheduledAt ?? null,
        createdById: ctx.userId,
        status: 'draft',
        targets: {
          create: input.targets.map((t) => {
            const row = byId.get(t.targetId)!;
            return {
              tenantId: ctx.tenantId,
              socialTargetId: t.targetId,
              targetName: row.name,
              platform: row.platform,
              textOverride: t.textOverride ?? null,
              firstComment: t.firstComment ?? null,
              status: 'pending',
            };
          }),
        },
      },
      include: { targets: { orderBy: { targetName: 'asc' } } },
    });
    return toPostView(post);
  });
}

// ── read ──────────────────────────────────────────────────────────────────────────

export async function listSocialPosts(
  ctx: SocialContext,
  filter: { status?: string; propertyId?: string | null } = {}
): Promise<SocialPostView[]> {
  const posts = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialPost.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.propertyId !== undefined ? { propertyId: filter.propertyId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { targets: { orderBy: { targetName: 'asc' } } },
    })
  );
  return posts.map(toPostView);
}

export async function getSocialPost(
  ctx: SocialContext,
  id: string
): Promise<SocialPostView | null> {
  const post = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialPost.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { targets: { orderBy: { targetName: 'asc' } } },
    })
  );
  return post ? toPostView(post) : null;
}

// ── edit ──────────────────────────────────────────────────────────────────────────

export interface UpdateSocialPostInput {
  body?: string;
  link?: string | null;
  mediaAssetIds?: string[];
  scheduledAt?: Date | null;
}

/** Editable states: a post can be edited until it starts publishing. */
const EDITABLE_STATUSES = new Set(['draft', 'pending_approval', 'scheduled', 'failed']);

export async function updateSocialPost(
  ctx: SocialContext,
  id: string,
  patch: UpdateSocialPostInput
): Promise<SocialPostView | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const existing = await tx.socialPost.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!existing) return null;
    if (!EDITABLE_STATUSES.has(existing.status)) {
      throw badRequest(`A ${existing.status} post can't be edited.`);
    }
    const post = await tx.socialPost.update({
      where: { id },
      data: {
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.link !== undefined ? { link: patch.link } : {}),
        ...(patch.mediaAssetIds !== undefined ? { mediaAssetIds: patch.mediaAssetIds } : {}),
        ...(patch.scheduledAt !== undefined ? { scheduledAt: patch.scheduledAt } : {}),
      },
      include: { targets: { orderBy: { targetName: 'asc' } } },
    });
    return toPostView(post);
  });
}

export async function deleteSocialPost(ctx: SocialContext, id: string): Promise<boolean> {
  const result = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialPost.deleteMany({ where: { id, tenantId: ctx.tenantId } })
  );
  return result.count > 0;
}

// ── publish now ─────────────────────────────────────────────────────────────────

export interface PublishNowResult {
  postId: string;
  targetCount: number;
}

/** Flip a post to `publishing` and (re)arm its targets for a drain: any pending OR
 *  previously-failed target is reset to `pending` (so "publish again" retries a
 *  failure), succeeded targets are left alone (the worker skips them — idempotent).
 *  Returns null if the post doesn't exist, throws if it has no armable target. */
export async function markPostPublishing(
  ctx: SocialContext,
  id: string
): Promise<PublishNowResult | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const post = await tx.socialPost.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { targets: { select: { id: true, status: true } } },
    });
    if (!post) return null;

    const armable = post.targets.filter((t) => t.status === 'pending' || t.status === 'failed');
    if (armable.length === 0) {
      throw badRequest('This post has no target left to publish.');
    }

    await tx.socialPostTarget.updateMany({
      where: { postId: id, status: { in: ['pending', 'failed'] } },
      data: { status: 'pending', error: null },
    });
    await tx.socialPost.update({ where: { id }, data: { status: 'publishing' } });

    return { postId: id, targetCount: armable.length };
  });
}
