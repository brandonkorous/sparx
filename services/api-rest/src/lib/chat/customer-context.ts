// Live Chat — CRM customer context for the inbox sidebar (docs/56, docs/69 A-1).
//
// Surfaces the "who am I talking to" panel: identity + lifetime value + recent
// orders for the customer linked to a conversation. Anonymous conversations
// (no customer_id) return just the captured visitor name/email.

import { withTenant } from '@sparx/db';
import type { TenantContext } from '@sparx/db';
import { notFound } from '@sparx/api-core/errors';

import { firstNonEmpty } from './types.js';

export interface RecentOrderDto {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  placedAt: string;
}

export interface CustomerContextDto {
  linked: boolean;
  customerId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  type: string | null;
  orderCount: number;
  lifetimeValue: number;
  lastOrderAt: string | null;
  recentOrders: RecentOrderDto[];
}

export async function getCustomerContext(
  ctx: TenantContext,
  conversationId: string
): Promise<CustomerContextDto> {
  return withTenant(ctx, async (tx) => {
    const conv = await tx.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, customerId: true, visitorName: true, visitorEmail: true },
    });
    if (!conv) throw notFound('Conversation', conversationId);

    if (!conv.customerId) {
      return {
        linked: false,
        customerId: null,
        name: conv.visitorName,
        email: conv.visitorEmail,
        phone: null,
        company: null,
        type: null,
        orderCount: 0,
        lifetimeValue: 0,
        lastOrderAt: null,
        recentOrders: [],
      };
    }

    const customer = await tx.customer.findUnique({
      where: { id: conv.customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        type: true,
        orderCount: true,
        totalSpent: true,
        lastOrderAt: true,
      },
    });
    if (!customer) throw notFound('Customer', conv.customerId);

    const orders = await tx.order.findMany({
      where: { customerId: customer.id },
      orderBy: { placedAt: 'desc' },
      take: 5,
      select: { id: true, orderNumber: true, status: true, total: true, placedAt: true },
    });

    const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
    const name = firstNonEmpty(fullName, customer.company, customer.email);

    return {
      linked: true,
      customerId: customer.id,
      name,
      email: customer.email,
      phone: customer.phone,
      company: customer.company,
      type: customer.type,
      orderCount: customer.orderCount,
      lifetimeValue: Number(customer.totalSpent),
      lastOrderAt: customer.lastOrderAt?.toISOString() ?? null,
      recentOrders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: Number(o.total),
        placedAt: o.placedAt.toISOString(),
      })),
    };
  });
}
