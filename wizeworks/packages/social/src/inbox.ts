// The engagement inbox, read + compose side (docs/social-audit slice 15).
//
// The worker pulls items in and pushes replies out; this is everything in between —
// what the operator app lists, and how a reply is composed. Kept here rather than in
// api-rest so REST and MCP drive the same service (one service, many transports), which
// is what already lets an agent post and now lets one answer.
//
// The reply flow is deliberately two-phase: composing a reply WRITES an outbound row
// with `repliedAt` null, then a `social.inbox.reply` event tells the worker to send it.
// That is what makes a reply redeliverable without ever double-posting an answer to a
// customer — the row is the idempotency anchor, not the message.

import { withTenant } from '@wizeworks/db';
import { badRequest } from '@wizeworks/api-core/errors';

import type { SocialContext } from './context.js';

export interface InboxItemView {
  id: string;
  socialTargetId: string;
  targetName: string;
  platform: string;
  postTargetId: string | null;
  kind: string;
  direction: string;
  externalId: string;
  threadExternalId: string | null;
  parentExternalId: string | null;
  authorName: string | null;
  authorHandle: string | null;
  authorAvatarUrl: string | null;
  text: string | null;
  rating: number | null;
  permalink: string | null;
  status: string;
  receivedAt: string;
  repliedAt: string | null;
}

interface InboxRow {
  id: string;
  socialTargetId: string;
  targetName: string;
  platform: string;
  postTargetId: string | null;
  kind: string;
  direction: string;
  externalId: string;
  threadExternalId: string | null;
  parentExternalId: string | null;
  authorName: string | null;
  authorHandle: string | null;
  authorAvatarUrl: string | null;
  text: string | null;
  rating: number | null;
  permalink: string | null;
  status: string;
  receivedAt: Date;
  repliedAt: Date | null;
}

function toView(row: InboxRow): InboxItemView {
  return {
    ...row,
    receivedAt: row.receivedAt.toISOString(),
    repliedAt: row.repliedAt?.toISOString() ?? null,
  };
}

export interface ListInboxFilter {
  propertyId?: string | null;
  /** open | replied | archived — omit for everything. */
  status?: string;
  /** comment | mention | review | message. */
  kind?: string;
  socialTargetId?: string;
  limit?: number;
}

/**
 * The inbox list. Inbound only by default — our own replies are thread context, not
 * things to work through, so they'd only pad the count a person is trying to get to zero.
 */
export async function listInboxItems(
  ctx: SocialContext,
  filter: ListInboxFilter = {}
): Promise<InboxItemView[]> {
  const rows = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialInboxItem.findMany({
      where: {
        tenantId: ctx.tenantId,
        direction: 'inbound',
        ...(filter.propertyId
          ? { OR: [{ propertyId: filter.propertyId }, { propertyId: null }] }
          : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.kind ? { kind: filter.kind } : {}),
        ...(filter.socialTargetId ? { socialTargetId: filter.socialTargetId } : {}),
      },
      orderBy: { receivedAt: 'desc' },
      take: Math.min(filter.limit ?? 100, 200),
    })
  );
  return rows.map(toView);
}

/** How many need answering — the number that drives the nav badge. */
export async function countOpenInboxItems(
  ctx: SocialContext,
  propertyId: string | null
): Promise<number> {
  return withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialInboxItem.count({
      where: {
        tenantId: ctx.tenantId,
        direction: 'inbound',
        status: 'open',
        ...(propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : {}),
      },
    })
  );
}

/** One conversation, oldest first — both directions, so it reads like a conversation. */
export async function getInboxThread(ctx: SocialContext, itemId: string): Promise<InboxItemView[]> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const item = await tx.socialInboxItem.findFirst({
      where: { id: itemId, tenantId: ctx.tenantId },
    });
    if (!item) return [];
    // A platform that doesn't thread gives us no thread id; then the item plus anything
    // that replies directly to it IS the conversation.
    const rows = await tx.socialInboxItem.findMany({
      where: item.threadExternalId
        ? { tenantId: ctx.tenantId, threadExternalId: item.threadExternalId }
        : {
            tenantId: ctx.tenantId,
            OR: [{ id: item.id }, { parentExternalId: item.externalId }],
          },
      orderBy: { receivedAt: 'asc' },
    });
    return rows.map(toView);
  });
}

/**
 * Write a reply and return the row the worker will send.
 *
 * The reply exists as a real inbox item the moment it is composed, so it shows in the
 * thread immediately with its own status — a person sees what they said even while the
 * platform call is still in flight, and a failure is visible on the thing itself rather
 * than as a toast that has already gone.
 */
export async function composeInboxReply(
  ctx: SocialContext,
  itemId: string,
  text: string
): Promise<InboxItemView | null> {
  const body = text.trim();
  if (!body) throw badRequest('Write something before sending a reply.');

  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const item = await tx.socialInboxItem.findFirst({
      where: { id: itemId, tenantId: ctx.tenantId },
    });
    if (!item) return null;
    if (item.direction !== 'inbound') {
      throw badRequest('You can only reply to something someone sent you.');
    }

    const reply = await tx.socialInboxItem.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: item.propertyId,
        socialTargetId: item.socialTargetId,
        targetName: item.targetName,
        platform: item.platform,
        postTargetId: item.postTargetId,
        kind: item.kind,
        direction: 'outbound',
        // Ours until the platform gives it a real id — unique per destination, so a
        // second reply to the same comment can't collide with the first.
        externalId: `pending:${item.id}:${Date.now().toString(36)}`,
        threadExternalId: item.threadExternalId ?? item.externalId,
        parentExternalId: item.externalId,
        text: body,
        status: 'sending',
        receivedAt: new Date(),
        handledById: ctx.userId,
      },
    });
    return toView(reply);
  });
}

/** Mark an item handled without answering — "seen, nothing to do". Never a delete: a
 *  customer's words are not ours to remove. */
export async function setInboxItemStatus(
  ctx: SocialContext,
  itemId: string,
  status: 'open' | 'archived'
): Promise<InboxItemView | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const result = await tx.socialInboxItem.updateMany({
      where: { id: itemId, tenantId: ctx.tenantId, direction: 'inbound' },
      data: { status, handledById: ctx.userId },
    });
    if (result.count === 0) return null;
    const row = await tx.socialInboxItem.findFirst({ where: { id: itemId } });
    return row ? toView(row) : null;
  });
}
