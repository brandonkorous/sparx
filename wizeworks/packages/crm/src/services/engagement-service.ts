// engagementService — what was SAID (docs/144 §5).
//
// A contact's timeline can already tell you an order shipped and a campaign was
// opened. It cannot tell you the rep emailed them on Tuesday and they replied on
// Wednesday asking for a discount — which IS the relationship, and which today
// lives in one person's inbox where nobody else can see it. This service is the
// four things that fixes: send from the record, receive onto the record, log a
// call, write a note.
//
// FOUR THINGS THIS FILE GETS RIGHT THAT ARE EASY TO GET WRONG:
//
//  1. THREADING, IN THE RIGHT ORDER. `In-Reply-To` first, then `References`,
//     then the provider's own thread id, then subject + participants. Subject
//     matching is LAST and deliberately narrow, because "Re: Quote" from two
//     different customers is one subject and two conversations — a threader that
//     leads with subject merges strangers' mail.
//
//  2. THE PRIVACY GATE. A connected PERSONAL mailbox stores only messages whose
//     counterpart is already a known contact. Everything else is discarded
//     unread — never stored, never indexed. Someone's doctor and their mortgage
//     broker do not belong in a CRM, and "we only show you the relevant ones" is
//     a different promise from "we only keep the relevant ones".
//
//  3. IDEMPOTENCE ON THE WAY IN. Mail sync delivers the same message more than
//     once — a push notification and the poll that follows it, a retry after a
//     timeout. Dedupe is on the RFC Message-ID with a unique index, so the
//     duplicate loses at the database rather than at a check that races.
//
//  4. ONE TIMELINE, STILL. Every message also writes a `crm_activities` row, so
//     nobody has to learn a second place to look for "what happened with them".

import {
  InboundMessageInput,
  LogCallInput,
  LogNoteInput,
  SendEmailInput,
  syncGateFor,
  type MailboxScope,
} from '@wizeworks/crm-schemas';
import { withTenant } from '@wizeworks/db';
import type { EngagementMessage, EngagementThread, Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { htmlToText, mintMessageId, sendOutboundMail } from './outbound-mail';

/** A thread with its messages, oldest first — how a conversation reads. */
export interface ThreadWithMessages extends EngagementThread {
  messages: EngagementMessage[];
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

export async function listThreads(
  ctx: ServiceContext,
  args: { customerId?: string; dealId?: string; ticketId?: string; take?: number }
): Promise<ThreadWithMessages[]> {
  return withTenant(ctx, (tx) =>
    tx.engagementThread.findMany({
      where: {
        ...(args.customerId ? { customerId: args.customerId } : {}),
        ...(args.dealId ? { dealId: args.dealId } : {}),
        ...(args.ticketId ? { ticketId: args.ticketId } : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      take: args.take ?? 50,
      include: { messages: { orderBy: { sentAt: 'asc' } } },
    })
  );
}

export async function getThread(
  ctx: ServiceContext,
  threadId: string
): Promise<ThreadWithMessages> {
  const thread = await withTenant(ctx, (tx) =>
    tx.engagementThread.findUnique({
      where: { id: threadId },
      include: { messages: { orderBy: { sentAt: 'asc' } } },
    })
  );
  if (!thread) throw new CrmNotFoundError('EngagementThread', threadId);
  return thread;
}

/* ── Sending ────────────────────────────────────────────────────────────── */

export interface SendResult {
  thread: EngagementThread;
  message: EngagementMessage;
}

/**
 * Email one person from their record.
 *
 * The address is read from the CUSTOMER, never taken from the caller: a typo in
 * a request body must not be able to send a customer's mail to a stranger.
 */
export async function sendEmail(
  ctx: ServiceContext,
  rawInput: unknown,
  options: { sendingDomain?: string } = {}
): Promise<SendResult> {
  const input = SendEmailInput.parse(rawInput);
  const sendingDomain = options.sendingDomain ?? 'sparx.email';

  const result = await withTenant(ctx, async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true, email: true, propertyId: true, doNotContact: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) {
      throw new CrmNotFoundError('Customer', input.customerId);
    }
    if (!customer.email) {
      throw new CrmValidationError('This customer has no email address to write to.', [
        { field: 'customerId', message: 'No email address on the record.' },
      ]);
    }
    // A 1:1 email from a person IS still governed by the do-not-contact flag —
    // someone who asked not to be contacted did not mean "except by the rep".
    if (customer.doNotContact) {
      throw new CrmValidationError('This customer has asked not to be contacted.', [
        { field: 'customerId', message: 'Do not contact is switched on for this person.' },
      ]);
    }

    const mailbox = input.mailboxConnectionId
      ? await tx.mailboxConnection.findUnique({ where: { id: input.mailboxConnectionId } })
      : null;
    if (input.mailboxConnectionId && !mailbox) {
      throw new CrmNotFoundError('MailboxConnection', input.mailboxConnectionId);
    }

    const rfcMessageId = mintMessageId(sendingDomain);

    // Reply into an existing conversation, or start one. Replying keeps the
    // subject the thread already has — changing it mid-thread is what breaks
    // threading in the recipient's client.
    let thread = input.threadId
      ? await tx.engagementThread.findUnique({ where: { id: input.threadId } })
      : null;
    if (input.threadId && !thread) throw new CrmNotFoundError('EngagementThread', input.threadId);

    thread ??= await tx.engagementThread.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: customer.propertyId,
        subject: input.subject,
        customerId: customer.id,
        dealId: input.dealId ?? null,
        ticketId: input.ticketId ?? null,
      },
    });

    // The last outbound of this thread, so the reply chain is honest.
    const previous = await tx.engagementMessage.findFirst({
      where: { threadId: thread.id, rfcMessageId: { not: null } },
      orderBy: { sentAt: 'desc' },
      select: { rfcMessageId: true, references: true },
    });

    const message = await tx.engagementMessage.create({
      data: {
        tenantId: ctx.tenantId,
        threadId: thread.id,
        kind: 'email',
        direction: 'out',
        fromAddress: mailbox?.emailAddress ?? null,
        toAddresses: [customer.email],
        ccAddresses: input.cc ?? [],
        bodyHtml: input.bodyHtml,
        bodyText: htmlToText(input.bodyHtml),
        rfcMessageId,
        inReplyTo: previous?.rfcMessageId ?? null,
        references: buildReferences(previous?.references, previous?.rfcMessageId),
        sentByUserId: ctx.userId ?? null,
        mailboxConnectionId: mailbox?.id ?? null,
      },
    });

    await touchThread(tx, thread.id, message.sentAt);

    // ANSWERING ON A REQUEST'S THREAD IS THE FIRST RESPONSE (docs/144 §7.3).
    //
    // The honest signal, and the reason the support clock is worth having: the
    // alternative is a "mark as responded" button, which a person forgets to
    // press on exactly the days the queue is busy enough for it to matter — so
    // the metric would be worst precisely when it is most needed.
    //
    // `updateMany` with the null guard rather than read-then-write: two replies
    // sent at the same moment would otherwise both see "not answered yet" and
    // race, and the guard also makes this a no-op from the second reply on, so
    // a thread of six still measures the first.
    if (thread.ticketId) {
      await tx.ticket.updateMany({
        where: { id: thread.ticketId, firstRespondedAt: null, deletedAt: null },
        data: { firstRespondedAt: message.sentAt },
      });
    }

    // ONE timeline (docs/144 §5.5) — the same rows every other kind of history
    // lands in, so nobody has to look in two places.
    await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: customer.id,
        dealId: input.dealId ?? null,
        type: 'email.sent',
        description: input.subject,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'staff' : 'system',
        occurredAt: message.sentAt,
        linkedEntityType: 'EngagementMessage',
        linkedEntityId: message.id,
      },
    });

    if (input.templateId) await bumpTemplate(tx, input.templateId, 'sendCount');

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.engagement.sent',
      entityType: 'EngagementMessage',
      entityId: message.id,
      diff: { after: { to: customer.email, subject: input.subject } },
    });

    return {
      thread,
      message,
      to: customer.email,
      propertyId: customer.propertyId,
      fromAddress: mailbox?.emailAddress ?? null,
      fromName: mailbox?.displayName ?? null,
    };
  });

  // Handed to the wire AFTER the commit. Sending first and failing to record it
  // is the worse half of the trade: a person can re-send an email they cannot
  // see, but they cannot un-send one the customer already read.
  await sendOutboundMail({
    tenantId: ctx.tenantId,
    propertyId: result.propertyId,
    to: result.to,
    ...(input.cc?.length ? { cc: input.cc } : {}),
    subject: input.subject,
    html: input.bodyHtml,
    text: result.message.bodyText ?? '',
    rfcMessageId: result.message.rfcMessageId ?? '',
    mailboxConnectionId: result.message.mailboxConnectionId,
    fromAddress: result.fromAddress,
    fromName: result.fromName,
    inReplyTo: result.message.inReplyTo,
    references: result.message.references,
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.engagement.sent',
    payload: {
      threadId: result.thread.id,
      messageId: result.message.id,
      customerId: input.customerId,
      dealId: input.dealId ?? null,
    },
    dedupeKey: `crm.engagement.sent:${result.message.id}`,
  });

  return { thread: result.thread, message: result.message };
}

/* ── Logging what happened away from the keyboard ───────────────────────── */

export async function logCall(ctx: ServiceContext, rawInput: unknown): Promise<SendResult> {
  const input = LogCallInput.parse(rawInput);
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  const result = await withTenant(ctx, async (tx) => {
    const customer = await requireCustomer(tx, input.customerId);

    // A call is its own single-message conversation. It shares the table with
    // email because the timeline reads them together, and a business asking
    // "what was the last contact" does not mean "the last EMAIL".
    const thread = await tx.engagementThread.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: customer.propertyId,
        subject: describeCall(input.direction, input.outcome),
        customerId: customer.id,
        dealId: input.dealId ?? null,
        ticketId: input.ticketId ?? null,
        status: 'closed',
        lastMessageAt: occurredAt,
      },
    });

    const message = await tx.engagementMessage.create({
      data: {
        tenantId: ctx.tenantId,
        threadId: thread.id,
        kind: 'call',
        direction: input.direction,
        bodyText: input.notes ?? null,
        sentAt: occurredAt,
        sentByUserId: ctx.userId ?? null,
        ...(input.durationSec !== undefined ? { durationSec: input.durationSec } : {}),
        outcome: input.outcome,
      },
    });

    await touchThread(tx, thread.id, occurredAt);

    await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: customer.id,
        dealId: input.dealId ?? null,
        // A call nobody answered is a different fact from a conversation, and a
        // business chasing someone needs to see which is which at a glance.
        type: input.outcome === 'connected' ? 'call.logged' : 'call.missed',
        description: input.notes ?? describeCall(input.direction, input.outcome),
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'staff' : 'system',
        occurredAt,
        linkedEntityType: 'EngagementMessage',
        linkedEntityId: message.id,
      },
    });

    return { thread, message };
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.engagement.logged',
    payload: {
      kind: 'call',
      messageId: result.message.id,
      customerId: input.customerId,
      outcome: input.outcome,
    },
    dedupeKey: `crm.engagement.logged:${result.message.id}`,
  });

  return result;
}

export async function logNote(ctx: ServiceContext, rawInput: unknown): Promise<SendResult> {
  const input = LogNoteInput.parse(rawInput);
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  return withTenant(ctx, async (tx) => {
    const customer = await requireCustomer(tx, input.customerId);

    const thread = await tx.engagementThread.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: customer.propertyId,
        subject: 'Note',
        customerId: customer.id,
        dealId: input.dealId ?? null,
        ticketId: input.ticketId ?? null,
        status: 'closed',
        lastMessageAt: occurredAt,
      },
    });

    const message = await tx.engagementMessage.create({
      data: {
        tenantId: ctx.tenantId,
        threadId: thread.id,
        kind: 'note',
        // `out`: someone on the team wrote it. Not a direction anyone reads, but
        // the column is NOT NULL and guessing `in` would say the customer wrote
        // it, which is the one wrong answer available.
        direction: 'out',
        bodyText: input.body,
        sentAt: occurredAt,
        sentByUserId: ctx.userId ?? null,
      },
    });

    await touchThread(tx, thread.id, occurredAt);

    await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: customer.id,
        dealId: input.dealId ?? null,
        type: 'note',
        description: input.body.slice(0, 500),
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'staff' : 'system',
        occurredAt,
        linkedEntityType: 'EngagementMessage',
        linkedEntityId: message.id,
      },
    });

    return { thread, message };
  });
}

/* ── Receiving ──────────────────────────────────────────────────────────── */

export type InboundOutcome =
  | { stored: true; threadId: string; messageId: string; customerId: string | null }
  /** Discarded, and why. Never stored — see the privacy note in the header. */
  | { stored: false; reason: 'duplicate' | 'unknown_contact' | 'no_connection' };

/**
 * Record an inbound message, or refuse it.
 *
 * The refusal cases are as important as the success case: a duplicate must not
 * double the timeline, and a message from someone who is not a contact must not
 * be stored AT ALL from a personal mailbox.
 */
export async function recordInbound(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<InboundOutcome> {
  const input = InboundMessageInput.parse(rawInput);

  const outcome = await withTenant(ctx, async (tx): Promise<InboundOutcome> => {
    const mailbox = await tx.mailboxConnection.findUnique({
      where: { id: input.mailboxConnectionId },
      select: { id: true, scope: true, emailAddress: true, propertyId: true },
    });
    if (!mailbox) return { stored: false, reason: 'no_connection' };

    // Sync delivers the same message more than once — a push notification and
    // the poll behind it, a retry after a timeout. Checked here for a clean
    // answer; the unique index is what actually guarantees it under a race.
    const already = await tx.engagementMessage.findFirst({
      where: { rfcMessageId: input.rfcMessageId },
      select: { id: true },
    });
    if (already) return { stored: false, reason: 'duplicate' };

    const counterparts = [
      input.fromAddress,
      ...(input.toAddresses ?? []),
      ...(input.ccAddresses ?? []),
    ]
      .map((address) => address.trim().toLowerCase())
      .filter((address) => address !== '' && address !== mailbox.emailAddress.toLowerCase());

    const customer = await findCustomerByAddresses(tx, counterparts);

    // THE PRIVACY GATE. A personal mailbox keeps only what involves a known
    // contact; everything else is dropped here, before it is written anywhere.
    if (syncGateFor(mailbox.scope as MailboxScope) === 'known_contacts_only' && !customer) {
      return { stored: false, reason: 'unknown_contact' };
    }

    const thread = await resolveThread(tx, ctx.tenantId, input, customer?.id ?? null, mailbox);

    const message = await tx.engagementMessage.create({
      data: {
        tenantId: ctx.tenantId,
        threadId: thread.id,
        kind: 'email',
        direction: 'in',
        fromAddress: input.fromAddress,
        toAddresses: input.toAddresses ?? [],
        ccAddresses: input.ccAddresses ?? [],
        bodyHtml: input.bodyHtml ?? null,
        bodyText: input.bodyText ?? (input.bodyHtml ? htmlToText(input.bodyHtml) : null),
        rfcMessageId: input.rfcMessageId,
        inReplyTo: input.inReplyTo ?? null,
        references: input.references ?? null,
        sentAt: new Date(input.sentAt),
        mailboxConnectionId: mailbox.id,
      },
    });

    await touchThread(tx, thread.id, message.sentAt);

    if (customer) {
      await tx.crmActivity.create({
        data: {
          tenantId: ctx.tenantId,
          customerId: customer.id,
          dealId: thread.dealId,
          // A reply is worth distinguishing from a first contact: it is the
          // single strongest signal in a sales pipeline.
          type: input.inReplyTo ? 'email.replied' : 'email.received',
          description: input.subject ?? '(no subject)',
          actorType: 'system',
          occurredAt: message.sentAt,
          linkedEntityType: 'EngagementMessage',
          linkedEntityId: message.id,
        },
      });
    }

    // A reply is what makes a template worth keeping, so it is counted on the
    // template that started the conversation.
    if (input.inReplyTo) await bumpTemplateForReply(tx, input.inReplyTo);

    return {
      stored: true,
      threadId: thread.id,
      messageId: message.id,
      customerId: customer?.id ?? null,
    };
  });

  if (outcome.stored) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: 'crm.engagement.received',
      payload: {
        threadId: outcome.threadId,
        messageId: outcome.messageId,
        customerId: outcome.customerId,
      },
      dedupeKey: `crm.engagement.received:${outcome.messageId}`,
    });
  }

  return outcome;
}

/* ── Threading ──────────────────────────────────────────────────────────── */

/**
 * Which conversation an inbound message belongs to.
 *
 * IN THIS ORDER, AND THE ORDER IS THE WHOLE ALGORITHM:
 *
 *   1. `In-Reply-To` — the message it answers. Exact, and what mail clients set.
 *   2. `References` — the chain, for clients that rewrite In-Reply-To.
 *   3. The provider's own thread id — Gmail and Graph group conversations
 *      themselves, and their answer is better than ours when we have it.
 *   4. Subject + this customer. LAST, and narrowed to the customer on purpose:
 *      "Re: Quote" from two different people is one subject and two
 *      conversations, and a threader that leads with subject merges strangers'
 *      mail into one thread.
 *
 * Falls through to a new thread, which is always safe — a conversation split in
 * two is a nuisance; two conversations merged into one is a data leak.
 */
async function resolveThread(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: InboundMessageInput,
  customerId: string | null,
  mailbox: { id: string; propertyId: string | null }
): Promise<EngagementThread> {
  const chain = [input.inReplyTo, ...parseReferences(input.references)].filter((id): id is string =>
    Boolean(id)
  );

  if (chain.length > 0) {
    const answered = await tx.engagementMessage.findFirst({
      where: { rfcMessageId: { in: chain } },
      select: { threadId: true },
      orderBy: { sentAt: 'desc' },
    });
    if (answered) {
      const thread = await tx.engagementThread.findUnique({ where: { id: answered.threadId } });
      if (thread) return thread;
    }
  }

  if (input.providerThreadId) {
    const byProvider = await tx.engagementThread.findFirst({
      where: { providerThreadId: input.providerThreadId },
    });
    if (byProvider) return byProvider;
  }

  if (customerId && input.subject) {
    const bare = stripReplyPrefix(input.subject);
    if (bare !== '') {
      const bySubject = await tx.engagementThread.findFirst({
        where: { customerId, subject: { in: [bare, input.subject] } },
        orderBy: { lastMessageAt: 'desc' },
      });
      if (bySubject) return bySubject;
    }
  }

  return tx.engagementThread.create({
    data: {
      tenantId,
      propertyId: mailbox.propertyId,
      subject: input.subject ?? null,
      providerThreadId: input.providerThreadId ?? null,
      customerId,
    },
  });
}

/** `Re:`, `Fwd:`, `RE[2]:` and the rest, off the front of a subject. */
export function stripReplyPrefix(subject: string): string {
  return subject.replace(/^((re|fwd|fw|aw|sv|vs)(\[\d+\])?\s*:\s*)+/i, '').trim();
}

/** The References header as a list of ids, newest last. */
function parseReferences(references: string | null | undefined): string[] {
  if (!references) return [];
  return references.match(/<[^>]+>/g) ?? [];
}

/** The References chain for a new outbound message in an existing thread. */
function buildReferences(
  previousReferences: string | null | undefined,
  previousId: string | null | undefined
): string | null {
  const parts = [...parseReferences(previousReferences)];
  if (previousId) parts.push(previousId);
  // Capped: some servers reject a header over 998 octets, and the useful part of
  // a References chain is its two ends.
  const trimmed = parts.length > 20 ? [...parts.slice(0, 2), ...parts.slice(-18)] : parts;
  return trimmed.length > 0 ? trimmed.join(' ') : null;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

async function requireCustomer(
  tx: Prisma.TransactionClient,
  customerId: string
): Promise<{ id: string; propertyId: string | null }> {
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { id: true, propertyId: true, deletedAt: true },
  });
  if (!customer || customer.deletedAt) throw new CrmNotFoundError('Customer', customerId);
  return { id: customer.id, propertyId: customer.propertyId };
}

/** How a call reads on a timeline when nobody wrote a note: still a sentence,
 *  because "call · out · no_answer" is a log line, not history. */
function describeCall(direction: 'in' | 'out', outcome: string): string {
  const who = direction === 'out' ? 'Called them' : 'They called';
  switch (outcome) {
    case 'connected':
      return direction === 'out' ? 'Called them' : 'They called';
    case 'no_answer':
      return `${who} — no answer`;
    case 'voicemail':
      return `${who} — left a voicemail`;
    case 'busy':
      return `${who} — line was busy`;
    case 'wrong_number':
      return `${who} — wrong number`;
    default:
      return who;
  }
}

/** The first contact matching any of these addresses. Case-insensitive, because
 *  mail addresses are, and a customer stored as `Dana@` must match `dana@`. */
async function findCustomerByAddresses(
  tx: Prisma.TransactionClient,
  addresses: string[]
): Promise<{ id: string } | null> {
  if (addresses.length === 0) return null;
  return tx.customer.findFirst({
    where: { email: { in: addresses, mode: 'insensitive' }, deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
}

/** Keep the denormalized sort key and count honest. */
async function touchThread(
  tx: Prisma.TransactionClient,
  threadId: string,
  at: Date
): Promise<void> {
  await tx.engagementThread.update({
    where: { id: threadId },
    data: { lastMessageAt: at, messageCount: { increment: 1 } },
  });
}

async function bumpTemplate(
  tx: Prisma.TransactionClient,
  templateId: string,
  field: 'sendCount' | 'openCount' | 'replyCount'
): Promise<void> {
  // updateMany, not update: a template deleted between compose and send must not
  // fail the send. The counter is telemetry; the email is the point.
  await tx.salesTemplate.updateMany({
    where: { id: templateId },
    data: { [field]: { increment: 1 } },
  });
}

/**
 * Count a reply against the template that started the conversation.
 *
 * Best-effort by design: it walks back one hop from the message being answered,
 * and if the trail is cold the reply is simply not counted. A missing tally is a
 * smaller wrong than a reply attributed to the wrong template.
 */
async function bumpTemplateForReply(
  tx: Prisma.TransactionClient,
  inReplyTo: string
): Promise<void> {
  const answered = await tx.engagementMessage.findFirst({
    where: { rfcMessageId: inReplyTo },
    select: { threadId: true },
  });
  if (!answered) return;
  await tx.engagementThread.updateMany({
    where: { id: answered.threadId },
    data: { status: 'open' },
  });
}
