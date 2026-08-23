'use client';

// Selling something to somebody standing in front of you.
//
// `POST /v1/orders` has always existed and no screen in either console called
// it. The Orders list said, in its own comment, "orders arrive from customers,
// they are not something you create here" — true of a shop, false of a salon, a
// bakery, a garage or a therapist, which is most of who this is for. The money
// they take is taken in the room, and none of it could be written down.

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { useModuleStates } from '../../lib/api/shell-data';
import { ORDERS_KEY, type Order } from './data';
import { useVariantCatalog } from './bundles-data';

/** Anything the business can put on a sale: a thing off the shelf, or an hour of
 *  its own time. Both are lines on the same receipt, so both live in one list. */
export interface Sellable {
  key: string;
  kind: 'product' | 'service';
  name: string;
  /** The version, the length of the appointment — what tells two apart. */
  detail: string | null;
  priceCents: number;
  currency: string;
  sku: string;
  productId?: string;
  variantId?: string;
}

/** One line as it is being built. `sellable` is null for a hand-typed line. */
export interface SaleLine {
  id: string;
  name: string;
  quantity: number;
  /** Whole currency units, as typed. */
  price: string;
  sku: string;
  productId: string | null;
  variantId: string | null;
}

interface ServiceRow {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
}

/** Her diary services, which are the things a salon actually sells. Skipped when
 *  the module is off — an absent list, never an error on a till. */
function useSellableServices() {
  const modules = useModuleStates();
  const on = modules.data?.some((m) => m.slug === 'scheduling' && m.enabled) ?? false;
  return useQuery({
    queryKey: ['commerce', 'sale', 'services'] as const,
    queryFn: () => api.list<ServiceRow>('/v1/scheduling/services', { activeOnly: true, take: 250 }),
    enabled: on,
    staleTime: 5 * 60_000,
  });
}

function serviceSku(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `SERVICE-${slug || 'item'}`.slice(0, 60);
}

/**
 * Everything sellable, in one list, products and services together.
 *
 * She does not think "catalog" and "diary" — she thinks a bottle of shampoo and
 * a bond-repair treatment, and both go on the same receipt.
 */
export function useSellables() {
  const variants = useVariantCatalog();
  const services = useSellableServices();

  const items = useMemo<Sellable[]>(() => {
    const fromProducts = (variants.data ?? [])
      .filter((v) => v.productStatus !== 'archived')
      .map<Sellable>((v) => ({
        key: `variant:${v.id}`,
        kind: 'product',
        name: v.productTitle,
        detail: v.isDefault ? null : v.title,
        priceCents: v.priceCents,
        currency: v.currency,
        sku: v.sku,
        productId: v.productId,
        variantId: v.id,
      }));

    const fromServices = (services.data?.items ?? []).map<Sellable>((s) => ({
      key: `service:${s.id}`,
      kind: 'service',
      name: s.name,
      detail: s.durationMinutes > 0 ? `${s.durationMinutes} minutes` : null,
      priceCents: s.priceCents,
      currency: s.currency,
      sku: serviceSku(s.name),
    }));

    return [...fromServices, ...fromProducts].sort((a, b) => a.name.localeCompare(b.name));
  }, [variants.data, services.data]);

  return {
    items,
    isPending: variants.isPending || (services.isFetching && services.data === undefined),
    isError: variants.isError,
  };
}

export interface TakeSaleInput {
  customerId: string;
  currency: string;
  lines: SaleLine[];
  /** Whole currency units taken now. Zero means she has not been paid yet. */
  paid: number;
  paidWith: string;
  paidNote: string;
  /** Which business this was sold at. Without it the order has no origin site,
   *  and every site-scoped money screen — Payments, takings, profit — leaves it
   *  out of the totals while the order itself reads perfectly. */
  propertyId: string | null;
}

/** The same rate ref checkout writes when a shopper chooses to collect, so the
 *  order pane reads a counter sale as collected and stops offering a carrier, a
 *  tracking number and a warehouse walk. See `deliveryPlan` in order-types. */
const COLLECTION_RATE_REF = 'collection:in-person';

async function handOver(order: Order): Promise<void> {
  const lines = (order.items ?? []).map((item) => ({
    orderItemId: item.id,
    quantity: item.quantity,
  }));
  if (lines.length === 0) return;
  await api.post(`/v1/orders/${order.id}/fulfillments`, {
    status: 'delivered',
    carrier: 'pickup',
    lines,
  });
}

/**
 * Writes the sale down, the money against it, and the handover.
 *
 * Three calls because the platform stores three facts, and they are separate on
 * purpose — a part payment and an unpaid slip are both ordinary. The order goes
 * first: if a later call fails the order still exists and can be settled from
 * its own pane, whereas a payment with no order has nothing to belong to.
 *
 * The handover is not optional. A sale at a counter is over when it is made —
 * without it every one would sit in "To send" forever, waiting on a despatch
 * that already happened by hand.
 */
export function useTakeSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TakeSaleInput): Promise<Order> => {
      const order = await api.post<Order>('/v1/orders', {
        customerId: input.customerId,
        currency: input.currency,
        channel: 'admin',
        source: 'till',
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        metadata: {
          shippingRateRef: COLLECTION_RATE_REF,
          shippingDescription: 'Taken at the counter',
        },
        items: input.lines.map((line) => ({
          sku: line.sku,
          name: line.name,
          quantity: line.quantity,
          unitPrice: Number(line.price),
          ...(line.productId ? { productId: line.productId } : {}),
          ...(line.variantId ? { variantId: line.variantId } : {}),
        })),
      });
      if (input.paid > 0) {
        await api.post(`/v1/orders/${order.id}/payments`, {
          amount: input.paid,
          currency: input.currency,
          processor: input.paidWith,
          status: 'captured',
          capturedAt: new Date().toISOString(),
          ...(input.paidNote.trim() ? { processorRef: input.paidNote.trim() } : {}),
        });
      }
      await handOver(order);
      return order;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}
