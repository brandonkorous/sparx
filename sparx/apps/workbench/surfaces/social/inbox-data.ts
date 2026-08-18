'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE ENGAGEMENT-INBOX DATA LAYER
//
// The INBOUND half of social: comments under your posts, mentions, Google
// reviews, messages. Its own door because it is a different thing from
// publishing — a conversation someone else started, not something you send.
//
// ── The endpoints (wizeworks/services/api-rest/.../v1/social) ────────────────────────
//   GET   /v1/social/inbox                 → what needs answering       (viewer)
//   GET   /v1/social/inbox/count           → the nav badge number       (viewer)
//   GET   /v1/social/inbox/:id/thread      → one conversation, in order (viewer)
//   POST  /v1/social/inbox/:id/reply       → answer it                  (editor)
//   PATCH /v1/social/inbox/:id             → archive / reopen           (editor)
//
// Replying is two-phase on the server (write the reply, then a worker sends it),
// so a fresh reply appears in the thread as `sending` and settles to `replied`
// on the next read. The thread polls only while something is still in flight.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import { socialKeys, type Tone } from './data';

export type InboxKind = 'comment' | 'mention' | 'review' | 'message';
export type InboxStatus = 'open' | 'replied' | 'archived' | 'sending' | 'failed';

export interface InboxItem {
  id: string;
  socialTargetId: string;
  targetName: string;
  platform: string;
  postTargetId: string | null;
  kind: InboxKind;
  /** inbound = they said it; outbound = we replied. */
  direction: 'inbound' | 'outbound';
  externalId: string;
  threadExternalId: string | null;
  parentExternalId: string | null;
  authorName: string | null;
  authorHandle: string | null;
  authorAvatarUrl: string | null;
  text: string | null;
  /** 1–5 for a review; null for everything else. */
  rating: number | null;
  permalink: string | null;
  status: InboxStatus;
  receivedAt: string;
  repliedAt: string | null;
}

export interface InboxFilter {
  status?: 'open' | 'replied' | 'archived';
  kind?: InboxKind;
  socialTargetId?: string;
}

function filterKey(filter: InboxFilter): string {
  return `${filter.status ?? 'all'}:${filter.kind ?? 'all'}:${filter.socialTargetId ?? 'all'}`;
}

export function useInbox(filter: InboxFilter = {}) {
  return useQuery({
    queryKey: socialKeys.inbox(filterKey(filter)),
    queryFn: () =>
      api
        .get<{ items: InboxItem[] }>('/v1/social/inbox', {
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.kind ? { kind: filter.kind } : {}),
          ...(filter.socialTargetId ? { socialTargetId: filter.socialTargetId } : {}),
        })
        .then((r) => r.items),
  });
}

/**
 * Just the number waiting, for the nav badge.
 *
 * Polls on a slow clock: a comment arriving is not something anyone is watching for
 * second-by-second, and this runs whenever the Social panel is open. Fails quietly to
 * `0` — a badge is not worth an error state, and a tenant whose inbox isn't available
 * (the module off, the platform not cleared) should simply see no badge.
 */
export function useInboxCount(): number {
  const query = useQuery({
    queryKey: socialKeys.inboxCount,
    queryFn: () => api.get<{ open: number }>('/v1/social/inbox/count').then((r) => r.open),
    refetchInterval: 120_000,
    retry: false,
  });
  return query.data ?? 0;
}

/** One conversation, oldest first — both directions, so it reads like a conversation. */
export function useInboxThread(id: string | null) {
  return useQuery({
    queryKey: socialKeys.inboxThread(id ?? ''),
    queryFn: () =>
      api.get<{ items: InboxItem[] }>(`/v1/social/inbox/${id!}/thread`).then((r) => r.items),
    enabled: Boolean(id),
    // A reply is sent by a background worker, so keep checking while one is in flight —
    // and stop the moment the thread is settled.
    refetchInterval: (q) =>
      (q.state.data ?? []).some((i) => i.status === 'sending') ? 3_000 : false,
  });
}

function useInvalidateInbox() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['social', 'inbox'] });
  };
}

export function useReplyToInboxItem() {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.post<InboxItem>(`/v1/social/inbox/${id}/reply`, { text }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useSetInboxItemStatus() {
  const invalidate = useInvalidateInbox();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'open' | 'archived' }) =>
      api.patch<InboxItem>(`/v1/social/inbox/${id}`, { status }),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Presentation ───────────────────────────────────────────────────────── */

/** What kind of thing this is, in plain words. */
export function inboxKindLabel(kind: string): string {
  switch (kind) {
    case 'review':
      return 'Review';
    case 'mention':
      return 'Mention';
    case 'message':
      return 'Message';
    default:
      return 'Comment';
  }
}

/** Where an item is, with its own color — status is its own axis. */
export function inboxStatusMeta(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'replied':
      return { label: 'Answered', tone: 'success' };
    case 'sending':
      return { label: 'Sending', tone: 'info' };
    case 'archived':
      return { label: 'Archived', tone: 'neutral' };
    case 'failed':
      return { label: 'Could not send', tone: 'error' };
    default:
      return { label: 'Needs a reply', tone: 'warning' };
  }
}

/**
 * A review's rating is its own signal, so it gets its own tone: one and two stars are a
 * problem to answer today, three is worth a word, four and five are good news.
 */
export function ratingTone(rating: number): Tone {
  if (rating <= 2) return 'error';
  if (rating === 3) return 'warning';
  return 'success';
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
