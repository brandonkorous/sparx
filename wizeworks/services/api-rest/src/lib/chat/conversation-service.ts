// Live Chat — conversation + message service (docs/56, docs/69 A-1).
//
// One service shared by the staff REST routes, the public storefront routes,
// and (A-2) the WebSocket handler. Every DB call is wrapped in withTenant so
// RLS scopes rows to the caller's tenant. Throws @wizeworks/api-core ApiError.

import { randomBytes } from 'node:crypto';

import { withTenant, type Prisma } from '@wizeworks/db';
import type { TenantContext } from '@wizeworks/db';
import { forbidden, notFound, validationError } from '@wizeworks/api-core/errors';

import {
  firstNonEmpty,
  type ChatSource,
  type ConversationStatus,
  type PostMessageInputT,
  type SenderType,
} from './types.js';

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderType: SenderType;
  senderId: string | null;
  body: string;
  attachments: unknown;
  aiGenerated: boolean;
  aiConfidence: number | null;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationSummaryDto {
  id: string;
  status: ConversationStatus;
  source: ChatSource;
  /** The site this conversation is on (docs/131 §3.7). Null for a dashboard
   *  thread, or for a thread whose site was since deleted (the FK is SetNull —
   *  support history outlives the business). */
  propertyId: string | null;
  subject: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  assignedToId: string | null;
  unreadStaff: number;
  lastMessageAt: string | null;
  lastMessageSnippet: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetailDto extends ConversationSummaryDto {
  messages: ChatMessageDto[];
}

export interface ListConversationsFilter {
  /** One site's inbox (docs/131 §3.7) — the normal staff view. */
  propertyId?: string;
  /** A restricted member's `?property=all`: the sites they may reach, never the
   *  whole tenant. Set by resolveListScopeIds at the route. */
  propertyIds?: string[];
  status?: ConversationStatus;
  assignedToId?: string;
  /** Restrict to conversations assigned to the calling user. */
  mine?: boolean;
  q?: string;
  take?: number;
  skip?: number;
}

type ConversationRow = Prisma.ChatConversationGetPayload<{
  include: {
    customer: { select: { firstName: true; lastName: true; email: true; companyName: true } };
    messages: { take: 1; orderBy: { createdAt: 'desc' } };
  };
}>;

function displayName(
  customer: {
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
  } | null,
  visitorName: string | null,
  visitorEmail: string | null
): string | null {
  if (customer) {
    const full = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
    return firstNonEmpty(full, customer.companyName);
  }
  return firstNonEmpty(visitorName, visitorEmail);
}

function toMessageDto(m: {
  id: string;
  conversationId: string;
  senderType: string;
  senderId: string | null;
  body: string;
  attachments: unknown;
  aiGenerated: boolean;
  aiConfidence: number | null;
  readAt: Date | null;
  createdAt: Date;
}): ChatMessageDto {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderType: m.senderType as SenderType,
    senderId: m.senderId,
    body: m.body,
    attachments: m.attachments,
    aiGenerated: m.aiGenerated,
    aiConfidence: m.aiConfidence,
    readAt: m.readAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

function toSummaryDto(row: ConversationRow): ConversationSummaryDto {
  const last = row.messages[0];
  return {
    id: row.id,
    status: row.status as ConversationStatus,
    source: row.source as ChatSource,
    propertyId: row.propertyId,
    subject: row.subject,
    customerId: row.customerId,
    customerName: displayName(row.customer, row.visitorName, row.visitorEmail),
    customerEmail: row.customer?.email ?? row.visitorEmail,
    assignedToId: row.assignedToId,
    unreadStaff: row.unreadStaff,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    lastMessageSnippet: last ? last.body.slice(0, 140) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const SUMMARY_INCLUDE = {
  customer: { select: { firstName: true, lastName: true, email: true, companyName: true } },
  messages: { take: 1, orderBy: { createdAt: 'desc' } },
} satisfies Prisma.ChatConversationInclude;

export async function list(
  ctx: TenantContext,
  filter: ListConversationsFilter = {}
): Promise<{ items: ConversationSummaryDto[]; total: number }> {
  const where: Prisma.ChatConversationWhereInput = {
    // The staff inbox is per-SITE (docs/131 §3.7). Without this every business's
    // threads shared one queue and one unread badge, so a donut-shop employee
    // triaged machine-shop conversations. Undefined = across sites, which the
    // route only passes for a caller entitled to it.
    ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
    ...(filter.propertyIds ? { propertyId: { in: filter.propertyIds } } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.mine && ctx.userId ? { assignedToId: ctx.userId } : {}),
    ...(filter.assignedToId ? { assignedToId: filter.assignedToId } : {}),
    ...(filter.q
      ? {
          OR: [
            { subject: { contains: filter.q, mode: 'insensitive' } },
            { visitorName: { contains: filter.q, mode: 'insensitive' } },
            { visitorEmail: { contains: filter.q, mode: 'insensitive' } },
            { customer: { email: { contains: filter.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  return withTenant(ctx, async (tx) => {
    const [rows, total] = await Promise.all([
      tx.chatConversation.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
      }),
      tx.chatConversation.count({ where }),
    ]);
    return { items: rows.map(toSummaryDto), total };
  });
}

export async function get(
  ctx: TenantContext,
  conversationId: string,
  opts: { messageTake?: number; messageSkip?: number } = {}
): Promise<ConversationDetailDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.chatConversation.findUnique({
      where: { id: conversationId },
      include: SUMMARY_INCLUDE,
    });
    if (!row) throw notFound('Conversation', conversationId);
    const messages = await tx.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: Math.min(opts.messageTake ?? 100, 200),
      skip: opts.messageSkip ?? 0,
    });
    return { ...toSummaryDto(row), messages: messages.map(toMessageDto) };
  });
}

export interface CreateConversationArgs {
  customerId?: string;
  subject?: string;
  /** The site this conversation is happening on (docs/131 §3.7). Required in
   *  practice for every customer-facing source — a DB CHECK rejects a `site` or
   *  `sparx_market` row without one — and legitimately null only for a
   *  `dashboard` thread, which is staff talking to staff. */
  propertyId?: string | null;
  source?: ChatSource;
  visitorName?: string;
  visitorEmail?: string;
  /** Anonymous-ownership token (public widget). Omitted for staff-initiated. */
  visitorToken?: string;
  /** Optional opening message + who sent it. */
  message?: { body: string; senderType: SenderType; senderId?: string };
}

export interface CreateConversationResult {
  conversation: ConversationDetailDto;
  /** Echoed back to an anonymous widget so it can prove ownership later. */
  visitorToken: string | null;
}

export function generateVisitorToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function create(
  ctx: TenantContext,
  args: CreateConversationArgs
): Promise<CreateConversationResult> {
  const result = await withTenant(ctx, async (tx) => {
    if (args.customerId) {
      const exists = await tx.customer.findUnique({
        where: { id: args.customerId },
        select: { id: true },
      });
      if (!exists) throw notFound('Customer', args.customerId);
    }

    const created = await tx.chatConversation.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: args.customerId ?? null,
        propertyId: args.propertyId ?? null,
        subject: args.subject ?? null,
        source: args.source ?? 'site',
        visitorName: args.visitorName ?? null,
        visitorEmail: args.visitorEmail ?? null,
        visitorToken: args.visitorToken ?? null,
        status: 'open',
      },
    });

    if (args.message) {
      await tx.chatMessage.create({
        data: {
          tenantId: ctx.tenantId,
          conversationId: created.id,
          senderType: args.message.senderType,
          senderId: args.message.senderId ?? null,
          body: args.message.body,
        },
      });
      await tx.chatConversation.update({
        where: { id: created.id },
        data: {
          lastMessageAt: new Date(),
          unreadStaff: args.message.senderType === 'customer' ? 1 : 0,
        },
      });
    }

    const row = await tx.chatConversation.findUniqueOrThrow({
      where: { id: created.id },
      include: SUMMARY_INCLUDE,
    });
    const messages = await tx.chatMessage.findMany({
      where: { conversationId: created.id },
      orderBy: { createdAt: 'asc' },
    });
    return { ...toSummaryDto(row), messages: messages.map(toMessageDto) };
  });

  return { conversation: result, visitorToken: args.visitorToken ?? null };
}

export interface UpdateConversationArgs {
  status?: ConversationStatus;
  assignedToId?: string | null;
  subject?: string | null;
}

export async function update(
  ctx: TenantContext,
  conversationId: string,
  args: UpdateConversationArgs
): Promise<ConversationSummaryDto> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true },
    });
    if (!before) throw notFound('Conversation', conversationId);

    if (args.assignedToId) {
      const staff = await tx.user.findUnique({
        where: { id: args.assignedToId },
        select: { id: true },
      });
      if (!staff) throw validationError('Assigned user does not exist in this tenant.');
    }

    const resolving = args.status === 'resolved' && before.status !== 'resolved';
    const reopening = args.status && args.status !== 'resolved' && before.status === 'resolved';

    await tx.chatConversation.update({
      where: { id: conversationId },
      data: {
        ...(args.status ? { status: args.status } : {}),
        ...(args.assignedToId !== undefined ? { assignedToId: args.assignedToId } : {}),
        ...(args.subject !== undefined ? { subject: args.subject } : {}),
        ...(resolving ? { resolvedAt: new Date() } : {}),
        ...(reopening ? { resolvedAt: null } : {}),
      },
    });

    const row = await tx.chatConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: SUMMARY_INCLUDE,
    });
    return toSummaryDto(row);
  });
}

export interface AddMessageArgs {
  senderType: SenderType;
  senderId?: string | null;
  body: string;
  attachments?: PostMessageInputT['attachments'];
  aiGenerated?: boolean;
  aiConfidence?: number | null;
}

export async function addMessage(
  ctx: TenantContext,
  conversationId: string,
  args: AddMessageArgs
): Promise<ChatMessageDto> {
  return withTenant(ctx, async (tx) => {
    const conv = await tx.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, status: true, unreadStaff: true },
    });
    if (!conv) throw notFound('Conversation', conversationId);

    const message = await tx.chatMessage.create({
      data: {
        tenantId: ctx.tenantId,
        conversationId,
        senderType: args.senderType,
        senderId: args.senderId ?? null,
        body: args.body,
        ...(args.attachments ? { attachments: args.attachments } : {}),
        aiGenerated: args.aiGenerated ?? false,
        aiConfidence: args.aiConfidence ?? null,
      },
    });

    const inbound = args.senderType === 'customer';
    await tx.chatConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: message.createdAt,
        // A staff/AI reply on a resolved thread reopens it; an inbound customer
        // message bumps the staff unread counter.
        ...(inbound ? { unreadStaff: { increment: 1 } } : {}),
        ...(conv.status === 'resolved' ? { status: 'open', resolvedAt: null } : {}),
      },
    });

    return toMessageDto(message);
  });
}

/**
 * Mark messages read by one side. Staff reading clears the inbound-unread
 * counter and stamps read_at on customer/ai messages; a customer reading stamps
 * read_at on staff/ai messages. Returns the number of messages stamped.
 */
export async function markRead(
  ctx: TenantContext,
  conversationId: string,
  reader: 'staff' | 'customer'
): Promise<{ updated: number }> {
  return withTenant(ctx, async (tx) => {
    const conv = await tx.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!conv) throw notFound('Conversation', conversationId);

    const unreadSenderTypes = reader === 'staff' ? ['customer', 'ai'] : ['staff', 'ai'];
    const res = await tx.chatMessage.updateMany({
      where: { conversationId, readAt: null, senderType: { in: unreadSenderTypes } },
      data: { readAt: new Date() },
    });
    if (reader === 'staff') {
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: { unreadStaff: 0 },
      });
    }
    return { updated: res.count };
  });
}

/**
 * Confirm a guest owns `conversationId` within an already-resolved tenant: the
 * `x-chat-token` value must match the stored visitor_token. Throws 404 when the
 * conversation doesn't exist for this tenant and 403 on a token mismatch.
 * Returns the conversation's customerId so the caller can attribute messages.
 */
export async function assertVisitorToken(
  ctx: TenantContext,
  conversationId: string,
  token: string | undefined
): Promise<{ customerId: string | null }> {
  return withTenant(ctx, async (tx) => {
    const conv = await tx.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, visitorToken: true, customerId: true },
    });
    if (!conv) throw notFound('Conversation', conversationId);
    if (!conv.visitorToken || !token || conv.visitorToken !== token) {
      throw forbidden('Chat token does not match.');
    }
    return { customerId: conv.customerId };
  });
}
