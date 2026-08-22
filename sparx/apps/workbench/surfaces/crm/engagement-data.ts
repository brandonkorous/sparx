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

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { apiErrorMessage } from '../../lib/api-error';
import { api } from '../../lib/api/client';
// Imported so the invalidation below cannot drift from the keys it is meant to
// clear — see `useInvalidateEngagement`.
import { customerActivityKeys } from './customer-activity-data';
import { callKeys } from './calls-data';

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
  /** Put away rather than deleted — the counters are the only record of what a
   *  business learned about its own messaging. */
  archivedAt: string | null;
}

export interface SalesSnippet {
  id: string;
  shortcut: string;
  name: string;
  body: string;
  isShared: boolean;
  useCount: number;
}

/** How a template is doing, as rates rather than raw counts. Both rates are null
 *  below the server's floor — one send and one reply is not a 100% reply rate. */
export interface TemplatePerformance {
  id: string;
  name: string;
  sendCount: number;
  openRate: number | null;
  replyRate: number | null;
}

export const engagementKeys = {
  all: ['crm', 'engagement'] as const,
  threads: (params: Record<string, unknown>) => [...engagementKeys.all, 'threads', params] as const,
  mailboxes: () => [...engagementKeys.all, 'mailboxes'] as const,
  // The prefix is its own entry so an invalidation can clear EVERY folder
  // filter at once. Without it, writing a template refreshes the unfiltered
  // list and leaves whatever the composer fetched with `{folder:'…'}` stale.
  templatesAll: () => [...engagementKeys.all, 'templates'] as const,
  templates: (params: Record<string, unknown> = {}) =>
    [...engagementKeys.templatesAll(), params] as const,
  templatePerformance: () => [...engagementKeys.all, 'template-performance'] as const,
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
 * The color a message wears — by WHAT HAPPENED, never decoration.
 *
 * A reply from the customer is the single strongest signal in a pipeline, so it
 * is the one that gets a real hue; our own outbound is chassis-neutral because
 * it is the common case, and a wall of color would drown the reply.
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

/** A rate as a whole percentage. Null stays null — see `TemplatePerformance`. */
export function formatRate(rate: number | null): string | null {
  if (rate === null) return null;
  return `${String(Math.round(rate * 100))}%`;
}

/**
 * The color a reply rate wears.
 *
 * This is the one column on the templates surface that earns a hue, because it
 * is the only number that changes what somebody DOES — a template nobody
 * answers should be rewritten or retired, and it has to be obvious at a glance
 * which one that is. Sends and opens are context for it, so they stay chassis.
 *
 * The bands are deliberately generous: a cold follow-up answered one time in
 * eight is doing its job, and coloring that red would have people delete the
 * thing that works.
 */
export function replyRateTone(rate: number | null): string {
  if (rate === null) return 'neutral';
  if (rate >= 0.25) return 'success';
  if (rate >= 0.1) return 'module';
  return 'warning';
}

/* ── Shortcuts ──────────────────────────────────────────────────────────── */

/** A shortcut, right at the end of what has been typed so far. The three lead
 *  characters mirror the server's — a shortcut is stored bare, so somebody who
 *  types `;hours` and somebody who types `/hours` reach the same paragraph. */
const SHORTCUT_BEFORE_CARET = /[;:/]([A-Za-z0-9_-]+)$/;

/**
 * The shortcut sitting immediately before the caret, if it names a snippet.
 *
 * THE SHORTCUT HAS TO EXPAND OR IT IS DECORATION. Every snippet in the database
 * carries one, the composer listed them under the message box as though typing
 * one did something, and nothing anywhere expanded anything — so a business
 * that carefully wrote `;hours` got a box that told them about a feature the
 * product did not have.
 *
 * Pure, so the composer can stay about typing: hand it the text and the caret,
 * get back what the box should say next and which snippet was used.
 */
export function expandShortcutBefore(
  text: string,
  caret: number,
  snippets: SalesSnippet[]
): { text: string; caret: number; snippet: SalesSnippet } | null {
  const before = text.slice(0, caret);
  const match = SHORTCUT_BEFORE_CARET.exec(before);
  const typed = match?.[1]?.toLowerCase();
  if (!match || typed === undefined) return null;

  const snippet = snippets.find((entry) => entry.shortcut.toLowerCase() === typed);
  if (!snippet) return null;

  const start = before.length - match[0].length;
  return {
    text: text.slice(0, start) + snippet.body + text.slice(caret),
    caret: start + snippet.body.length,
    snippet,
  };
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

export function useSalesTemplates(params: { folder?: string; includeArchived?: boolean } = {}) {
  return useQuery({
    queryKey: engagementKeys.templates(params),
    queryFn: () =>
      api.list<SalesTemplate>('/v1/crm/sales-templates', {
        ...(params.folder ? { folder: params.folder } : {}),
        ...(params.includeArchived ? { include_archived: true } : {}),
      }),
    staleTime: 60_000,
  });
}

/**
 * Which templates get answered.
 *
 * A separate call rather than arithmetic over the list, because the FLOOR is a
 * server-side judgement — it decides when a rate is too thin to show at all,
 * and two places computing that would eventually disagree about which template
 * is the good one.
 */
export function useTemplatePerformance() {
  return useQuery({
    queryKey: engagementKeys.templatePerformance(),
    queryFn: () => api.list<TemplatePerformance>('/v1/crm/sales-templates/performance'),
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
 * Anything said about a record invalidates the conversations, the activity
 * timeline AND the call log — every message also writes an activity row, and a
 * logged call writes a call record too, so a composer that refreshed only its
 * own list would leave everything below it stale.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY KEY HERE IS IMPORTED. NONE OF THEM IS TYPED OUT.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * That is the entire point, because this function did exactly what its own
 * comment said it existed to prevent. It invalidated the literal
 * `['crm', 'activities']` while the timeline is keyed on
 * `['crm', 'customer-activity', …]` — a prefix that has never matched anything.
 * So logging a call showed a cheerful "Call logged" toast over a list that still
 * read "No notes yet", and the honest conclusion for the person looking at it is
 * that the call was not saved. They log it again.
 *
 * A hand-typed key is a copy of a fact that lives somewhere else, and it goes
 * stale silently — no type error, no failing test, nothing on screen but an
 * absence. `scoring-data.ts` opens with a warning about this precise trap;
 * it was live here the whole time. Import the owner's `all` prefix and the
 * compiler starts caring.
 */
function useInvalidateEngagement() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: engagementKeys.all });
    void queryClient.invalidateQueries({ queryKey: customerActivityKeys.all });
    void queryClient.invalidateQueries({ queryKey: callKeys.all });
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
  /** The support request this was about (docs/144 §7), so a call logged from a
   *  request lands on the request's own thread rather than only on the person's. */
  ticketId?: string | null;
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
    mutationFn: (input: {
      customerId: string;
      dealId?: string | null;
      ticketId?: string | null;
      body: string;
    }) => api.post('/v1/crm/engagement/notes', input),
    onSuccess: invalidate,
  });
}

/* ── The library: templates and snippets ────────────────────────────────── */

export interface TemplateInput {
  name: string;
  folder: string | null;
  subject: string;
  bodyHtml: string;
  isShared: boolean;
}

export interface SnippetInput {
  shortcut: string;
  name: string;
  body: string;
  isShared: boolean;
}

/**
 * Writing a template touches the picker in every open composer, so the whole
 * template prefix goes — including the folder-filtered copies — and so does the
 * performance table, whose rows are the same rows read another way.
 */
function useInvalidateLibrary() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: engagementKeys.templatesAll() });
    void queryClient.invalidateQueries({ queryKey: engagementKeys.templatePerformance() });
  };
}

export function useSalesTemplateMutations() {
  const invalidate = useInvalidateLibrary();
  return {
    create: useMutation({
      mutationFn: (input: TemplateInput) =>
        api.post<SalesTemplate>('/v1/crm/sales-templates', input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Partial<TemplateInput> }) =>
        api.patch<SalesTemplate>(`/v1/crm/sales-templates/${id}`, patch),
      onSuccess: invalidate,
    }),
    /** Puts it away and keeps its counters — see `SalesTemplate.archivedAt`. */
    archive: useMutation({
      mutationFn: (id: string) => api.delete(`/v1/crm/sales-templates/${id}`),
      onSuccess: invalidate,
    }),
    restore: useMutation({
      mutationFn: (id: string) => api.post<SalesTemplate>(`/v1/crm/sales-templates/${id}/restore`),
      onSuccess: invalidate,
    }),
  };
}

export function useSalesSnippetMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: engagementKeys.snippets() });
  return {
    create: useMutation({
      mutationFn: (input: SnippetInput) => api.post<SalesSnippet>('/v1/crm/sales-snippets', input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      // No shortcut: it is what people type without thinking, and changing it
      // silently breaks that habit everywhere it was already used. The server
      // does not accept one either (`UpdateSnippetInput`).
      mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<SnippetInput, 'shortcut'>> }) =>
        api.patch<SalesSnippet>(`/v1/crm/sales-snippets/${id}`, patch),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/v1/crm/sales-snippets/${id}`),
      onSuccess: invalidate,
    }),
  };
}

/**
 * Count a snippet as used, so the picker can float the ones people reach for.
 *
 * Deliberately silent: the tally is telemetry about a message that has already
 * been typed, so a failure here must never interrupt somebody mid-sentence.
 */
export function useNoteSnippetUsed() {
  return useMutation({
    mutationFn: (id: string) => api.post(`/v1/crm/sales-snippets/${id}/used`),
    onError: () => undefined,
  });
}

export function engagementErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessage(error, fallback);
}
