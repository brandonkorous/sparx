'use client';

// Client-side review + question submission for the PDP. Both are PUBLIC guest
// writes — no cart token, no merchant param — so they POST straight through the
// same-origin /api/sparx proxy (app/api/sparx) to the cross-tenant market surface,
// which resolves the listing slug → owning seller and enqueues the submission for
// that seller's moderation. Reads (the review list / Q&A) are server-rendered via
// lib/market.ts; only the write side lives here.

const API_BASE = '/api/sparx/v1/public/market';

export class ReviewRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ReviewRequestError';
    this.status = status;
  }
}

async function post<T>(path: string, json: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(json),
  });
  const body = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; error: { message: string; code: string } }
    | null;
  if (!res.ok || !body || body.success === false) {
    const message = body?.success === false ? body.error.message : `Request failed (${res.status})`;
    throw new ReviewRequestError(message, res.status);
  }
  return body.data;
}

export interface SubmitReviewInput {
  rating: number;
  authorName: string;
  authorEmail?: string;
  title?: string;
  body: string;
}

/** Submit a review — lands in the seller's moderation queue (shows as pending). */
export function submitProductReview(
  slug: string,
  input: SubmitReviewInput
): Promise<{ reviewId: string; status: string }> {
  return post(`/products/${encodeURIComponent(slug)}/reviews`, input);
}

export interface SubmitQuestionInput {
  displayName?: string;
  body: string;
}

/** Submit a question — enters moderation (published once the seller approves). */
export function submitProductQuestion(
  slug: string,
  input: SubmitQuestionInput
): Promise<{ questionId: string }> {
  return post(`/products/${encodeURIComponent(slug)}/questions`, input);
}
