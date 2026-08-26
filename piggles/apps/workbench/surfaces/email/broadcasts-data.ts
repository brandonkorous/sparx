'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE BROADCASTS DATA LAYER
//
// A broadcast is one email sent to a group of people at once — a newsletter, an
// offer, an announcement. You choose WHO it goes to (an audience), WHAT it says
// (a designed email), then send it now or schedule it for later. Once it has
// gone out, this is also where you see how it did: who opened it, who clicked.
//
// This file is the ONE door to the broadcasts API in api-rest. Every broadcast
// surface — the list and the composer — reads and writes through here, so the
// cache keys and the typed shapes live in one place and can never drift.
//
// ── What a broadcast references ────────────────────────────────────────────
// The BODY is a published Builder email (`builderEmailId`) — the designed email
// picked in the composer. The legacy "marketing template" body is retired, so a
// broadcast has exactly one way to say what it sends. The AUDIENCE is a CRM
// segment (`segmentId`) — "who it goes to". Both are soft references the composer
// resolves for its pickers; the send fans out to the segment's members on this
// site, minus anyone who has unsubscribed or bounced.
//
// The SENDING ADDRESS is not per-broadcast: it comes from this site's email
// settings (from name + from address), shown read-only in the composer so nobody
// wonders where their email will appear to come from.
//
// ── The key contract ──────────────────────────────────────────────────────
//   ['email']                              the root every read nests under
//   ['email','broadcasts']                 the broadcasts list
//   ['email','broadcast', id]              one broadcast, in full
//   ['email','broadcast', id, 'stats']     one broadcast's engagement counts
//   ['email','estimate', segmentId]        how many people an audience reaches
//   ['email','audiences']                  the CRM segments the composer offers
//   ['email','designed']                   the Builder emails the composer offers
//   ['email','broadcast', id, 'preview']   the send itself, rendered
//   ['email','settings']                   the sending address (read-only)
//
// The WRITES live beside this in broadcasts-mutations.ts; every one of them
// invalidates the ['email'] ROOT, so a create, edit, send, schedule or cancel is
// reflected across every open email surface at once.
// ══════════════════════════════════════════════════════════════════════════

import { useQuery } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';

/* ── Semantic tone (shared with the Badge color axis) ────────────────────── */

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/* ── The broadcast (the raw wire row, dates as ISO strings) ───────────────── */

/** draft → scheduled → sending → sent, plus the two off-ramps. A broadcast is
 *  editable ONLY while `draft`; everything after is read-only. */
export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed';

/** One broadcast, as `GET /v1/email/broadcasts/:id` returns it. */
export interface Broadcast {
  id: string;
  tenantId: string;
  /** The site this broadcast is sent on behalf of. Null = the account's primary. */
  propertyId: string | null;
  name: string;
  subject: string;
  preheader: string | null;
  /** The designed email used as the body (a Builder email). Null until chosen. */
  builderEmailId: string | null;
  /** The audience (a CRM segment). Null until chosen. */
  segmentId: string | null;
  status: BroadcastStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  /** How many people it actually went to — 0 until it sends. */
  recipientCount: number;
  campaignTag: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Engagement counts, as `GET /v1/email/broadcasts/:id/stats` returns them. */
export interface BroadcastStats {
  accepted: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
}

/** One audience the composer can target (a CRM segment). */
export interface Audience {
  id: string;
  name: string;
  description: string | null;
}

/** One designed email the composer can send (a Builder email). `published` is
 *  the gate the send enforces — an unpublished email has no body to deliver. */
export interface DesignedEmail {
  id: string;
  name: string;
  subject: string;
  published: boolean;
  /** Set on a built-in email that a single event sends — an order confirmation,
   *  an invoice reminder. Null on one the owner wrote. A broadcast may only send
   *  the second kind: see `broadcastableEmails`. */
  key: string | null;
}

/** The designed emails it makes sense to send to a whole audience.
 *
 *  A keyed email is triggered by ONE event and written about it: it says "your
 *  order has shipped" and reads `{{order.number}}`, which no audience has. The
 *  picker offered all forty-five, so "Payment failed" sat two rows from the
 *  newsletter, and choosing it would have told every subscriber their payment
 *  had failed. Only emails the owner wrote herself belong here. */
export function broadcastableEmails(emails: DesignedEmail[] | undefined): DesignedEmail[] {
  return (emails ?? []).filter((email) => email.key === null);
}

/** The rendered preview of a broadcast, or the reason there isn't one yet. */
export type BroadcastPreview =
  | { ready: false; reason: 'no-email' | 'not-published' | 'no-audience' }
  | { ready: true; to: string; from: string; subject: string; html: string; text: string };

/** This site's sender identity, shown read-only in the composer. */
export interface EmailSettings {
  fromName: string | null;
  fromAddress: string | null;
  replyTo: string | null;
  /** The literal `From` header the send will carry, resolved by the server —
   *  including the platform fallback when nothing here is filled in. */
  resolvedFrom: string;
}

/* ── Query keys ───────────────────────────────────────────────────────────── */

export const emailKeys = {
  all: ['email'] as const,
  broadcasts: ['email', 'broadcasts'] as const,
  broadcast: (id: string) => ['email', 'broadcast', id] as const,
  stats: (id: string) => ['email', 'broadcast', id, 'stats'] as const,
  preview: (id: string) => ['email', 'broadcast', id, 'preview'] as const,
  estimate: (segmentId: string) => ['email', 'estimate', segmentId] as const,
  audiences: ['email', 'audiences'] as const,
  designed: ['email', 'designed'] as const,
  settings: ['email', 'settings'] as const,
};

/* ── Reads ────────────────────────────────────────────────────────────────── */

export function useBroadcasts() {
  return useQuery({
    queryKey: emailKeys.broadcasts,
    // api-rest orders newest-first; the whole (bounded) set comes in one request,
    // so search and status filtering happen client-side against a stable list.
    queryFn: () => api.get<Broadcast[]>('/v1/email/broadcasts'),
    placeholderData: (previous) => previous,
  });
}

export function useBroadcast(id: string) {
  return useQuery({
    queryKey: emailKeys.broadcast(id),
    queryFn: () => api.get<Broadcast>(`/v1/email/broadcasts/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** Engagement counts for one broadcast. Enabled only once it has gone out —
 *  before that there is nothing to count, and the row carries no events. */
export function useBroadcastStats(id: string, enabled: boolean) {
  return useQuery({
    queryKey: emailKeys.stats(id),
    queryFn: () => api.get<BroadcastStats>(`/v1/email/broadcasts/${id}/stats`),
    enabled: enabled && id !== 'new',
    placeholderData: (previous) => previous,
  });
}

/** How many people an audience reaches on this site. Scoped by the SAME predicate
 *  the send uses, so the number shown is the audience the broadcast will mail. */
export function useRecipientEstimate(segmentId: string) {
  return useQuery({
    queryKey: emailKeys.estimate(segmentId),
    queryFn: () =>
      api.get<{ count: number }>('/v1/email/broadcasts/estimate', { segment_id: segmentId }),
    enabled: segmentId !== '',
    placeholderData: (previous) => previous,
  });
}

/** The audiences the composer offers (CRM segments). Read-only reference data,
 *  keyed under the email root so it lives beside the surfaces that use it. */
export function useAudiences() {
  return useQuery({
    queryKey: emailKeys.audiences,
    queryFn: () => api.get<Audience[]>('/v1/crm/segments'),
    staleTime: 60_000,
  });
}

/** The designed emails the composer offers (Builder emails).
 *
 *  `staleTime: 0` on purpose: the composer's own "Design emails" button opens
 *  the designer, so the list is expected to change while the composer is sitting
 *  open behind it. Cached for a minute, an email the owner had just designed was
 *  simply absent from the picker she designed it for. */
export function useDesignedEmails() {
  return useQuery({
    queryKey: emailKeys.designed,
    queryFn: () =>
      api.get<{ emails: DesignedEmail[] }>('/v1/builder/emails').then((data) => data.emails),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

/** What this broadcast will look like in somebody's inbox — the send itself,
 *  rendered for a real person out of its own audience. `ready:false` says which
 *  piece is missing rather than showing a blank frame. */
export function useBroadcastPreview(id: string, enabled: boolean) {
  return useQuery({
    queryKey: emailKeys.preview(id),
    queryFn: () => api.get<BroadcastPreview>(`/v1/email/broadcasts/${id}/preview`),
    enabled: enabled && id !== 'new',
    staleTime: 0,
  });
}

export function useEmailSettings() {
  return useQuery({
    queryKey: emailKeys.settings,
    queryFn: () => api.get<EmailSettings>('/v1/email/settings'),
    staleTime: 60_000,
  });
}
