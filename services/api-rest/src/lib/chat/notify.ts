// Live Chat — staff notification fan-out (docs/56, docs/69 A-6).
//
// When an inbound customer message needs a human (AI disabled / escalated /
// outside hours) this publishes:
//   • `chat.message.received` to Pub/Sub — the channel a future web-push sender
//     (kept OUT of email-worker per the service-boundary rule) consumes.
//   • one `email.send` per owner/admin — the "New chat message" notification,
//     rendered by email-worker's existing pipeline (chat-notification template).
//
// Guarded against spam: only the FIRST inbound message of an unassigned
// conversation notifies. Once staff is assigned or the thread is underway, no
// further emails fire.

import type { FastifyBaseLogger } from 'fastify';
import { prisma, withTenant } from '@sparx/db';
import type { TenantContext } from '@sparx/db';
import { publish } from '@sparx/api-core/pubsub';
import { appLink, appOrigin } from '@sparx/links/server';

import { resolveActivePropertyName } from '../property.js';
import { firstNonEmpty } from './types.js';

export type EscalationReason = 'ai_disabled' | 'away' | 'escalated';

export async function escalateToHuman(
  ctx: TenantContext,
  conversationId: string,
  logger: FastifyBaseLogger,
  reason: EscalationReason
): Promise<void> {
  // The event every notification channel keys off (web push, future consumers).
  await publish(logger, 'chat.message.received', ctx.tenantId, null, {
    conversationId,
    reason,
  });

  try {
    const info = await withTenant(ctx, async (tx) => {
      const conv = await tx.chatConversation.findUnique({
        where: { id: conversationId },
        select: {
          assignedToId: true,
          visitorName: true,
          visitorEmail: true,
          customer: { select: { firstName: true, lastName: true, email: true } },
        },
      });
      if (!conv) return null;
      const customerCount = await tx.chatMessage.count({
        where: { conversationId, senderType: 'customer' },
      });
      const lastCustomer = await tx.chatMessage.findFirst({
        where: { conversationId, senderType: 'customer' },
        orderBy: { createdAt: 'desc' },
        select: { body: true },
      });
      return { conv, customerCount, snippet: lastCustomer?.body ?? '' };
    });

    if (!info?.conv) return;
    // Staff already owns it, or this isn't the first inbound — don't email.
    if (info.conv.assignedToId || info.customerCount > 1) return;

    const fullName = [info.conv.customer?.firstName, info.conv.customer?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const customerName =
      firstNonEmpty(
        fullName,
        info.conv.visitorName,
        info.conv.customer?.email,
        info.conv.visitorEmail
      ) ?? 'A visitor';

    // The SITE name the chat came in on — the tenant's primary site (docs/49). The
    // staff notification reads "New message … on {siteName}"; never the tenant's
    // legal/org name.
    const siteName = await resolveActivePropertyName(ctx.tenantId, null);

    // owner/admin recipients. `users` is ENABLE-only RLS (not FORCE), so the
    // tenant filter scopes correctly without a tenant GUC.
    const recipients = await prisma.user.findMany({
      where: { tenantId: ctx.tenantId, role: { in: ['owner', 'admin'] } },
      select: { id: true, email: true },
    });

    // Built from the address table rather than assembled here, so a rename of
    // the conversation surface cannot silently orphan links already sent. The
    // old hand-built `/chat/<id>` stays valid as an alias for exactly that
    // reason — every push notification already delivered carries it.
    const conversationUrl = appLink('chat.inbox.thread', { id: conversationId }) ?? appOrigin();
    const snippet = info.snippet.slice(0, 200);

    // Each recipient gets an email (if they have an address) AND a web-push
    // fan-out (delivered only if they've registered a browser subscription).
    // push.send is composed here so push-worker stays a dumb sender.
    await Promise.all(
      recipients.flatMap((r) => {
        const sends: Promise<void>[] = [
          publish(logger, 'push.send', ctx.tenantId, null, {
            userId: r.id,
            title: `New message from ${customerName}`,
            body: snippet || 'New chat message',
            url: conversationUrl,
            tag: `chat-${conversationId}`,
          }),
        ];
        if (r.email) {
          sends.push(
            publish(logger, 'email.send', ctx.tenantId, null, {
              template: 'chat-notification',
              to: r.email,
              props: {
                customerName,
                messageSnippet: snippet,
                conversationUrl,
                ...(siteName ? { siteName } : {}),
              },
            })
          );
        }
        return sends;
      })
    );
  } catch (err) {
    logger.error({ err, conversationId }, 'chat staff notification failed');
  }
}
