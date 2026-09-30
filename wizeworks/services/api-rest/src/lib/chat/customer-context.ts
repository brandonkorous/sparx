// Live Chat — CRM customer context for the inbox sidebar (docs/56, docs/69 A-1).
//
// Surfaces the "who am I talking to" panel: identity + lifetime value for the
// customer behind a conversation.
//
// ── WHY THERE ARE TWO WAYS TO BE SOMEBODY ─────────────────────────────────
//
// This used to answer one question — does `chat_conversations.customer_id` name
// a customer — and return a bare `linked: boolean`. Nothing on the platform ever
// sets that column. The public widget is the only thing that creates a
// conversation and it passes no `customerId`; the staff creator that accepts one
// has no caller in either console. Measured 2026-09-28: 8 conversations on the
// database, 8 of them with a null `customer_id`. So the whole identity half of
// the panel was unreachable code, and every repeat customer showed as "Visitor"
// (issue 864). [[feedback_screen_over_a_function_nobody_calls]]
//
// The address is not nothing, though. The widget asks for it ("Visitors give
// their name and email before the chat starts"), stores it on the conversation,
// and the shop very often already knows it. So a second, weaker way to be
// somebody: the email the visitor TYPED matches a customer.
//
// It stays weaker on purpose. A typed address is a claim, not proof, so it is
// never written to `customer_id` — that would attach a stranger's messages to a
// real person's record for ever — and `match` tells the console which of the two
// it is looking at so it can say so in words.
//
// ── WHY THE MATCH IS SCOPED TO THE SITE ───────────────────────────────────
//
// `customers` is unique on (tenant, property, email) and separately on
// (tenant, email) for the site-less tier. It is NOT unique on (tenant, email),
// because one owner's two businesses may each know the same person. Measured on
// the same database: `marguerite.adeyemi@example.com` exists four times under
// one tenant, on four different sites. An email-only lookup would have answered
// with whichever of the four came back first and shown that one's spend.
//
// A conversation carries the site its widget was embedded on, so the site is
// asked first and the site-less tier second. Each of those two reads can match
// at most one row, which is what makes the answer deterministic.
// [[feedback_one_outcome_two_causes]]

import { withTenant } from '@wizeworks/db';
import type { TenantContext } from '@wizeworks/db';
import { notFound } from '@wizeworks/api-core/errors';

import { firstNonEmpty } from './types.js';

/**
 * How sure we are who this is.
 *
 *   `record`  the conversation itself names a customer. Proof.
 *   `email`   nothing names one, but the address the visitor typed matches a
 *             customer on this site. A strong hint, and not proof.
 *   `none`    an anonymous visitor.
 */
export type CustomerMatch = 'record' | 'email' | 'none';

export interface CustomerContextDto {
  match: CustomerMatch;
  customerId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  type: string | null;
  orderCount: number;
  lifetimeValue: number;
  lastOrderAt: string | null;
}

const CUSTOMER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  companyName: true,
  type: true,
  orderCount: true,
  totalSpent: true,
  lastOrderAt: true,
} as const;

interface CustomerRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  type: string;
  orderCount: number;
  totalSpent: unknown;
  lastOrderAt: Date | null;
}

const ANONYMOUS = {
  match: 'none',
  customerId: null,
  phone: null,
  company: null,
  type: null,
  orderCount: 0,
  lifetimeValue: 0,
  lastOrderAt: null,
} as const;

function toContext(customer: CustomerRow, match: 'record' | 'email'): CustomerContextDto {
  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return {
    match,
    customerId: customer.id,
    name: firstNonEmpty(fullName, customer.companyName, customer.email),
    email: customer.email,
    phone: customer.phone,
    company: customer.companyName,
    type: customer.type,
    orderCount: customer.orderCount,
    lifetimeValue: Number(customer.totalSpent),
    lastOrderAt: customer.lastOrderAt?.toISOString() ?? null,
  };
}

export async function getCustomerContext(
  ctx: TenantContext,
  conversationId: string
): Promise<CustomerContextDto> {
  return withTenant(ctx, async (tx) => {
    const conv = await tx.chatConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        customerId: true,
        propertyId: true,
        visitorName: true,
        visitorEmail: true,
      },
    });
    if (!conv) throw notFound('Conversation', conversationId);

    if (conv.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: conv.customerId },
        select: CUSTOMER_SELECT,
      });
      if (!customer) throw notFound('Customer', conv.customerId);
      return toContext(customer, 'record');
    }

    // No named customer. Try the address they typed, on their own site first.
    const typed = conv.visitorEmail?.trim().toLowerCase() ?? '';
    if (typed !== '') {
      const onSite = conv.propertyId
        ? await tx.customer.findFirst({
            where: { email: typed, propertyId: conv.propertyId, deletedAt: null },
            select: CUSTOMER_SELECT,
          })
        : null;
      const matched =
        onSite ??
        (await tx.customer.findFirst({
          where: { email: typed, propertyId: null, deletedAt: null },
          select: CUSTOMER_SELECT,
        }));
      if (matched) return toContext(matched, 'email');
    }

    return { ...ANONYMOUS, name: conv.visitorName, email: conv.visitorEmail };
  });
}
