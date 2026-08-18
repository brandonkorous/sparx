'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE CATALOG-WIDE SUBSCRIPTION DATA LAYER
//
// product-subscriptions.tsx answers "who buys THIS product on repeat" and is
// read-only, because a verb on a subscription (pause, cancel) belongs to the
// customer's whole standing order, not to one product in it. This layer is the
// other side: the catalog-wide list of every repeat order, and the ONE screen
// where those lifecycle verbs are the point — a subscription's own detail.
//
// The endpoints already exist (wizeworks/services/api-rest .../commerce/providers.ts):
// the models, service and billing worker shipped long before any transport, so
// list / get / pause / resume / cancel are all live. This is the first UI over
// them.
//
// Lifecycle mutations refresh BOTH the list and the one subscription's detail,
// because a pause changes the row in the list AND the state on the open detail.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled';

export interface SubscriptionSummary {
  id: string;
  customerId: string;
  customerName: string | null;
  status: SubscriptionStatus;
  nextOccurrenceAt: string | null;
  itemCount: number;
  monthlyRecurringRevenueCents: number;
  currency: string;
  providerSlug: string;
  /** `card` charges itself; `invoice` bills the customer and waits. */
  billingMode: string;
}

export interface SubscriptionPaymentMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  status: string;
}

export interface SubscriptionItem {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantity: number;
  unitPriceCents: number;
  addonOfId: string | null;
  addonOfName: string | null;
}

export interface SubscriptionEvent {
  id: string;
  event: string;
  payload: unknown;
  actorUserId: string | null;
  occurredAt: string;
}

export interface DunningAttempt {
  id: string;
  paymentRef: string | null;
  attemptNumber: number;
  outcome: string;
  failureReason: string | null;
  attemptedAt: string;
  nextRetryAt: string | null;
}

export interface SubscriptionDetail extends SubscriptionSummary {
  intervalUnit: string;
  intervalCount: number;
  deliveriesPerCycle: number;
  trialEndsAt: string | null;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  pausedUntil: string | null;
  cancelledAt: string | null;
  items: SubscriptionItem[];
  events: SubscriptionEvent[];
  dunningAttempts: DunningAttempt[];
  paymentMethod: SubscriptionPaymentMethod | null;
}

/**
 * Why this repeat order cannot currently collect, in the owner's words — or null
 * when it is fine.
 *
 * Worth stating on screen rather than leaving to inference: a card subscription
 * with no card looks completely healthy in a list (status `active`, a next date,
 * an MRR figure) and will silently never charge anybody. That is the exact
 * failure this whole area exists to fix, so the surface has to name it.
 */
export function billingProblem(sub: {
  billingMode: string;
  paymentMethod: SubscriptionPaymentMethod | null;
}): string | null {
  if (sub.billingMode !== 'card') return null;
  if (!sub.paymentMethod) {
    return 'No saved card — this repeat order cannot charge anyone. Add a card or switch it to invoicing.';
  }
  if (sub.paymentMethod.status !== 'active') {
    return `The saved card is ${sub.paymentMethod.status} and will be declined. Ask the customer for a new one, or switch to invoicing.`;
  }
  if (isCardExpired(sub.paymentMethod)) {
    return 'The saved card has expired. The next renewal will fail unless it is replaced.';
  }
  return null;
}

export function isCardExpired(method: SubscriptionPaymentMethod): boolean {
  if (!method.expMonth || !method.expYear) return false;
  return Date.now() >= Date.UTC(method.expYear, method.expMonth, 1);
}

/** "Visa ending 4242" — what a person recognises a card by. */
export function cardLabel(method: SubscriptionPaymentMethod): string {
  const brand = method.brand ? titleCase(method.brand) : 'Card';
  return method.last4 ? `${brand} ending ${method.last4}` : brand;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/* ── Keys ───────────────────────────────────────────────────────────────── */

export interface SubscriptionQuery {
  status?: SubscriptionStatus;
  /** Scope to one customer — their standing orders, seen from their profile. */
  customerId?: string;
  take: number;
  skip: number;
}

export const subscriptionKeys = {
  all: ['commerce', 'subscriptions'] as const,
  lists: () => [...subscriptionKeys.all, 'list'] as const,
  list: (query: SubscriptionQuery) => [...subscriptionKeys.lists(), query] as const,
  detail: (id: string) => [...subscriptionKeys.all, id] as const,
};

function invalidateSubscription(queryClient: QueryClient, id: string): void {
  void queryClient.invalidateQueries({ queryKey: subscriptionKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: subscriptionKeys.detail(id) });
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useSubscriptions(query: SubscriptionQuery) {
  return useQuery({
    queryKey: subscriptionKeys.list(query),
    queryFn: () =>
      api.list<SubscriptionSummary>('/v1/commerce/subscriptions', {
        ...(query.status ? { status: query.status } : {}),
        ...(query.customerId ? { customer_id: query.customerId } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useSubscription(id: string) {
  return useQuery({
    queryKey: subscriptionKeys.detail(id),
    queryFn: () => api.get<SubscriptionDetail>(`/v1/commerce/subscriptions/${id}`),
    enabled: id !== '',
  });
}

/* ── Lifecycle mutations ────────────────────────────────────────────────── */

export function usePauseSubscription(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { until?: string; reason?: string } = {}) =>
      api.post(`/v1/commerce/subscriptions/${id}/pause`, input),
    onSuccess: () => {
      invalidateSubscription(queryClient, id);
    },
  });
}

export function useResumeSubscription(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/v1/commerce/subscriptions/${id}/resume`),
    onSuccess: () => {
      invalidateSubscription(queryClient, id);
    },
  });
}

export function useCancelSubscription(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { atPeriodEnd: boolean; reason?: string }) =>
      api.post(`/v1/commerce/subscriptions/${id}/cancel`, input),
    onSuccess: () => {
      invalidateSubscription(queryClient, id);
    },
  });
}

/** The customer's saved cards — what the "use a different card" picker offers. */
export function useCustomerPaymentMethods(customerId: string) {
  return useQuery({
    queryKey: ['commerce', 'customer-payment-methods', customerId] as const,
    queryFn: () =>
      api.get<{ methods: SubscriptionPaymentMethod[] }>(
        `/v1/commerce/customers/${customerId}/payment-methods`
      ),
    enabled: customerId !== '',
  });
}

export function useChangeSubscriptionPaymentMethod(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { billingMode: 'card' | 'invoice'; paymentMethodId?: string }) =>
      api.post(`/v1/commerce/subscriptions/${id}/payment-method`, input),
    onSuccess: () => {
      invalidateSubscription(queryClient, id);
    },
  });
}

/* ── Saying what a state / event means ──────────────────────────────────── */

/** The repeat cadence in words: "every month", "every 2 weeks". */
export function cadenceLabel(unit: string, count: number): string {
  const noun = count === 1 ? unit : `${String(count)} ${unit}s`;
  return count === 1 ? `every ${unit}` : `every ${noun}`;
}

/** A lifecycle event in plain language for a non-technical owner. */
export function subscriptionEventLabel(event: string): string {
  switch (event) {
    case 'created':
      return 'Repeat order started';
    case 'renewed':
      return 'Renewed — an order was placed';
    case 'payment_failed':
      return 'A payment failed';
    case 'paused':
      return 'Paused';
    case 'resumed':
      return 'Resumed';
    case 'cancelled':
      return 'Stopped';
    case 'skipped':
      return 'A delivery was skipped';
    case 'item_changed':
      return 'What is delivered changed';
    case 'address_changed':
      return 'Delivery address changed';
    case 'payment_method_changed':
      return 'How it gets paid changed';
    case 'invoiced':
      return 'Billed — waiting on payment';
    case 'authentication_required':
      return 'The customer’s bank asked them to confirm';
    default:
      return event.replace(/_/g, ' ');
  }
}

export function dunningOutcomeState(outcome: string): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
} {
  switch (outcome) {
    case 'succeeded':
      return { label: 'Paid', tone: 'success' };
    case 'failed':
      return { label: 'Failed', tone: 'danger' };
    case 'retry_scheduled':
      return { label: 'Will try again', tone: 'warning' };
    default:
      return { label: outcome.replace(/_/g, ' '), tone: 'neutral' };
  }
}
