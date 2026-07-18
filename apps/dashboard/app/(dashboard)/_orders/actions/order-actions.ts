'use server';

// Order core Server Actions — adapters over api-rest /v1/orders.
//
// Payment, refund, and fulfillment subresources live in their own action
// files so each one stays under the 200-line target and the page-level
// imports remain explicit about which subresource a form mutates.

import { revalidatePath } from 'next/cache';

import { revalidateOrder, revalidateOrderLists } from './revalidate';

import { api } from '@/lib/api-rest-client';

import type { ActionResult } from './_action-helpers';
import { restAction } from './_rest-action';

interface OrderResponse {
  id: string;
  orderNumber: string;
  customerId: string;
}

export async function createOrderAction(
  input: unknown
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  return restAction(async () => {
    const order = await api.post<OrderResponse>('/v1/orders', input);
    revalidateOrderLists();
    revalidatePath(`/crm/customers/${order.customerId}`);
    return { id: order.id, orderNumber: order.orderNumber };
  });
}

export async function updateOrderAction(
  orderId: string,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const order = await api.patch<OrderResponse>(`/v1/orders/${orderId}`, input);
    revalidateOrder(orderId);
    return { id: order.id };
  });
}

export async function cancelOrderAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return restAction(async () => {
    const { orderId } = input as { orderId: string };
    const order = await api.post<OrderResponse>(`/v1/orders/${orderId}/cancel`, input);
    revalidateOrder(order.id);
    revalidatePath(`/crm/customers/${order.customerId}`);
    return { id: order.id };
  });
}

export async function bulkCancelOrdersAction(
  ids: string[]
): Promise<ActionResult<{ cancelled: number }>> {
  return restAction(async () => {
    await Promise.all(
      ids.map((id) => api.post<OrderResponse>(`/v1/orders/${id}/cancel`, { reason: 'Bulk cancel' }))
    );
    revalidateOrderLists();
    return { cancelled: ids.length };
  });
}
