'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE GIFT-CARD DATA LAYER
//
// A gift card is money a shopper pre-pays for someone else to spend. It has a
// CODE and a BALANCE, and — this is the point — the balance is never edited in
// place. It only moves through recorded transactions: issued, spent, or adjusted
// by hand (a refund, a goodwill top-up). So this layer exposes ISSUE and ADJUST
// as the only writes, and reads the ledger as history.
//
//   ['commerce','gift-cards']              the root every read nests under
//   ['commerce','gift-cards','list',{q}]   the list surface's window
//   ['commerce','gift-cards', id]          one card, WITH its ledger
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';
import type { Tone } from './products-data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export interface GiftCardRow {
  id: string;
  code: string;
  balanceCents: number;
  initialBalanceCents: number;
  currency: string;
  status: string;
  expiresAt: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  createdAt: string;
}

export interface GiftCardTransaction {
  id: string;
  deltaCents: number;
  /** `issue` | `redeem` | `adjust` | `refund` | `expire`. */
  reason: string;
  note: string | null;
  orderId: string | null;
  createdAt: string;
}

export interface GiftCardDetail extends GiftCardRow {
  message: string | null;
  transactions: GiftCardTransaction[];
}

export const giftCardKeys = {
  all: ['commerce', 'gift-cards'] as const,
  detail: (id: string) => [...giftCardKeys.all, id] as const,
};

/* ── The list window ────────────────────────────────────────────────────── */

export type SortDir = 'asc' | 'desc';

/** Columns the list may be ordered by. A SUBSET of the server whitelist
 *  (`GiftCardSortField` in the discount service) — the ones this table exposes
 *  a header for. */
export type GiftCardSort = 'code' | 'balanceCents' | 'status' | 'expiresAt' | 'createdAt';

export interface GiftCardsPageParams {
  q?: string;
  sortBy: GiftCardSort;
  order: SortDir;
  take: number;
  skip: number;
}

/**
 * One server-paged, server-sorted window of the gift-card list.
 *
 * The gift-card endpoint gained real paging (skip/take/total) so this can be a
 * proper table like discounts. As there, the whole window is ONE query and the
 * previous window stays put while the next loads.
 */
export function useGiftCardsList(params: GiftCardsPageParams) {
  return useQuery({
    queryKey: [...giftCardKeys.all, 'list', params],
    queryFn: () =>
      api.list<GiftCardRow>('/v1/commerce/gift-cards', {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        sort_by: params.sortBy,
        order: params.order,
        take: params.take,
        skip: params.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

/** What a gift card is doing now, in plain words. */
export function giftCardState(status: string): { label: string; tone: Tone; detail: string } {
  switch (status) {
    case 'active':
      return { label: 'Ready to spend', tone: 'success', detail: 'It still has money on it.' };
    case 'spent':
      return {
        label: 'Used up',
        tone: 'neutral',
        detail: 'Its whole balance has been spent — nothing left on it.',
      };
    case 'expired':
      return {
        label: 'Expired',
        tone: 'warning',
        detail: 'Its expiry date has passed, so it can no longer be spent.',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        tone: 'danger',
        detail: 'It was cancelled and can no longer be spent.',
      };
    default:
      return { label: status, tone: 'neutral', detail: '' };
  }
}

/** How a ledger line reads to a person. */
export function transactionMeaning(reason: string): string {
  switch (reason) {
    case 'issue':
      return 'Loaded when the card was created';
    case 'redeem':
      return 'Spent on an order';
    case 'adjust':
      return 'Adjusted by hand';
    case 'refund':
      return 'Refunded';
    case 'expire':
      return 'Removed on expiry';
    default:
      return reason;
  }
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useGiftCard(id: string) {
  return useQuery({
    queryKey: giftCardKeys.detail(id),
    queryFn: () => api.get<GiftCardDetail>(`/v1/commerce/gift-cards/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateGiftCards() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: giftCardKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: giftCardKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/** The `IssueGiftCardInput` shape. `initialBalanceCents` must be positive; a
 *  `customCode` is optional (the server mints one when absent). */
export interface IssueGiftCardInput {
  initialBalanceCents: number;
  currency: string;
  recipientEmail?: string;
  recipientName?: string;
  message?: string;
  expiresAt?: string;
  customCode?: string;
}

export function useIssueGiftCard() {
  const invalidate = useInvalidateGiftCards();
  return useMutation({
    mutationFn: (input: IssueGiftCardInput) =>
      api.post<{ id: string; code: string }>('/v1/commerce/gift-cards', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

/** Move a card's balance by a SIGNED amount, with a reason recorded in the
 *  ledger. Satisfies `AdjustGiftCardInput`. */
export function useAdjustGiftCard() {
  const invalidate = useInvalidateGiftCards();
  return useMutation({
    mutationFn: (input: { giftCardId: string; deltaCents: number; reason: string }) =>
      api.post<{ newBalanceCents: number }>('/v1/commerce/gift-cards/adjust', input),
    onSuccess: (_result, input) => {
      invalidate(input.giftCardId);
    },
  });
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

export function giftCardErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
