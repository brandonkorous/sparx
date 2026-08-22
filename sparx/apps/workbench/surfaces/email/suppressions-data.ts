'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE "DO NOT EMAIL" DATA LAYER
//
// The suppression list is the account's do-not-email list: every address sparx
// will not send to, and why. It is TWO things merged into one table server-side:
//
//   • Ones YOU added — someone asked to be taken off, so a person put them here.
//   • Ones the EMAIL SYSTEM added — an address bounced every time, or a recipient
//     hit "mark as spam", so the mail provider (Mailgun) flagged it and sparx
//     mirrored that flag here. Sending to those addresses is what gets a whole
//     account's mail treated as spam, so they are held back automatically.
//
// It is ACCOUNT-WIDE, not per-site: a person who opted out should not hear from
// any of the account's sites, so the API scopes this to the tenant (the send
// paths — broadcasts, automations — filter recipients against it before
// enqueuing). Nothing here threads a property id; the browser client already
// carries the active-site header the API resolves the tenant from.
//
// This file is the ONE door to the suppressions API in api-rest. The list, the
// add modal and the remove confirm all read and write through here, so the cache
// keys and the wire shapes live in one place and cannot drift.
//
// ── The key contract ──────────────────────────────────────────────────────
//   ['email']                                    the email ROOT every read nests
//                                                under — a write invalidates it
//   ['email','suppressions','list',{q,take,skip}] one window of the list
//
// Every write invalidates the ['email'] ROOT, so adding or removing an address is
// reflected across every open email surface at once (a broadcast's recipient
// count changes the moment someone is suppressed).
//
// The API filters server-side by `q` (email contains) and pages with take/skip.
// It does NOT filter by reason, so this surface never offers a reason filter: a
// filter that pages has to sit on the same side of the wire as the paging, and a
// client-side reason filter over a server-fetched page would only ever filter the
// page you happen to be standing on. Search + pages, both server-side. Honest.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';

/** Semantic tone shared with the Badge color axis — state carries its own color. */
export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** One suppressed address, exactly as `GET /v1/email/suppressions` returns it. */
export interface Suppression {
  id: string;
  email: string;
  /** Which mail this blocks: `all` (everything — the default), `transactional`
   *  (receipts/account mail) or `marketing` (newsletters/offers). */
  scope: string;
  /** Why it is here: `unsubscribe` | `complaint` | `bounce` | `manual`. */
  reason: string;
  /** Who put it here: `mailgun` (the email system flagged it), `manual` (added by
   *  hand) or `import` (added in bulk). Null on older rows. */
  source: string | null;
  customerId: string | null;
  note: string | null;
  createdAt: string;
}

/** The reasons an owner can pick when adding an address by hand, in the order the
 *  modal offers them — the common case (a person asked to stop) first. `bounce`
 *  is included because an owner may already know an address is dead, even though
 *  it is usually the email system that discovers that. */
export const MANUAL_REASONS = ['unsubscribe', 'complaint', 'bounce', 'manual'] as const;
export type ManualReason = (typeof MANUAL_REASONS)[number];

/* ── Query keys ─────────────────────────────────────────────────────────── */

export interface SuppressionListParams {
  q: string;
  take: number;
  skip: number;
}

export const emailKeys = {
  /** The email ROOT. Every write invalidates this, so any email surface refreshes. */
  all: ['email'] as const,
  suppressions: ['email', 'suppressions'] as const,
  suppressionList: (params: SuppressionListParams) =>
    ['email', 'suppressions', 'list', params] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

export function useSuppressions(params: SuppressionListParams) {
  return useQuery({
    queryKey: emailKeys.suppressionList(params),
    queryFn: () =>
      api.list<Suppression>('/v1/email/suppressions', {
        ...(params.q.trim() ? { q: params.q.trim() } : {}),
        take: params.take,
        skip: params.skip,
      }),
    // Keep the previous window on screen while the next one loads, so paging and
    // typing don't blink the list out to a spinner between every change.
    placeholderData: (previous) => previous,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: emailKeys.all });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export interface AddSuppressionInput {
  email: string;
  reason: ManualReason;
  /** Defaults to `all` — a hand-added "do not email" means never, not just the
   *  newsletter. Kept as a parameter so a narrower add is possible later. */
  scope?: 'all' | 'transactional' | 'marketing';
  note?: string;
}

export function useAddSuppression() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: AddSuppressionInput) =>
      api.post<Suppression>('/v1/email/suppressions', {
        email: input.email,
        reason: input.reason,
        scope: input.scope ?? 'all',
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      }),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function useRemoveSuppression() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/email/suppressions/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ── Presentation ───────────────────────────────────────────────────────── */

/** Why an address is on the list, in plain words plus a tone for the badge.
 *  State is its own color axis — this is not the module hue, it is the fact of
 *  what happened to this address. */
export function reasonMeta(reason: string): { label: string; tone: Tone; detail: string } {
  switch (reason) {
    case 'unsubscribe':
      return {
        label: 'Unsubscribed',
        tone: 'warning',
        detail: 'They asked to stop hearing from you.',
      };
    case 'complaint':
      return {
        label: 'Marked as spam',
        tone: 'error',
        detail:
          'They reported one of your emails as spam. Emailing them again risks your delivery.',
      };
    case 'bounce':
      return {
        label: 'Address did not work',
        tone: 'error',
        detail: 'Email to this address kept coming back undelivered, so sparx stopped trying.',
      };
    case 'manual':
      return {
        label: 'Added by you',
        tone: 'info',
        detail: 'Someone on your team added this address by hand.',
      };
    default:
      // A reason the API grew that this build has not learned yet — shown as-is
      // rather than hidden, and given a real tone so it is never a bland pill.
      return { label: reason, tone: 'info', detail: '' };
  }
}

/** Who put an address on the list, in plain words. */
export function sourceLabel(source: string | null): string {
  switch (source) {
    case 'mailgun':
      return 'Flagged by the email system';
    case 'import':
      return 'Imported by you';
    case 'manual':
      return 'Added by you';
    default:
      return 'Added by you';
  }
}

/** A plain-language note when a suppression is NARROWER than "everything" — the
 *  common `all` case needs no note, since blocking everything is what the whole
 *  list means. */
export function scopeNote(scope: string): string | null {
  if (scope === 'transactional') return 'Only receipts and account emails are held back';
  if (scope === 'marketing') return 'Only newsletters and offers are held back';
  return null;
}

/** When an address was added to the list. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** The server's own sentence for a 4xx — it names the exact problem (a malformed
 *  address, a duplicate) far better than a status code — else the caller's
 *  fallback for a 5xx that carries no useful sentence. */
export function suppressionErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
