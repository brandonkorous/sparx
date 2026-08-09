// The engagement inbox drain (docs/social-audit slice 15) — the inbound half of the
// social module.
//
// Publishing without replying is half a social tool. A comment under a post is a
// customer talking to the business, and until this existed it landed somewhere nobody at
// the business was looking. Two directions, one file, because they are the same
// conversation:
//
//   syncInbox      — pull what people said, upserting on the platform's own id so a
//                    re-poll never duplicates a comment.
//   sendInboxReply — send one answer back, and record it as an outbound item in the same
//                    thread, so the conversation reads in order.
//
// Every platform-facing bit is optional on the adapter (`listInbox` / `replyToInbox`),
// because reading comments needs a wider permission set than posting and lands platform
// by platform as each review clears. A destination whose adapter cannot read is skipped
// quietly here and labelled honestly in the UI — never an empty tab that looks broken.

import { withTenant } from '@sparx/db';
import {
  getSocialAdapter,
  isRetryableError,
  type SocialAdapter,
  type SocialInboxEntry,
  type SocialPlatform,
  type SocialTargetRef,
} from '@sparx/social';
import { registerBuiltinSocialAdapters } from '@sparx/social/adapters';
import { isSocialTokenCryptoConfigured } from '@sparx/social/crypto';
import type { Logger } from 'pino';

import { resolveSocialAuth } from './auth.js';
import { markConnectionExpired } from './health.js';
import { isAuthRejection, paramsFromTargetMeta, CONNECTION_SELECT } from './publish.js';

/** How far back a never-synced destination reaches on its first pass. A Page with ten
 *  years of comments must not backfill all of them — the inbox is for what needs
 *  answering now, and anything older has long since been handled or abandoned. */
const FIRST_SYNC_WINDOW_DAYS = 14;

export interface InboxOutcome {
  socialTargetId: string;
  fetched: number;
  created: number;
  /** skipped = the platform can't do inbound yet, or the account is disconnected. */
  result: 'ok' | 'skipped' | 'unsupported';
}

export interface ReplyOutcome {
  itemId: string;
  result: 'sent' | 'skipped' | 'failed';
}

/** Everything an adapter call needs, resolved from a destination row. Shared by both
 *  directions so the token/param plumbing exists once. */
async function resolveTargetContext(
  tenantId: string,
  socialTargetId: string
): Promise<{
  adapter: SocialAdapter;
  ref: SocialTargetRef;
  auth: NonNullable<Awaited<ReturnType<typeof resolveSocialAuth>>>;
  /** OUR `social_targets.id` — what an inbox row stores. Distinct from
   *  `ref.externalTargetId`, which is the platform's own id for the same place. */
  rowId: string;
  connectionId: string;
  propertyId: string | null;
  targetName: string;
  platform: string;
} | null> {
  const target = await withTenant({ tenantId }, (tx) =>
    tx.socialTarget.findFirst({
      where: { id: socialTargetId },
      include: {
        connection: { select: { ...CONNECTION_SELECT, propertyId: true } },
      },
    })
  );
  if (!target?.enabled) return null;

  const adapter = getSocialAdapter(target.platform as SocialPlatform);
  if (!adapter) return null;
  // OUR app credentials are missing on this process. Bail before resolveSocialAuth, whose
  // refresh would throw requireCreds() out of this function entirely — past syncInbox's
  // try/catch, into the handler, and back as a 500 for Pub/Sub to redeliver five times
  // over something no retry can fix.
  if (adapter.isConfigured() !== true) return null;

  const auth = await resolveSocialAuth(tenantId, target.connection, adapter);
  if (!auth) return null;

  return {
    adapter,
    ref: {
      externalTargetId: target.externalTargetId,
      name: target.name,
      params: paramsFromTargetMeta(target.metadata),
    },
    auth,
    rowId: target.id,
    connectionId: target.connection.id,
    propertyId: target.connection.propertyId,
    targetName: target.name,
    platform: target.platform,
  };
}

/**
 * Pull one destination's new inbound activity into the inbox.
 *
 * `since` is the last successful sync, so a poll asks only for what is new. The cursor
 * moves ONLY on success: a failed pull leaves it where it was, so nothing is silently
 * skipped over.
 */
export async function syncInbox(
  tenantId: string,
  socialTargetId: string,
  logger: Logger
): Promise<InboxOutcome> {
  registerBuiltinSocialAdapters();

  if (!isSocialTokenCryptoConfigured()) {
    return { socialTargetId, fetched: 0, created: 0, result: 'skipped' };
  }

  const ctx = await resolveTargetContext(tenantId, socialTargetId);
  if (!ctx) {
    // Stamp the cursor, for the same reason the `unsupported` path below does: a
    // destination we cannot resolve right now (platform not configured, account
    // disconnected, adapter gone) is otherwise re-picked by the sweep every two minutes
    // forever, since the scan orders by `inbox_synced_at NULLS FIRST`. Stamping demotes
    // it to the ordinary 15-minute cadence — it still gets re-checked, just not hammered.
    await touchSynced(tenantId, socialTargetId);
    return { socialTargetId, fetched: 0, created: 0, result: 'skipped' };
  }

  // The adapter may publish fine and still have no permission to read comments.
  if (!ctx.adapter.listInbox || ctx.adapter.supportsInbox?.() !== true) {
    // Stamp the cursor anyway so an unsupported destination doesn't sit at the head of
    // the sweep queue being re-picked every two minutes forever.
    await touchSynced(tenantId, socialTargetId);
    return { socialTargetId, fetched: 0, created: 0, result: 'unsupported' };
  }

  const cursor = await withTenant({ tenantId }, (tx) =>
    tx.socialTarget.findUnique({
      where: { id: socialTargetId },
      select: { inboxSyncedAt: true },
    })
  );
  const since =
    cursor?.inboxSyncedAt ?? new Date(Date.now() - FIRST_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let entries: SocialInboxEntry[];
  try {
    entries = await ctx.adapter.listInbox(ctx.auth, ctx.ref, since);
  } catch (e) {
    if (isAuthRejection(e)) {
      await markConnectionExpired(
        tenantId,
        ctx.connectionId,
        'token_rejected',
        `${ctx.platform} rejected the sign-in while reading messages.`,
        logger
      );
      return { socialTargetId, fetched: 0, created: 0, result: 'skipped' };
    }
    // Transient — leave the cursor alone and let the next sweep try again.
    if (isRetryableError(e)) throw e;
    logger.warn({ err: e, socialTargetId }, 'inbox sync rejected permanently; skipping');
    await touchSynced(tenantId, socialTargetId);
    return { socialTargetId, fetched: 0, created: 0, result: 'skipped' };
  }

  let created = 0;
  for (const entry of entries) {
    const wrote = await upsertInboxItem(tenantId, ctx, entry);
    if (wrote) created += 1;
  }

  await touchSynced(tenantId, socialTargetId);
  if (created > 0) {
    logger.info({ socialTargetId, created, fetched: entries.length }, 'inbox: new activity');
  }
  return { socialTargetId, fetched: entries.length, created, result: 'ok' };
}

/**
 * Write one platform item into the inbox. Returns true when it was NEW.
 *
 * The `(social_target_id, external_id)` unique is what makes a re-poll harmless. On a
 * conflict we update only the mutable fields (someone can edit a comment; a review's text
 * and rating can change) and deliberately leave `status` alone — an edited comment that
 * the business already archived must not jump back into the open inbox.
 */
async function upsertInboxItem(
  tenantId: string,
  ctx: NonNullable<Awaited<ReturnType<typeof resolveTargetContext>>>,
  entry: SocialInboxEntry
): Promise<boolean> {
  return withTenant({ tenantId }, async (tx) => {
    const existing = await tx.socialInboxItem.findUnique({
      where: {
        socialTargetId_externalId: {
          socialTargetId: ctx.rowId,
          externalId: entry.externalId,
        },
      },
      select: { id: true },
    });

    // Join the item back to the sparx post that provoked it, when we published it.
    const postTargetId = entry.postExternalId
      ? (
          await tx.socialPostTarget.findFirst({
            where: { externalId: entry.postExternalId },
            select: { id: true },
          })
        )?.id
      : undefined;

    const shared = {
      authorName: entry.authorName ?? null,
      authorHandle: entry.authorHandle ?? null,
      authorAvatarUrl: entry.authorAvatarUrl ?? null,
      text: entry.text ?? null,
      rating: entry.rating ?? null,
      permalink: entry.permalink ?? null,
    };

    if (existing) {
      await tx.socialInboxItem.update({ where: { id: existing.id }, data: shared });
      return false;
    }

    await tx.socialInboxItem.create({
      data: {
        tenantId,
        propertyId: ctx.propertyId,
        socialTargetId: ctx.rowId,
        targetName: ctx.targetName,
        platform: ctx.platform,
        postTargetId: postTargetId ?? null,
        kind: entry.kind,
        direction: entry.outbound ? 'outbound' : 'inbound',
        externalId: entry.externalId,
        threadExternalId: entry.threadExternalId ?? null,
        parentExternalId: entry.parentExternalId ?? null,
        // Something WE said needs no answer; it is context in the thread.
        status: entry.outbound ? 'replied' : 'open',
        receivedAt: entry.receivedAt,
        ...shared,
      },
    });
    return true;
  });
}

/** Move the sync cursor. Separate from the write so a partial sync still advances only
 *  when the whole pull succeeded. */
async function touchSynced(tenantId: string, socialTargetId: string): Promise<void> {
  await withTenant({ tenantId }, (tx) =>
    tx.socialTarget.update({
      where: { id: socialTargetId },
      data: { inboxSyncedAt: new Date() },
    })
  );
}

/**
 * Send one composed reply to the platform.
 *
 * The reply row is created by api-rest as an outbound item with `replied_at` null; this
 * drain sends it and stamps the result. That split is what makes it redeliverable: an
 * already-sent reply has `replied_at` set and is skipped, so a Pub/Sub retry cannot
 * double-post an answer to a customer.
 */
export async function sendInboxReply(
  tenantId: string,
  itemId: string,
  logger: Logger
): Promise<ReplyOutcome> {
  registerBuiltinSocialAdapters();

  const item = await withTenant({ tenantId }, (tx) =>
    tx.socialInboxItem.findFirst({ where: { id: itemId } })
  );
  if (!item) return { itemId, result: 'skipped' };
  // Already sent (a redelivery) — the whole point of the guard.
  if (item.direction !== 'outbound' || item.repliedAt || !item.parentExternalId) {
    return { itemId, result: 'skipped' };
  }

  const ctx = await resolveTargetContext(tenantId, item.socialTargetId);
  if (!ctx?.adapter.replyToInbox) {
    await withTenant({ tenantId }, (tx) =>
      tx.socialInboxItem.update({
        where: { id: itemId },
        data: { status: 'failed', metadata: { error: 'This platform cannot reply from sparx.' } },
      })
    );
    return { itemId, result: 'failed' };
  }

  try {
    const result = await ctx.adapter.replyToInbox(
      ctx.auth,
      ctx.ref,
      item.parentExternalId,
      item.text ?? ''
    );
    const parentExternalId = item.parentExternalId;
    // One tenant transaction: the reply lands and the thing it answers is marked
    // answered together, so the inbox count can never show an open item whose reply
    // already went out.
    await withTenant({ tenantId }, async (tx) => {
      await tx.socialInboxItem.update({
        where: { id: itemId },
        data: {
          externalId: result.externalId,
          permalink: result.permalink ?? null,
          repliedAt: new Date(),
          status: 'replied',
        },
      });
      await tx.socialInboxItem.updateMany({
        where: { externalId: parentExternalId, direction: 'inbound' },
        data: { status: 'replied', repliedAt: new Date(), handledById: item.handledById },
      });
    });
    return { itemId, result: 'sent' };
  } catch (e) {
    if (isAuthRejection(e)) {
      await markConnectionExpired(
        tenantId,
        ctx.connectionId,
        'token_rejected',
        `${ctx.platform} rejected the sign-in while sending a reply.`,
        logger
      );
    }
    // Transient failures rethrow so Pub/Sub redelivers; the `replied_at` guard makes
    // that safe. A permanent one is recorded on the row for the person to see.
    if (isRetryableError(e) && !isAuthRejection(e)) throw e;
    await withTenant({ tenantId }, (tx) =>
      tx.socialInboxItem.update({
        where: { id: itemId },
        data: {
          status: 'failed',
          metadata: { error: e instanceof Error ? e.message.slice(0, 400) : String(e) },
        },
      })
    );
    return { itemId, result: 'failed' };
  }
}
