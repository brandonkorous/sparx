// Social MCP tools (docs/133) — compose, edit, and run the post lifecycle from an
// agent. Thin wrappers over the @sparx/social/service layer the REST routes drive
// (one service, many transports). Lifecycle transitions that wake the publish
// worker emit the SAME Pub/Sub events the routes do (`social.post.due` /
// `social.post.scheduled`); like the CMS MCP tools, we emit with a console logger
// since the MCP server has no Fastify request.
//
// Not here (OAuth / connection provisioning): connecting a platform account,
// disconnecting, metrics refresh, and per-target settings live behind the OAuth +
// settings routes, which are provisioning surfaces, not post authoring.

import { z } from 'zod';
import { publish } from '@sparx/api-core/pubsub';

import {
  approveSocialPost,
  createSocialPost,
  deleteSocialPost,
  getSocialPost,
  listSocialConnections,
  listSocialPosts,
  markPostPublishing,
  rejectSocialPost,
  scheduleSocialPost,
  submitForApproval,
  updateSocialPost,
  type CreateSocialPostInput,
  type LifecycleResult,
} from '../service.js';

import type { McpToolDefinition, SocialMcpCtx } from './registry.js';

// `publish` wants a logger; the MCP service has no Fastify request, so a
// console-backed one (derived from publish's own signature — no fastify dep).
const mcpLogger = console as unknown as Parameters<typeof publish>[0];

async function emitLifecycle(
  ctx: SocialMcpCtx,
  postId: string,
  result: LifecycleResult
): Promise<void> {
  if (result.emitDue) {
    await publish(mcpLogger, 'social.post.due', ctx.tenantId, ctx.userId, { postId });
  } else if (result.emitScheduled) {
    await publish(mcpLogger, 'social.post.scheduled', ctx.tenantId, ctx.userId, { postId });
  }
}

const uuid = () => z.string().uuid();

// ── Read ────────────────────────────────────────────────────────────────────

const listConnections: McpToolDefinition = {
  name: 'list_social_connections',
  description:
    'List the tenant’s connected social accounts and the publish targets under each (the pages / profiles / boards a post can go to — Facebook Pages, Instagram, Pinterest boards, etc.). Use a target’s `id` as create_social_post → `targets[].targetId`. Only targets with `enabled: true` accept posts. Each connection carries a `propertyId` (the site it speaks for; null = tenant-wide). Connecting a NEW account is not doable here — it needs an OAuth sign-in in the app.',
  scope: 'read:social',
  confirmation: false,
  input: z.object({}),
  run: (ctx) => listSocialConnections(ctx),
};

const listPosts: McpToolDefinition = {
  name: 'list_social_posts',
  description:
    'List social posts, optionally filtered by status (draft / pending_approval / scheduled / publishing / published / failed) or site. Returns each post with its per-platform target rows.',
  scope: 'read:social',
  confirmation: false,
  input: z.object({
    status: z.string().max(40).optional(),
    propertyId: uuid().nullable().optional(),
  }),
  run: (ctx, input) =>
    listSocialPosts(ctx, input as { status?: string; propertyId?: string | null }),
};

const getPost: McpToolDefinition = {
  name: 'get_social_post',
  description: 'Fetch one social post by id, with its per-platform target rows and status.',
  scope: 'read:social',
  confirmation: false,
  input: z.object({ postId: uuid() }),
  run: (ctx, input) => getSocialPost(ctx, (input as { postId: string }).postId),
};

// ── Compose / edit ────────────────────────────────────────────────────────────

const CreatePostSchema = z.object({
  body: z.string().min(1).max(10_000),
  propertyId: uuid().nullable().optional(),
  link: z.string().url().max(2048).nullable().optional(),
  mediaAssetIds: z.array(uuid()).max(20).optional(),
  source: z.string().max(63).optional(),
  sourceRef: z.string().max(255).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  targets: z
    .array(
      z.object({
        targetId: uuid(),
        textOverride: z.string().max(10_000).optional(),
        firstComment: z.string().max(10_000).optional(),
      })
    )
    .min(1)
    .max(20),
});

const createPost: McpToolDefinition = {
  name: 'create_social_post',
  description:
    'Compose a social post as a DRAFT and fan it out to one or more connected targets (accounts). Nothing publishes yet — submit_social_post_for_approval, schedule_social_post, or publish_social_post moves it forward. `targets[].targetId` are social target ids the tenant has connected + enabled.',
  scope: 'write:social',
  confirmation: true,
  input: CreatePostSchema,
  run: (ctx, input) => {
    const parsed = input as z.infer<typeof CreatePostSchema>;
    const payload: CreateSocialPostInput = {
      ...parsed,
      scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt) : null,
    };
    return createSocialPost(ctx, payload);
  },
};

const updatePost: McpToolDefinition = {
  name: 'update_social_post',
  description:
    'Edit a social post’s body, link, media, or scheduled time. Only editable until it starts publishing (draft / pending_approval / scheduled / failed).',
  scope: 'write:social',
  confirmation: true,
  input: z.object({
    postId: uuid(),
    body: z.string().min(1).max(10_000).optional(),
    link: z.string().url().max(2048).nullable().optional(),
    mediaAssetIds: z.array(uuid()).max(20).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
  }),
  run: (ctx, input) => {
    const i = input as {
      postId: string;
      body?: string;
      link?: string | null;
      mediaAssetIds?: string[];
      scheduledAt?: string | null;
    };
    return updateSocialPost(ctx, i.postId, {
      ...(i.body !== undefined ? { body: i.body } : {}),
      ...(i.link !== undefined ? { link: i.link } : {}),
      ...(i.mediaAssetIds !== undefined ? { mediaAssetIds: i.mediaAssetIds } : {}),
      ...(i.scheduledAt !== undefined
        ? { scheduledAt: i.scheduledAt ? new Date(i.scheduledAt) : null }
        : {}),
    });
  },
};

const deletePost: McpToolDefinition = {
  name: 'delete_social_post',
  description: 'Delete a social post.',
  scope: 'write:social',
  confirmation: true,
  input: z.object({ postId: uuid() }),
  run: (ctx, input) => deleteSocialPost(ctx, (input as { postId: string }).postId),
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

const submitPost: McpToolDefinition = {
  name: 'submit_social_post_for_approval',
  description: 'Submit a draft post for admin review (draft → pending approval).',
  scope: 'write:social',
  confirmation: true,
  input: z.object({ postId: uuid() }),
  run: (ctx, input) => submitForApproval(ctx, (input as { postId: string }).postId),
};

const schedulePost: McpToolDefinition = {
  name: 'schedule_social_post',
  description:
    'Schedule a post for a future time (ISO-8601). If approval is required and the post isn’t approved yet, it parks in pending approval holding the time. Publishes to real accounts at that time.',
  scope: 'write:social',
  confirmation: true,
  input: z.object({ postId: uuid(), scheduledAt: z.string().datetime() }),
  run: async (ctx, input) => {
    const { postId, scheduledAt } = input as { postId: string; scheduledAt: string };
    const result = await scheduleSocialPost(ctx, postId, new Date(scheduledAt));
    if (result) await emitLifecycle(ctx, postId, result);
    return result?.post ?? null;
  },
};

const approvePost: McpToolDefinition = {
  name: 'approve_social_post',
  description:
    'Approve a post awaiting review. A future scheduled time → scheduled; otherwise it publishes now. Publishes to real accounts — confirm first.',
  scope: 'write:social',
  confirmation: true,
  input: z.object({ postId: uuid() }),
  run: async (ctx, input) => {
    const { postId } = input as { postId: string };
    const result = await approveSocialPost(ctx, postId);
    if (result) await emitLifecycle(ctx, postId, result);
    return result?.post ?? null;
  },
};

const rejectPost: McpToolDefinition = {
  name: 'reject_social_post',
  description: 'Reject a post awaiting review, sending it back to draft for revision.',
  scope: 'write:social',
  confirmation: true,
  input: z.object({ postId: uuid() }),
  run: (ctx, input) => rejectSocialPost(ctx, (input as { postId: string }).postId),
};

const publishPost: McpToolDefinition = {
  name: 'publish_social_post',
  description:
    'Publish a post to its connected accounts NOW (arms its targets and hands off to the publish worker). Publishes to real accounts — confirm first.',
  scope: 'write:social',
  confirmation: true,
  input: z.object({ postId: uuid() }),
  run: async (ctx, input) => {
    const { postId } = input as { postId: string };
    const result = await markPostPublishing(ctx, postId);
    if (result) {
      await publish(mcpLogger, 'social.post.due', ctx.tenantId, ctx.userId, { postId });
    }
    return result;
  },
};

export const readTools: McpToolDefinition[] = [listConnections, listPosts, getPost];
export const writeTools: McpToolDefinition[] = [
  createPost,
  updatePost,
  deletePost,
  submitPost,
  schedulePost,
  approvePost,
  rejectPost,
  publishPost,
];
