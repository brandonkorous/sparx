'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE CATALOG-WIDE MODERATION DATA LAYER
//
// The product-scoped facet panes (product-reviews.tsx) moderate ONE product's
// reviews and questions, keyed under `productKeys.detail(id)`. These are the
// CROSS-PRODUCT queues: every review or question across the whole catalog that
// is waiting for a decision, plus the read-only wishlist analytics.
//
// They get their OWN query namespace (`['commerce','moderation', …]`) rather
// than nesting under any product, because a moderation queue is not a facet of
// one product — it spans all of them. But a decision made here DOES change a
// product: publishing a review moves that product's averageRating. So every
// mutation below invalidates BOTH the queue AND the product cache, so a
// product-reviews pane docked beside this one never shows a review this queue
// just cleared.
//
// The endpoints are the SAME ones the product-scoped hooks call
// (`/reviews/:id/moderate`, `/questions/:id/answer`, …). What differs is the
// cache scope being refreshed — which is why these are distinct hooks rather
// than a reuse of the product-scoped ones: reusing those would refresh a
// product's facet and leave this queue stale.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@sparx/query';
import { api } from '../../lib/api/client';
import { PRODUCTS_KEY } from './products-data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type ReviewModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

/** A review as the cross-product queue reads it. Unlike the product-scoped
 *  `ProductReview`, it carries the product's identity so the queue can name and
 *  link the product each review belongs to. */
export interface QueueReview {
  id: string;
  productId: string;
  productTitle: string | null;
  productHandle: string | null;
  variantId: string | null;
  rating: number;
  title: string;
  body: string;
  displayName: string | null;
  status: ReviewModerationStatus;
  verifiedPurchase: boolean;
  helpfulCount: number;
  unhelpfulCount: number;
  response: string | null;
  respondedAt: string | null;
  mediaAssetIds: string[];
  createdAt: string;
}

export interface QueueQuestionAnswer {
  id: string;
  questionId: string;
  body: string;
  isOfficial: boolean;
  createdAt: string;
}

export interface QueueQuestion {
  id: string;
  productId: string;
  productTitle: string | null;
  productHandle: string | null;
  displayName: string | null;
  body: string;
  status: string;
  helpfulCount: number;
  createdAt: string;
  answers: QueueQuestionAnswer[];
}

/** One most-saved variant. The shape mirrors the existing
 *  `GET /v1/commerce/wishlists/analytics` (services/api-rest .../commerce/lists.ts),
 *  which resolves product + variant identity inline. */
export interface WishlistTopVariant {
  variantId: string;
  sku: string | null;
  variantTitle: string | null;
  productId: string;
  productTitle: string;
  productHandle: string;
  saveCount: number;
}

/** The combined wishlist analytics payload — headline counts AND the most-saved
 *  variants, in ONE call. */
export interface WishlistAnalytics {
  wishlistCount: number;
  itemCount: number;
  topVariants: WishlistTopVariant[];
}

/* ── Keys ───────────────────────────────────────────────────────────────── */

export const moderationKeys = {
  all: ['commerce', 'moderation'] as const,
  reviews: () => [...moderationKeys.all, 'reviews'] as const,
  questions: () => [...moderationKeys.all, 'questions'] as const,
};

export const wishlistKeys = {
  all: ['commerce', 'wishlists'] as const,
  analytics: () => [...wishlistKeys.all, 'analytics'] as const,
};

/**
 * A decision here changes a review's queue membership AND its product's rating.
 * Refresh both: the queue this pane shows, and the whole product cache so a
 * product-reviews pane docked beside it re-reads. The product prefix is
 * invalidated coarsely because a bulk action can span products this side never
 * names.
 */
function invalidateReviewCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: moderationKeys.reviews() });
  void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
}

function invalidateQuestionCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: moderationKeys.questions() });
  void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
}

/* ── Queries ────────────────────────────────────────────────────────────── */

/** Pending + flagged reviews across every product — the moderation queue. */
export function usePendingReviews() {
  return useQuery({
    queryKey: moderationKeys.reviews(),
    queryFn: () => api.get<QueueReview[]>('/v1/commerce/reviews/pending'),
  });
}

/** Unanswered / un-moderated questions across every product. */
export function usePendingQuestions() {
  return useQuery({
    queryKey: moderationKeys.questions(),
    queryFn: () => api.get<QueueQuestion[]>('/v1/commerce/questions/pending'),
  });
}

/** Wishlist analytics — counts plus the most-saved variants — from the one
 *  pre-existing combined endpoint. Read-only; wishlists are the customer's, and
 *  staff see them only as a signal of what to stock or promote. */
export function useWishlistAnalytics() {
  return useQuery({
    queryKey: wishlistKeys.analytics(),
    queryFn: () => api.get<WishlistAnalytics>('/v1/commerce/wishlists/analytics', { take: 50 }),
  });
}

/* ── Review mutations ───────────────────────────────────────────────────── */

export function useModerateQueueReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: 'approved' | 'rejected' | 'flagged' }) =>
      api.post(`/v1/commerce/reviews/${input.id}/moderate`, { status: input.status }),
    onSuccess: () => {
      invalidateReviewCaches(queryClient);
    },
  });
}

export function useRespondQueueReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; response: string }) =>
      api.post(`/v1/commerce/reviews/${input.id}/respond`, { response: input.response }),
    onSuccess: () => {
      invalidateReviewCaches(queryClient);
    },
  });
}

export function useDeleteQueueReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/commerce/reviews/${id}`),
    onSuccess: () => {
      invalidateReviewCaches(queryClient);
    },
  });
}

export function useBulkModerateReviews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { reviewIds: string[]; status: 'approved' | 'rejected' | 'flagged' }) =>
      api.post<{ count: number }>('/v1/commerce/reviews/bulk-moderate', input),
    onSuccess: () => {
      invalidateReviewCaches(queryClient);
    },
  });
}

export function useBulkDeleteReviews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewIds: string[]) =>
      api.post<{ count: number }>('/v1/commerce/reviews/bulk-delete', { reviewIds }),
    onSuccess: () => {
      invalidateReviewCaches(queryClient);
    },
  });
}

/* ── Question mutations ─────────────────────────────────────────────────── */

export function useModerateQueueQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: 'published' | 'rejected' }) =>
      api.post(`/v1/commerce/questions/${input.id}/moderate`, { status: input.status }),
    onSuccess: () => {
      invalidateQuestionCaches(queryClient);
    },
  });
}

export function useAnswerQueueQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; body: string }) =>
      api.post(`/v1/commerce/questions/${input.id}/answer`, { body: input.body, isOfficial: true }),
    onSuccess: () => {
      invalidateQuestionCaches(queryClient);
    },
  });
}

export function useBulkModerateQuestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { questionIds: string[]; status: 'published' | 'rejected' }) =>
      api.post<{ count: number }>('/v1/commerce/questions/bulk-moderate', input),
    onSuccess: () => {
      invalidateQuestionCaches(queryClient);
    },
  });
}
