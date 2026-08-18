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

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
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
 *  `GET /v1/commerce/wishlists/analytics` (wizeworks/services/api-rest .../commerce/lists.ts),
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

/* ── Table-row shapes ───────────────────────────────────────────────────────
 *
 * The TABLE surfaces read the fuller `/v1/commerce/reviews` and
 * `/v1/commerce/questions` list endpoints — every status, paged and sorted —
 * rather than the `/pending` backlog the card queues read. Those endpoints
 * resolve the customer's ACCOUNT identity (a relation) rather than the review's
 * chosen public `displayName`, which is what a moderator wants: who really wrote
 * it, not the alias it appears under. So the row carries a `customer` object,
 * not a `displayName`. */

export interface QueueCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

/** One row of the questions TABLE. */
export interface QuestionListRow {
  id: string;
  productId: string;
  productTitle: string | null;
  productHandle: string | null;
  body: string;
  status: string;
  createdAt: string;
  customer: QueueCustomer | null;
}

/** One row of the reviews TABLE. */
export interface ReviewListRow {
  id: string;
  productId: string;
  productTitle: string | null;
  productHandle: string | null;
  rating: number;
  title: string;
  body: string;
  status: ReviewModerationStatus;
  verifiedPurchase: boolean;
  createdAt: string;
  customer: QueueCustomer | null;
}

/** A person's name from their account, or their email, or a plain fallback —
 *  the label a table cell shows under "Asked by" / "By". */
export function customerLabel(customer: QueueCustomer | null): string {
  if (!customer) return 'A guest';
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  return customer.email ?? 'A guest';
}

/* ── Keys ───────────────────────────────────────────────────────────────── */

export const moderationKeys = {
  all: ['commerce', 'moderation'] as const,
  reviews: () => [...moderationKeys.all, 'reviews'] as const,
  questions: () => [...moderationKeys.all, 'questions'] as const,
  // Nested UNDER the reviews()/questions() prefixes on purpose: every mutation
  // invalidates that prefix coarsely, so the table window, the pending backlog
  // and a focused single item all refresh together after any decision.
  reviewsList: (params: unknown) => [...moderationKeys.reviews(), 'list', params] as const,
  review: (id: string) => [...moderationKeys.reviews(), 'detail', id] as const,
  questionsList: (params: unknown) => [...moderationKeys.questions(), 'list', params] as const,
  question: (id: string) => [...moderationKeys.questions(), 'detail', id] as const,
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

/* ── The table windows (every status, paged + server-sorted) ─────────────── */

export type ModerationSortDir = 'asc' | 'desc';
/** Columns the questions table may order by — a SUBSET of the server whitelist
 *  (`QuestionSort` in api-rest commerce/lists.ts). The server rejects anything
 *  off its list with a 422, so a typo here fails loudly. */
export type QuestionSort = 'createdAt' | 'status';
/** Columns the reviews table may order by — a subset of the server `ReviewSort`. */
export type ReviewSort = 'createdAt' | 'rating' | 'status';

export interface ModerationPageParams<TSort> {
  q?: string;
  /** A concrete status to filter to, or 'all' / undefined for every status. */
  status?: string;
  sortBy: TSort;
  order: ModerationSortDir;
  take: number;
  skip: number;
}

function listQuery<TSort extends string>(params: ModerationPageParams<TSort>) {
  return {
    ...(params.q?.trim() ? { q: params.q.trim() } : {}),
    ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
    sort_by: params.sortBy,
    order: params.order,
    take: params.take,
    skip: params.skip,
  };
}

/**
 * One server-paged, server-sorted window of the questions table.
 *
 * `placeholderData` keeps the previous window on screen while the next loads, so
 * paging and re-sorting never blink the table out to empty and back. The whole
 * window is ONE query — never accumulated pages, never a client-side sort of a
 * loaded window (which would sort one page and call it the answer).
 */
export function useQuestionsList(params: ModerationPageParams<QuestionSort>) {
  return useQuery({
    queryKey: moderationKeys.questionsList(params),
    queryFn: () => api.list<QuestionListRow>('/v1/commerce/questions', listQuery(params)),
    placeholderData: (previous) => previous,
  });
}

/** One server-paged, server-sorted window of the reviews table. */
export function useReviewsList(params: ModerationPageParams<ReviewSort>) {
  return useQuery({
    queryKey: moderationKeys.reviewsList(params),
    queryFn: () => api.list<ReviewListRow>('/v1/commerce/reviews', listQuery(params)),
    placeholderData: (previous) => previous,
  });
}

/* ── One item, in full — the queue's focused card ────────────────────────── */

/** The raw `/questions/:id` payload. Differs from `QueueQuestion` only in that
 *  its answers omit the (redundant) parent `questionId`, filled back in below. */
interface QuestionDetailPayload {
  id: string;
  productId: string;
  productTitle: string | null;
  productHandle: string | null;
  displayName: string | null;
  body: string;
  status: string;
  helpfulCount: number;
  createdAt: string;
  answers: { id: string; body: string; isOfficial: boolean; createdAt: string }[];
}

function toQueueQuestion(payload: QuestionDetailPayload): QueueQuestion {
  return {
    id: payload.id,
    productId: payload.productId,
    productTitle: payload.productTitle,
    productHandle: payload.productHandle,
    displayName: payload.displayName,
    body: payload.body,
    status: payload.status,
    helpfulCount: payload.helpfulCount,
    createdAt: payload.createdAt,
    answers: payload.answers.map((a) => ({
      id: a.id,
      questionId: payload.id,
      body: a.body,
      isOfficial: a.isOfficial,
      createdAt: a.createdAt,
    })),
  };
}

/** One question in full — including any that have already been decided, which the
 *  pending backlog cannot contain. Lets the queue open focused on ANY row the
 *  table links to, not just a still-pending one. */
export function useQueueQuestion(id: string | undefined) {
  return useQuery({
    queryKey: moderationKeys.question(id ?? 'none'),
    queryFn: () =>
      api.get<QuestionDetailPayload>(`/v1/commerce/questions/${id ?? ''}`).then(toQueueQuestion),
    enabled: Boolean(id),
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** One review in full. `/reviews/:id` already returns the exact `QueueReview`
 *  shape (verified-purchase, response, media and all), so no mapping is needed. */
export function useQueueReview(id: string | undefined) {
  return useQuery({
    queryKey: moderationKeys.review(id ?? 'none'),
    queryFn: () => api.get<QueueReview>(`/v1/commerce/reviews/${id ?? ''}`),
    enabled: Boolean(id),
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
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
