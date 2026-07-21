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
// The endpoints already exist (services/api-rest .../commerce/providers.ts):
// the models, service and billing worker shipped long before any transport, so
// list / get / pause / resume / cancel are all live. This is the first UI over
// them.
//
// Lifecycle mutations refresh BOTH the list and the one subscription's detail,
// because a pause changes the row in the list AND the state on the open detail.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@sparx/query';
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
}

/* ── Keys ───────────────────────────────────────────────────────────────── */

export interface SubscriptionQuery {
  status?: SubscriptionStatus;
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
