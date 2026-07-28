'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE EMAIL-SEQUENCES DATA LAYER
//
// A sequence is a reusable, ordered list of email STEPS — "welcome them today,
// nudge in two days, offer a hand in a week". People are enrolled (by an
// automation or by hand) and a backend clock sends each step on its own timer.
// A sequence is site-optional, exactly like an automation: propertyId null =
// tenant-wide (every business on the account), set = one business.
//
// This is the ONE door to the /v1/email/sequences API. Every sequence surface —
// the list, the editor, the enrollments view — reads and writes through here, so
// the cache keys and the typed wire shapes live in one place and can never drift.
//
// ── The key contract ──────────────────────────────────────────────────────
//   ['sequences']                             the root every read nests under
//   ['sequences','list',{…}]                  the sequences list window
//   ['sequences','detail', id]                one sequence, in full
//   ['sequences','enrollments', id, {…}]      one sequence's enrolled people
//
// Every write invalidates the ['sequences'] ROOT, so a create, edit, status
// change, delete, enroll or unenroll is reflected across every open surface at
// once.
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import type {
  CreateSequenceInput,
  SequenceStep,
  UpdateSequenceInput,
} from '@sparx/email-sequences/schemas';
import { api } from '../../lib/api/client';

/* ── Semantic tone (shared with the Badge/Button colour axis) ────────────── */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/* ── Wire rows (dates as ISO strings; never the server/prisma types) ─────── */

export type SequenceStatus = 'draft' | 'active' | 'archived';
export type ReentryPolicy = 'once' | 'always';
export type EnrollmentStatus = 'active' | 'completed' | 'exited' | 'cancelled';

/** One sequence, as `GET /v1/email/sequences/:id` returns it. `steps` is the
 *  live authoring document (validated against `@sparx/email-sequences/schemas`
 *  on the server); `counts` is a roll-up of its enrollments by status. */
export interface SequenceRow {
  id: string;
  tenantId: string;
  /** The business this journey belongs to. Null = tenant-wide (every business). */
  propertyId: string | null;
  name: string;
  description: string | null;
  status: SequenceStatus;
  reentryPolicy: ReentryPolicy;
  exitOnPurchase: boolean;
  steps: SequenceStep[];
  createdAt: string;
  updatedAt: string;
  counts: {
    active: number;
    completed: number;
    exited: number;
    cancelled: number;
    total: number;
  };
}

/** One enrolled person, as `GET /v1/email/sequences/:id/enrollments` returns it. */
export interface EnrollmentRow {
  id: string;
  sequenceId: string;
  propertyId: string | null;
  customerId: string | null;
  recipientEmail: string;
  status: EnrollmentStatus;
  /** Zero-based index of the step that runs NEXT (0 = nothing sent yet). */
  currentStep: number;
  nextRunAt: string;
  lastStepAt: string | null;
  enrolledAt: string;
  completedAt: string | null;
  exitedAt: string | null;
  exitReason: string | null;
  sourceAutomationId: string | null;
}

/* ── Filters ────────────────────────────────────────────────────────────── */

export interface SequencesFilter {
  /** draft | active | archived, or 'all'. */
  status?: string;
  /** A site id to narrow to, 'all' for the whole account, or omit for the
   *  active site (the header scopes it). */
  property?: string;
}

export interface EnrollmentsFilter {
  /** active | completed | exited | cancelled, or 'all'. */
  status?: string;
  limit?: number;
}

/* ── Query keys ─────────────────────────────────────────────────────────── */

export const sequenceKeys = {
  all: ['sequences'] as const,
  list: (filter: SequencesFilter) => ['sequences', 'list', filter] as const,
  detail: (id: string) => ['sequences', 'detail', id] as const,
  enrollments: (id: string, filter: EnrollmentsFilter) =>
    ['sequences', 'enrollments', id, filter] as const,
};

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** Every sequence in scope. Called with no argument from the automations action
 *  editor, which just needs the {id, name} of each to build its picker. */
export function useSequences(filter: SequencesFilter = {}) {
  return useQuery({
    queryKey: sequenceKeys.list(filter),
    queryFn: () =>
      api.get<SequenceRow[]>('/v1/email/sequences', {
        ...(filter.status && filter.status !== 'all' ? { status: filter.status } : {}),
        ...(filter.property ? { property: filter.property } : {}),
      }),
    placeholderData: (previous) => previous,
  });
}

export function useSequence(id: string) {
  return useQuery({
    queryKey: sequenceKeys.detail(id),
    queryFn: () => api.get<SequenceRow>(`/v1/email/sequences/${id}`),
    enabled: id !== 'new' && id !== '',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

export function useSequenceEnrollments(id: string, filter: EnrollmentsFilter) {
  return useQuery({
    queryKey: sequenceKeys.enrollments(id, filter),
    queryFn: () =>
      api.get<EnrollmentRow[]>(`/v1/email/sequences/${id}/enrollments`, {
        ...(filter.status && filter.status !== 'all' ? { status: filter.status } : {}),
        ...(filter.limit ? { limit: filter.limit } : {}),
      }),
    enabled: id !== 'new' && id !== '',
    placeholderData: (previous) => previous,
  });
}

/* ── Designed (Builder) emails — the source picker's choices ─────────────── */

/** One designed email a step can send, as `/v1/builder/emails` returns it. Only
 *  the identity a picker needs; the body stays on the server. */
export interface DesignedEmail {
  id: string;
  name: string;
  subject: string;
}

/** The tenant's designed Builder emails, offered as the "pick a designed email"
 *  choice on a step. Fails soft: a tenant without the Builder module gets a 404,
 *  which the editor treats as "no designed emails to pick" and offers the
 *  advanced key path instead. */
export function useBuilderEmails() {
  return useQuery({
    queryKey: ['builder', 'emails'],
    queryFn: () =>
      api.get<{ emails: DesignedEmail[] }>('/v1/builder/emails').then((data) => data.emails),
    staleTime: 60_000,
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status >= 400 && error.status < 500
        ? false
        : failureCount < 2,
  });
}

/* ── Customer search — the "pick a customer" half of manual enrollment ───── */

/** The little a customer picker needs: who they are and where to reach them. */
export interface CustomerLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}

/** A person's display name from whatever identity is present — name, then
 *  company, then email — so a row is never blank. */
export function customerDisplay(customer: CustomerLite): string {
  const name = [customer.firstName, customer.lastName].map((v) => v?.trim()).filter(Boolean);
  if (name.length > 0) return name.join(' ');
  // company, then email — `.find(Boolean)` picks the first non-empty (a trimmed
  // blank must fall through, which `??` would not do).
  return (
    [customer.company, customer.email].map((v) => v?.trim()).find(Boolean) ?? 'Unnamed customer'
  );
}

/** Customers matching a typed query, for the manual-enroll picker. Idle until the
 *  operator types, so opening the enroll form fires nothing. */
export function useCustomerSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['sequences', 'customer-search', q],
    queryFn: () =>
      api.list<CustomerLite>('/v1/crm/customers', { q, take: 20 }).then((r) => r.items),
    enabled: q.length >= 2,
    placeholderData: (previous) => previous,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateSequences() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: sequenceKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: sequenceKeys.detail(id) });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export function useCreateSequence() {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: (input: CreateSequenceInput) => api.post<SequenceRow>('/v1/email/sequences', input),
    onSuccess: (created) => {
      invalidate(created.id);
    },
  });
}

export function useUpdateSequence(id: string) {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: (patch: UpdateSequenceInput) =>
      api.patch<SequenceRow>(`/v1/email/sequences/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export interface DeleteSequenceResult {
  deleted: boolean;
  archived: boolean;
}

export function useDeleteSequence(id: string) {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: () => api.delete<DeleteSequenceResult>(`/v1/email/sequences/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export interface EnrollBody {
  customerId?: string;
  recipientEmail?: string;
}

export interface EnrollResult {
  enrolled: boolean;
  enrollmentId?: string;
  reason?: string;
}

export function useEnrollInSequence(id: string) {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: (body: EnrollBody) =>
      api.post<EnrollResult>(`/v1/email/sequences/${id}/enroll`, body),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export interface UnenrollBody {
  customerId?: string;
  email?: string;
}

export function useUnenrollFromSequence(id: string) {
  const invalidate = useInvalidateSequences();
  return useMutation({
    mutationFn: (body: UnenrollBody) =>
      api.post<{ removed: number }>(`/v1/email/sequences/${id}/unenroll`, body),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/* ── Presentation helpers ───────────────────────────────────────────────── */

/** A sequence's status as a badge tone + a plain-English label. */
export function sequenceState(status: SequenceStatus): { tone: Tone; label: string } {
  switch (status) {
    case 'active':
      return { tone: 'success', label: 'On' };
    case 'archived':
      return { tone: 'neutral', label: 'Stopped' };
    case 'draft':
      return { tone: 'info', label: 'Draft' };
  }
}

/** An enrollment's status as a badge tone + a plain-English label. */
export function enrollmentState(status: EnrollmentStatus): { tone: Tone; label: string } {
  switch (status) {
    case 'active':
      return { tone: 'info', label: 'In progress' };
    case 'completed':
      return { tone: 'success', label: 'Finished' };
    case 'exited':
      return { tone: 'warning', label: 'Left early' };
    case 'cancelled':
      return { tone: 'neutral', label: 'Cancelled' };
  }
}

/** Why an enroll was refused, in words the operator understands. */
export function enrollReasonText(reason: string | undefined): string {
  switch (reason) {
    case 'sequence_inactive':
      return 'Turn the sequence on first — it only enrols people while it is on.';
    case 'no_steps':
      return 'This sequence has no steps yet, so there is nothing to send.';
    case 'no_recipient':
      return 'That person has no email address on file.';
    case 'do_not_contact':
      return 'That address is on your “do not email” list.';
    case 'already_enrolled':
      return 'That person has already been through this sequence.';
    case 'already_active':
      return 'That person is already partway through this sequence.';
    case 'sequence_not_found':
      return 'This sequence could not be found.';
    default:
      return 'Nobody was added.';
  }
}

const DAY = 86_400;
const HOUR = 3_600;
const MINUTE = 60;

/** Break a delay in seconds into whole days / hours / minutes for the editor. */
export function splitDuration(seconds: number): { days: number; hours: number; minutes: number } {
  const safe = Math.max(0, Math.floor(seconds));
  return {
    days: Math.floor(safe / DAY),
    hours: Math.floor((safe % DAY) / HOUR),
    minutes: Math.floor((safe % HOUR) / MINUTE),
  };
}

/** Recombine days / hours / minutes into a delay in seconds. */
export function joinDuration(parts: { days: number; hours: number; minutes: number }): number {
  return parts.days * DAY + parts.hours * HOUR + parts.minutes * MINUTE;
}

/** A delay in plain words — "Send straight away" for zero, else "Wait 2 days,
 *  3 hours". Used on the step cards and the read-only summary. */
export function formatDelay(seconds: number): string {
  if (seconds <= 0) return 'Send straight away';
  const { days, hours, minutes } = splitDuration(seconds);
  const bits: string[] = [];
  if (days > 0) bits.push(`${String(days)} ${days === 1 ? 'day' : 'days'}`);
  if (hours > 0) bits.push(`${String(hours)} ${hours === 1 ? 'hour' : 'hours'}`);
  if (minutes > 0) bits.push(`${String(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}`);
  return `Wait ${bits.join(', ')}`;
}

/* ── Errors ─────────────────────────────────────────────────────────────── */

/** Surface the server's own sentence for a 4xx — it names the exact problem —
 *  else a plain fallback. */
export function sequenceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
