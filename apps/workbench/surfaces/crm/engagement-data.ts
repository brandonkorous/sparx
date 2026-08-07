'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE ENGAGEMENT DATA LAYER (docs/144 §5)
//
// What was SAID, as opposed to what the platform DID. A record can already show
// that an order shipped; this is the layer that lets it show that the rep
// emailed on Tuesday and the customer replied on Wednesday asking for a
// discount — which is the actual relationship.
//
//   ['crm','engagement','threads',{…}]      conversations on a record
//   ['crm','engagement','mailboxes']        what this person may send from
//   ['crm','engagement','templates',{…}]    reusable emails
//   ['crm','engagement','snippets']         reusable paragraphs
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type EngagementKind = 'email' | 'call' | 'note' | 'meeting';
export type CallOutcome = 'connected' | 'no_answer' | 'voicemail' | 'busy' | 'wrong_number';

export interface EngagementMessage {
  id: string;
  kind: EngagementKind;
  direction: 'in' | 'out';
  fromAddress: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  bodyHtml: string | null;
  bodyText: string | null;
  sentAt: string;
  sentByUserId: string | null;
  firstOpenedAt: string | null;
  openCount: number;
  clickCount: number;
  durationSec: number | null;
  outcome: CallOutcome | null;
}

export interface EngagementThread {
  id: string;
  subject: string | null;
  customerId: string | null;
  dealId: string | null;
  ticketId: string | null;
  status: string;
  lastMessageAt: string;
  messageCount: number;
  messages: EngagementMessage[];
}

export interface Mailbox {
  id: string;
  provider: string;
  scope: string;
  emailAddress: string;
  displayName: string | null;
  status: string;
  /** The promise the connect flow made, readable afterwards. */
  syncGate: 'known_contacts_only' | 'everything';
}

export interface SalesTemplate {
  id: string;
  name: string;
  folder: string | null;
  subject: string;
  bodyHtml: string;
  isShared: boolean;
  sendCount: number;
  openCount: number;
  replyCount: number;
}

export interface SalesSnippet {
  id: string;
  shortcut: string;
  name: string;
  body: string;
}

export const engagementKeys = {
  all: ['crm', 'engagement'] as const,
  threads: (params: Record<string, unknown>) => [...engagementKeys.all, 'threads', params] as const,
  mailboxes: () => [...engagementKeys.all, 'mailboxes'] as const,
  templates: (params: Record<string, unknown> = {}) =>
    [...engagementKeys.all, 'templates', params] as const,
  snippets: () => [...engagementKeys.all, 'snippets'] as const,
};

/* ── Presentation ───────────────────────────────────────────────────────── */

/** What each kind of thing is called, in the words someone would say. */
export const KIND_LABELS: Record<EngagementKind, string> = {
  email: 'Email',
  call: 'Call',
  note: 'Note',
  meeting: 'Meeting',
};

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  connected: 'Talked to them',
  no_answer: 'No answer',
  voicemail: 'Left a voicemail',
  busy: 'Line was busy',
  wrong_number: 'Wrong number',
};

/**
 * The colour a message wears — by WHAT HAPPENED, never decoration.
 *
 * A reply from the customer is the single strongest signal in a pipeline, so it
 * is the one that gets a real hue; our own outbound is chassis-neutral because
 * it is the common case, and a wall of colour would drown the reply.
 */
export function toneFor(message: EngagementMessage): string {
  if (message.kind === 'call') return message.outcome === 'connected' ? 'success' : 'warning';
  if (message.kind === 'note') return 'neutral';
  return message.direction === 'in' ? 'success' : 'module';
}

/** How long a call was, as someone would say it. */
export function describeDuration(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  if (seconds < 60) return `${String(seconds)} seconds`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? 'a minute' : `${String(minutes)} minutes`;
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useEngagementThreads(params: {
  customerId?: string;
  dealId?: string;
  ticketId?: string;
}) {
  const enabled = Boolean(params.customerId ?? params.dealId ?? params.ticketId);
  return useQuery({
    queryKey: engagementKeys.threads(params),
    queryFn: () =>
      api.list<EngagementThread>('/v1/crm/engagement/threads', {
        ...(params.customerId ? { customer_id: params.customerId } : {}),
        ...(params.dealId ? { deal_id: params.dealId } : {}),
        ...(params.ticketId ? { ticket_id: params.ticketId } : {}),
      }),
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Only what THIS person may send from — their own mailbox plus the shared ones.
 *  Enforced server-side; the picker just reflects it. */
export function useSendableMailboxes() {
  return useQuery({
    queryKey: engagementKeys.mailboxes(),
    queryFn: () => api.list<Mailbox>('/v1/crm/mailboxes/sendable'),
    staleTime: 5 * 60_000,
  });
}

export function useSalesTemplates(params: { folder?: string } = {}) {
  return useQuery({
    queryKey: engagementKeys.templates(params),
    queryFn: () =>
      api.list<SalesTemplate>('/v1/crm/sales-templates', {
        ...(params.folder ? { folder: params.folder } : {}),
      }),
    staleTime: 60_000,
  });
}

export function useSalesSnippets() {
  return useQuery({
    queryKey: engagementKeys.snippets(),
    queryFn: () => api.list<SalesSnippet>('/v1/crm/sales-snippets'),
    staleTime: 5 * 60_000,
  });
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

/**
 * Anything said about a record invalidates BOTH the conversations and the
 * activity timeline — every message also writes an activity row, so a composer
 * that refreshed only its own list would leave the timeline below it stale.
 */
function useInvalidateEngagement() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: engagementKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['crm', 'activities'] });
    void queryClient.invalidateQueries({ queryKey: ['crm', 'customers'] });
  };
}

export interface SendEmailInput {
  customerId: string;
  dealId?: string | null;
  ticketId?: string | null;
  threadId?: string | null;
  subject: string;
  bodyHtml: string;
  cc?: string[];
  mailboxConnectionId?: string | null;
  templateId?: string | null;
}

export function useSendEngagementEmail() {
  const invalidate = useInvalidateEngagement();
  return useMutation({
    mutationFn: (input: SendEmailInput) => api.post('/v1/crm/engagement/emails', input),
    onSuccess: invalidate,
  });
}

export interface LogCallInput {
  customerId: string;
  dealId?: string | null;
  direction: 'in' | 'out';
  outcome: CallOutcome;
  durationSec?: number;
  notes?: string;
}

export function useLogCall() {
  const invalidate = useInvalidateEngagement();
  return useMutation({
    mutationFn: (input: LogCallInput) => api.post('/v1/crm/engagement/calls', input),
    onSuccess: invalidate,
  });
}

export function useLogNote() {
  const invalidate = useInvalidateEngagement();
  return useMutation({
    mutationFn: (input: { customerId: string; dealId?: string | null; body: string }) =>
      api.post('/v1/crm/engagement/notes', input),
    onSuccess: invalidate,
  });
}

export function engagementErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
