// Social MCP tools (docs/133) — compose, edit, and run the post lifecycle from an
// agent. Thin wrappers over the @sparx/social/service layer the REST routes drive
// (one service, many transports). Lifecycle transitions that wake the publish
// worker emit the SAME Pub/Sub events the routes do (`social.post.due` /
// `social.post.scheduled`); like the CMS MCP tools, we emit with a console logger
// since the MCP server has no Fastify request.
//
// The surface deliberately mirrors what a PERSON can do in the operator app, minus
// provisioning: an agent can discover destinations, draft from a product or article,
// compose, retarget, schedule, approve, publish, retry one failed destination, recycle a
// good post, run the weekly cadence, keep hashtag sets, import a spreadsheet, and answer
// the inbox. A capability that exists in the UI and not here is a keyhole — an agent that
// can post but cannot fix a post that half-failed is worse than one that cannot post.
//
// Not here (OAuth / connection provisioning): connecting a platform account,
// disconnecting, metrics refresh, and per-target enable/disable live behind the OAuth +
// settings routes, which are provisioning surfaces, not post authoring. Connecting an
// account requires a human at a platform sign-in screen and always will.

import { z } from 'zod';
import { publish } from '@sparx/api-core/pubsub';

import { SOCIAL_POST_SOURCES } from '../types.js';

import {
  approveSocialPost,
  buildComposeSeed,
  checkSocialReadiness,
  composeInboxReply,
  createSocialPost,
  createSocialPostsBulk,
  deleteHashtagSet,
  deletePostingSlot,
  deleteSocialPost,
  duplicateSocialPost,
  getBestTimeToPost,
  getInboxThread,
  getSocialPost,
  listHashtagSets,
  listInboxItems,
  listPostingSlots,
  listSocialConnections,
  listSocialPosts,
  markPostPublishing,
  parseSocialCsv,
  rejectSocialPost,
  retrySocialPostTarget,
  scheduleSocialPost,
  setInboxItemStatus,
  setSocialPostEvergreen,
  submitForApproval,
  updateSocialPost,
  updateSocialPostTargets,
  upsertHashtagSet,
  upsertPostingSlot,
  type ComposeSeedType,
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

const checkConnections: McpToolDefinition = {
  name: 'check_social_connections',
  description:
    'Check whether each connected social account can actually do what sparx needs, by comparing the permissions the platform granted against the ones the module asks for. Use this when a post failed for no obvious reason, when an account was just reconnected, or to find out whether a platform has finished reviewing sparx’s app. Each result carries a `verdict` (ready / permissions_missing / awaiting_review / reconnect_required / unverifiable) and a plain-language `detail`; `caveat` is set when something about that account makes the answer unreliable. Makes a live call to each platform, so it is slower than list_social_connections — do not use it just to list accounts.',
  scope: 'read:social',
  confirmation: false,
  input: z.object({ propertyId: uuid().nullable().optional() }),
  run: (ctx, input) =>
    checkSocialReadiness(ctx, (input as { propertyId?: string | null }).propertyId ?? null),
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
  source: z.enum(SOCIAL_POST_SOURCES).optional(),
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
  description:
    'Reject a post awaiting review, sending it back to draft for revision. Always give a `note` saying what needs changing — without one the author gets a state change and has to guess.',
  scope: 'write:social',
  confirmation: true,
  input: z.object({ postId: uuid(), note: z.string().max(2000).optional() }),
  run: (ctx, input) => {
    const i = input as { postId: string; note?: string };
    return rejectSocialPost(ctx, i.postId, i.note);
  },
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

// ── Where a post goes, after it was created ───────────────────────────────────

const updateTargets: McpToolDefinition = {
  name: 'update_social_post_targets',
  description:
    'Change WHERE a saved post goes and how it reads there — add destinations, remove ones that have not published yet, change a per-destination text override or first comment, or give one destination its own send time. Works until the post starts publishing. `add[].targetId` and `remove[]`/`update[].id` are different ids: `add` takes a social TARGET id (from list_social_connections), `remove`/`update` take the post-target row id (from get_social_post → targets[].id).',
  scope: 'write:social',
  confirmation: true,
  input: z.object({
    postId: uuid(),
    add: z
      .array(
        z.object({
          targetId: uuid(),
          textOverride: z.string().max(10_000).optional(),
          firstComment: z.string().max(10_000).optional(),
        })
      )
      .max(20)
      .optional(),
    remove: z.array(uuid()).max(20).optional(),
    update: z
      .array(
        z.object({
          id: uuid(),
          textOverride: z.string().max(10_000).nullable().optional(),
          firstComment: z.string().max(10_000).nullable().optional(),
          scheduledAt: z.string().datetime().nullable().optional(),
        })
      )
      .max(20)
      .optional(),
  }),
  run: (ctx, input) => {
    const i = input as {
      postId: string;
      add?: { targetId: string; textOverride?: string; firstComment?: string }[];
      remove?: string[];
      update?: {
        id: string;
        textOverride?: string | null;
        firstComment?: string | null;
        scheduledAt?: string | null;
      }[];
    };
    return updateSocialPostTargets(ctx, i.postId, {
      ...(i.add ? { add: i.add } : {}),
      ...(i.remove ? { remove: i.remove } : {}),
      ...(i.update
        ? {
            update: i.update.map((u) => ({
              id: u.id,
              ...(u.textOverride !== undefined ? { textOverride: u.textOverride } : {}),
              ...(u.firstComment !== undefined ? { firstComment: u.firstComment } : {}),
              ...(u.scheduledAt !== undefined
                ? { scheduledAt: u.scheduledAt ? new Date(u.scheduledAt) : null }
                : {}),
            })),
          }
        : {}),
    });
  },
};

const retryTarget: McpToolDefinition = {
  name: 'retry_social_post_target',
  description:
    'Send ONE failed destination again. Its siblings — including the ones that already went out — are untouched, and a destination that already published cannot be retried. Use when a post is `partially_published`. `postTargetId` is get_social_post → targets[].id. Publishes to a real account — confirm first.',
  scope: 'write:social',
  confirmation: true,
  input: z.object({ postId: uuid(), postTargetId: uuid() }),
  run: async (ctx, input) => {
    const { postId, postTargetId } = input as { postId: string; postTargetId: string };
    const result = await retrySocialPostTarget(ctx, postId, postTargetId);
    if (result) {
      await publish(mcpLogger, 'social.post.due', ctx.tenantId, ctx.userId, { postId });
    }
    return result;
  },
};

// ── Reuse ─────────────────────────────────────────────────────────────────────

const duplicatePost: McpToolDefinition = {
  name: 'duplicate_social_post',
  description:
    'Copy a post into a fresh DRAFT — same words, pictures, destinations and per-destination wording, with no schedule. Destinations that have been disconnected or turned off are dropped. Nothing publishes.',
  scope: 'write:social',
  confirmation: false,
  input: z.object({ postId: uuid() }),
  run: (ctx, input) => duplicateSocialPost(ctx, (input as { postId: string }).postId),
};

const setEvergreen: McpToolDefinition = {
  name: 'set_social_post_evergreen',
  description:
    'Mark a published post as one the business is happy to run again (or unmark it). Posting slots with auto-fill on draw from this pool, least-recently-used first.',
  scope: 'write:social',
  confirmation: false,
  input: z.object({ postId: uuid(), evergreen: z.boolean() }),
  run: (ctx, input) => {
    const i = input as { postId: string; evergreen: boolean };
    return setSocialPostEvergreen(ctx, i.postId, i.evergreen);
  },
};

const draftFrom: McpToolDefinition = {
  name: 'draft_social_post_from',
  description:
    'Build a SUGGESTED post from something the business already published — a product, a collection, or a CMS article. Returns `{ body, link, mediaAssetIds, propertyId, … }` to pass into create_social_post; it creates nothing on its own. Saves an agent from re-deriving the title, excerpt, hero image and public URL.',
  scope: 'read:social',
  confirmation: false,
  input: z.object({
    type: z.enum(['product', 'collection', 'content']),
    id: uuid(),
  }),
  run: (ctx, input) => {
    const i = input as { type: ComposeSeedType; id: string };
    return buildComposeSeed(ctx, i.type, i.id);
  },
};

// ── The engagement inbox ──────────────────────────────────────────────────────

const listInbox: McpToolDefinition = {
  name: 'list_social_inbox',
  description:
    'List inbound activity on the connected accounts — comments on posts, mentions, and reviews (with a 1–5 `rating`). Inbound only; our own replies are thread context, fetched with get_social_inbox_thread. Filter by status (open / replied / archived), kind, or a specific destination.',
  scope: 'read:social',
  confirmation: false,
  input: z.object({
    status: z.enum(['open', 'replied', 'archived']).optional(),
    kind: z.enum(['comment', 'mention', 'review', 'message']).optional(),
    socialTargetId: uuid().optional(),
    limit: z.number().int().min(1).max(200).optional(),
    propertyId: uuid().nullable().optional(),
  }),
  run: (ctx, input) =>
    listInboxItems(
      ctx,
      input as {
        status?: string;
        kind?: string;
        socialTargetId?: string;
        limit?: number;
        propertyId?: string | null;
      }
    ),
};

const getThread: McpToolDefinition = {
  name: 'get_social_inbox_thread',
  description:
    'Fetch one conversation in order — both what the person said and anything the business has replied. Use before drafting a reply so an agent answers in context rather than to a single line.',
  scope: 'read:social',
  confirmation: false,
  input: z.object({ itemId: uuid() }),
  run: (ctx, input) => getInboxThread(ctx, (input as { itemId: string }).itemId),
};

const replyToInbox: McpToolDefinition = {
  name: 'reply_to_social_inbox_item',
  description:
    'Reply publicly to a comment, mention or review, AS THE BUSINESS, on the platform it came from. The reply is written immediately and sent by a background worker. This is visible to the customer and to everyone else who reads that post — confirm first.',
  scope: 'write:social',
  confirmation: true,
  input: z.object({ itemId: uuid(), text: z.string().min(1).max(5000) }),
  run: async (ctx, input) => {
    const { itemId, text } = input as { itemId: string; text: string };
    const created = await composeInboxReply(ctx, itemId, text);
    if (created) {
      await publish(mcpLogger, 'social.inbox.reply', ctx.tenantId, ctx.userId, {
        itemId: created.id,
      });
    }
    return created;
  },
};

const setInboxStatus: McpToolDefinition = {
  name: 'set_social_inbox_item_status',
  description:
    'Archive an inbox item (seen, nothing to do) or put it back in the inbox. Never deletes — a customer’s words are not ours to remove.',
  scope: 'write:social',
  confirmation: false,
  input: z.object({ itemId: uuid(), status: z.enum(['open', 'archived']) }),
  run: (ctx, input) => {
    const i = input as { itemId: string; status: 'open' | 'archived' };
    return setInboxItemStatus(ctx, i.itemId, i.status);
  },
};

// ── The plan behind the posting ───────────────────────────────────────────────

const listSlots: McpToolDefinition = {
  name: 'list_social_posting_slots',
  description:
    'List the standing weekly posting times ("Tuesdays at 9"). `weekday` is 0=Sunday…6=Saturday and `minuteOfDay` is minutes past local midnight in the slot’s `timezone`. `autoFill` slots draw from the evergreen pool when nothing is planned.',
  scope: 'read:social',
  confirmation: false,
  input: z.object({ propertyId: uuid().nullable().optional() }),
  run: (ctx, input) =>
    listPostingSlots(ctx, (input as { propertyId?: string | null }).propertyId ?? null),
};

const saveSlot: McpToolDefinition = {
  name: 'save_social_posting_slot',
  description:
    'Create or update a weekly posting time. Omit `id` to create. `timezone` is an IANA zone — a slot is a recurring LOCAL time, so 9am stays 9am across daylight saving. Turning `autoFill` on lets sparx schedule an evergreen post here when nothing is planned; it never replaces a real post and still respects the approval gate.',
  scope: 'write:social',
  confirmation: true,
  input: z.object({
    id: uuid().optional(),
    propertyId: uuid().nullable().optional(),
    weekday: z.number().int().min(0).max(6),
    minuteOfDay: z.number().int().min(0).max(1439),
    timezone: z.string().min(1).max(64),
    targetIds: z.array(uuid()).max(50),
    enabled: z.boolean().optional(),
    autoFill: z.boolean().optional(),
  }),
  run: (ctx, input) => upsertPostingSlot(ctx, input as Parameters<typeof upsertPostingSlot>[1]),
};

const removeSlot: McpToolDefinition = {
  name: 'delete_social_posting_slot',
  description:
    'Remove a weekly posting time. Posts already scheduled into it are unaffected — only the standing intention goes.',
  scope: 'write:social',
  confirmation: true,
  input: z.object({ slotId: uuid() }),
  run: (ctx, input) => deletePostingSlot(ctx, (input as { slotId: string }).slotId),
};

const listHashtags: McpToolDefinition = {
  name: 'list_social_hashtag_sets',
  description:
    'List saved hashtag blocks. Tags are stored WITHOUT the leading "#". A set with a `platform` is meant only for that platform.',
  scope: 'read:social',
  confirmation: false,
  input: z.object({ propertyId: uuid().nullable().optional() }),
  run: (ctx, input) =>
    listHashtagSets(ctx, (input as { propertyId?: string | null }).propertyId ?? null),
};

const saveHashtags: McpToolDefinition = {
  name: 'save_social_hashtag_set',
  description:
    'Create or update a saved hashtag block. Omit `id` to create. Tags are normalized (leading "#" dropped, lower-cased, punctuation stripped, duplicates removed), so the same tag typed two ways stays one tag.',
  scope: 'write:social',
  confirmation: false,
  input: z.object({
    id: uuid().optional(),
    propertyId: uuid().nullable().optional(),
    name: z.string().min(1).max(120),
    tags: z.array(z.string().max(140)).min(1).max(60),
    platform: z.string().max(40).nullable().optional(),
  }),
  run: (ctx, input) => upsertHashtagSet(ctx, input as Parameters<typeof upsertHashtagSet>[1]),
};

const removeHashtags: McpToolDefinition = {
  name: 'delete_social_hashtag_set',
  description: 'Remove a saved hashtag block. Posts already sent keep the tags they went out with.',
  scope: 'write:social',
  confirmation: true,
  input: z.object({ setId: uuid() }),
  run: (ctx, input) => deleteHashtagSet(ctx, (input as { setId: string }).setId),
};

const bestTime: McpToolDefinition = {
  name: 'get_social_best_time',
  description:
    'When this business’s own audience actually engages — weekday + local hour buckets ranked by mean engagements, drawn from its published posts and their real numbers, NOT an industry average. Check `confident`: false means there is not enough history yet and `buckets` is empty, in which case say so rather than recommending a time.',
  scope: 'read:social',
  confirmation: false,
  input: z.object({
    timezone: z.string().min(1).max(64),
    propertyId: uuid().nullable().optional(),
  }),
  run: (ctx, input) => {
    const i = input as { timezone: string; propertyId?: string | null };
    return getBestTimeToPost(ctx, i.timezone, i.propertyId ?? null);
  },
};

const importPosts: McpToolDefinition = {
  name: 'import_social_posts',
  description:
    'Create many posts at once from CSV text. The first row names the columns: `body` (required), plus optional `when` (a date/time) and `accounts` (destination NAMES, several separated by ";"). A row with a future time goes through the approval gate exactly like any other scheduled post; anything else lands as a draft. Returns per-row problems rather than failing the whole import — set `dryRun` to check a file without creating anything.',
  scope: 'write:social',
  confirmation: true,
  input: z.object({
    csv: z.string().min(1).max(2_000_000),
    defaultTargetIds: z.array(uuid()).max(50).optional(),
    propertyId: uuid().nullable().optional(),
    dryRun: z.boolean().optional(),
  }),
  run: async (ctx, input) => {
    const i = input as {
      csv: string;
      defaultTargetIds?: string[];
      propertyId?: string | null;
      dryRun?: boolean;
    };
    const parsed = parseSocialCsv(i.csv);
    if (i.dryRun) {
      return {
        wouldCreate: parsed.rows.length,
        rows: parsed.rows.map((r) => ({ ...r, scheduledAt: r.scheduledAt?.toISOString() ?? null })),
        problems: parsed.problems,
      };
    }
    const result = await createSocialPostsBulk(ctx, parsed.rows, {
      propertyId: i.propertyId ?? null,
      ...(i.defaultTargetIds ? { defaultTargetIds: i.defaultTargetIds } : {}),
    });
    return {
      ...result,
      problems: [...parsed.problems, ...result.problems].sort((a, b) => a.line - b.line),
    };
  },
};

export const readTools: McpToolDefinition[] = [
  listConnections,
  checkConnections,
  listPosts,
  getPost,
  draftFrom,
  listInbox,
  getThread,
  listSlots,
  listHashtags,
  bestTime,
];
export const writeTools: McpToolDefinition[] = [
  createPost,
  updatePost,
  updateTargets,
  deletePost,
  submitPost,
  schedulePost,
  approvePost,
  rejectPost,
  publishPost,
  retryTarget,
  duplicatePost,
  setEvergreen,
  replyToInbox,
  setInboxStatus,
  saveSlot,
  removeSlot,
  saveHashtags,
  removeHashtags,
  importPosts,
];
