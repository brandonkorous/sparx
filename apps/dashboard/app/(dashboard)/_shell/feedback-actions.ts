'use server';

// In-product feedback — server actions (docs/112 §7). Thin wrappers over the
// api-rest `/v1/me/feedback*` endpoints; the api client signs the staff session
// JWT, so api-rest derives the user + tenant. Called from client components
// directly (mutations) and as @sparx/query queryFns (polled reads), mirroring
// the ⌘K deep-search action.

import { api, type ApiRestError } from '@/lib/api-rest-client';
import type {
  FeedbackListResult,
  FeedbackMessageRow,
  FeedbackSubmission,
  FeedbackSubmissionInput,
  FeedbackSubmitResult,
  FeedbackThread,
  PulseAction,
  PulseDescriptor,
} from './feedback-types';

export async function submitFeedbackAction(
  input: FeedbackSubmissionInput
): Promise<FeedbackSubmitResult> {
  try {
    const submission = await api.post<FeedbackSubmission>('/v1/me/feedback', input);
    return { ok: true, submission };
  } catch (e) {
    const err = e as Partial<ApiRestError>;
    // The api-rest message carries the friendly server copy; for the rate-limit
    // case surface it verbatim, otherwise a generic retry line.
    if (err?.code === 'RATE_LIMITED' || err?.status === 429) {
      return {
        ok: false,
        error:
          "You've sent a lot of feedback recently — thank you! Please try again in a little while.",
      };
    }
    return { ok: false, error: 'Could not send your feedback. Please try again.' };
  }
}

export async function listMyFeedbackAction(): Promise<FeedbackListResult> {
  return api.get<FeedbackListResult>('/v1/me/feedback');
}

export async function getFeedbackUnreadCountAction(): Promise<number> {
  const { count } = await api.get<{ count: number }>('/v1/me/feedback/unread-count');
  return count;
}

export async function getFeedbackThreadAction(id: string): Promise<FeedbackThread> {
  return api.get<FeedbackThread>(`/v1/me/feedback/${encodeURIComponent(id)}`);
}

export async function replyToFeedbackAction(id: string, body: string): Promise<FeedbackMessageRow> {
  return api.post<FeedbackMessageRow>(`/v1/me/feedback/${encodeURIComponent(id)}/messages`, {
    body,
  });
}

export async function getFeedbackPulseAction(route?: string): Promise<PulseDescriptor | null> {
  const qs = route ? `?route=${encodeURIComponent(route)}` : '';
  return api.get<PulseDescriptor | null>(`/v1/me/feedback/pulse${qs}`);
}

export async function recordPulseEventAction(
  action: PulseAction,
  sentiment?: number
): Promise<void> {
  await api.post<{ recorded: boolean }>('/v1/me/feedback/pulse/event', { action, sentiment });
}
