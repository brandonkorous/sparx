'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE SUPPORT QUEUE DATA LAYER (docs/144 §7)
//
// A request is something a customer asked for that somebody still owes them an
// answer on. It has no status field: its state is the stage it sits on, which
// is why moving it has its own mutation — that endpoint also stamps resolved /
// closed, writes the timeline entry, and fires the event the business's own
// rules hang off.
//
// THE CLOCK COMES DOWN WITH THE ROW, ALREADY WORKED OUT. The server sends a
// `firstResponse` and a `resolution` view per request, each already knowing
// whether it is fine, running short, or missed — because "80% of four working
// hours" is business-hours arithmetic over a calendar with holidays in it, and
// the browser has no business re-deriving that from a due date.
//
//   ['crm','tickets']              root
//   ['crm','tickets','list',{…}]   one queue window
//   ['crm','tickets', id]          one request, in full
//   ['crm','sla-policies']         what the business promised
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ApiError } from '@sparx/api-client';
import { api } from '../../lib/api/client';
import { pipelineKeys, type StageType } from './pipelines-data';

/* ── Shapes ─────────────────────────────────────────────────────────────── */

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketSource = 'chat' | 'email' | 'form' | 'phone' | 'manual' | 'api';

/** What one promise currently says. Mirrors `SlaClockView` in @sparx/crm. */
export interface SlaClock {
  state: 'none' | 'ok' | 'warning' | 'breached' | 'met';
  dueAt: string | null;
  minutesRemaining: number | null;
}

export interface Ticket {
  id: string;
  number: number;
  pipelineId: string;
  stageId: string;
  customerId: string | null;
  companyId: string | null;
  assignedToUserId: string | null;
  subject: string;
  description: string | null;
  priority: TicketPriority;
  source: TicketSource;
  sourceRecordId: string | null;
  tags: string[];
  customProperties: Record<string, unknown>;
  slaPolicyId: string | null;
  firstResponseDueAt: string | null;
  firstRespondedAt: string | null;
  resolutionDueAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stage: { id: string; name: string; stageType: StageType; color: string | null } | null;
  pipeline: { id: string; name: string } | null;
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    email: string | null;
  } | null;
  company: { id: string; name: string } | null;
  assignedTo: { id: string; name: string | null; email: string | null } | null;
}

/** One row of the queue: the request plus both of its clocks. */
export interface TicketView {
  ticket: Ticket;
  firstResponse: SlaClock;
  resolution: SlaClock;
}

export interface SlaTarget {
  id: string;
  priority: TicketPriority;
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
}

export interface SlaPolicy {
  id: string;
  propertyId: string | null;
  name: string;
  description: string | null;
  isDefault: boolean;
  timezone: string;
  businessHours: { day: number; startMinute: number; endMinute: number }[];
  holidays: string[];
  warnAtPercent: number;
  archivedAt: string | null;
  targets: SlaTarget[];
}

export interface TicketListParams {
  q?: string;
  state?: 'open' | 'resolved' | 'closed' | 'all';
  priority?: TicketPriority;
  source?: TicketSource;
  customerId?: string;
  assignedToUserId?: string;
  unassigned?: boolean;
  breached?: boolean;
  stageId?: string;
  sort?: 'created_desc' | 'created_asc' | 'updated_desc' | 'due_asc' | 'priority_desc';
  take?: number;
}

export const ticketKeys = {
  all: ['crm', 'tickets'] as const,
  list: (params: TicketListParams) => [...ticketKeys.all, 'list', params] as const,
  detail: (id: string) => [...ticketKeys.all, id] as const,
  policies: ['crm', 'sla-policies'] as const,
};

/* ── Presentation ───────────────────────────────────────────────────────── */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/**
 * The colour a clock wears.
 *
 * This is the whole reason the queue is readable across a room (RULE #4): a
 * breached promise is danger, one running short is amber, one that was kept is
 * success. `ok` deliberately returns neutral rather than success — a request
 * that is merely on track is the normal case, and painting every normal row
 * green would leave nothing for the ones that need a person.
 */
export function slaTone(state: SlaClock['state']): Tone {
  switch (state) {
    case 'breached':
      return 'danger';
    case 'warning':
      return 'warning';
    case 'met':
      return 'success';
    default:
      return 'neutral';
  }
}

/**
 * Urgency as a colour, so the level does not have to be read.
 *
 * Four levels, four distinct hues, and `low` is the ONLY neutral one — it is
 * genuinely the absence of urgency, which is the earned kind of neutral.
 */
export function priorityTone(priority: TicketPriority): Tone {
  switch (priority) {
    case 'urgent':
      return 'danger';
    case 'high':
      return 'warning';
    case 'medium':
      return 'info';
    case 'low':
      return 'neutral';
  }
}

/** Where the request came in from, in words a person uses. */
export function sourceLabel(source: TicketSource): string {
  switch (source) {
    case 'chat':
      return 'Live chat';
    case 'email':
      return 'Email';
    case 'form':
      return 'Website form';
    case 'phone':
      return 'Phone';
    case 'manual':
      return 'Added by hand';
    case 'api':
      return 'Another system';
  }
}

export function priorityLabel(priority: TicketPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

/**
 * How much time is left, said the way a person would say it.
 *
 * Rounded to the unit that matters and never more precise than that — "2 days
 * left" is what somebody needs; "2 days, 4 hours and 11 minutes left" is a
 * number they have to read twice and still act on identically.
 */
export function remainingLabel(minutes: number | null): string | null {
  if (minutes === null) return null;
  const late = minutes < 0;
  const n = Math.abs(minutes);
  let amount: string;
  if (n < 1) amount = 'less than a minute';
  else if (n < 60) amount = `${String(Math.round(n))} min`;
  else if (n < 60 * 24) amount = `${String(Math.round(n / 60))} hr`;
  else amount = `${String(Math.round(n / (60 * 24)))} days`;
  return late ? `${amount} late` : `${amount} left`;
}

/**
 * The one thing worth saying about a request's clocks at a glance, or nothing.
 *
 * AT MOST ONE SIGNAL, and the worse of the two: a row that badges both promises
 * badges neither, and a request that has already missed its reply deadline does
 * not need to also be told its resolution is coming up. Returns null when
 * everything is fine or nothing was promised — a queue where every row carries
 * a badge has no signal left to give.
 */
export function ticketSignal(
  view: TicketView
): { label: string; tone: Tone; detail: string } | null {
  const candidates: { clock: SlaClock; noun: string }[] = [
    { clock: view.firstResponse, noun: 'reply' },
    { clock: view.resolution, noun: 'resolution' },
  ];
  const breached = candidates.find((c) => c.clock.state === 'breached');
  if (breached) {
    return {
      label: breached.noun === 'reply' ? 'No reply yet' : 'Overdue',
      tone: 'danger',
      detail:
        breached.noun === 'reply'
          ? 'This went past the time the business promised to reply in, and nobody has answered yet.'
          : 'This went past the time the business promised to have it sorted by.',
    };
  }
  const warning = candidates.find((c) => c.clock.state === 'warning');
  if (warning) {
    return {
      label: remainingLabel(warning.clock.minutesRemaining) ?? 'Running short',
      tone: 'warning',
      detail: `The promised ${warning.noun} time is nearly up.`,
    };
  }
  return null;
}

/** Business hours in the words a person would use to describe them. Empty means
 *  the desk never closes, which is a real answer and worth saying out loud. */
export function describeHours(policy: Pick<SlaPolicy, 'businessHours' | 'timezone'>): string {
  if (policy.businessHours.length === 0) return `Open at all hours (${policy.timezone})`;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const open = [...policy.businessHours]
    .sort((a, b) => a.day - b.day || a.startMinute - b.startMinute)
    .map((w) => `${days[w.day] ?? '?'} ${hhmm(w.startMinute)}–${hhmm(w.endMinute)}`);
  return `${open.join(', ')} (${policy.timezone})`;
}

/** "4 hr", "2 days" — a target, in the unit it was probably meant in. Null means
 *  the business made no promise at this level, which is different from zero. */
export function targetLabel(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes < 60) return `${String(minutes)} min`;
  if (minutes < 60 * 24) return `${String(Math.round(minutes / 60))} hr`;
  return `${String(Math.round(minutes / (60 * 8)))} working days`;
}

/* ── Queries ────────────────────────────────────────────────────────────── */

export function useTickets(params: TicketListParams) {
  return useQuery({
    queryKey: ticketKeys.list(params),
    queryFn: () =>
      api.list<TicketView>('/v1/crm/tickets', {
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
        ...(params.state ? { state: params.state } : {}),
        ...(params.priority ? { priority: params.priority } : {}),
        ...(params.source ? { source: params.source } : {}),
        ...(params.customerId ? { customer_id: params.customerId } : {}),
        ...(params.assignedToUserId ? { assigned_to: params.assignedToUserId } : {}),
        // Sent as the literal strings the route expects — `false` would read as
        // "filter to the ones that are NOT unassigned", which is not what an
        // unchecked box means.
        ...(params.unassigned ? { unassigned: 'true' } : {}),
        ...(params.breached ? { breached: 'true' } : {}),
        ...(params.stageId ? { stage_id: params.stageId } : {}),
        ...(params.sort ? { sort: params.sort } : {}),
        take: params.take ?? 100,
      }),
    placeholderData: (previous) => previous,
    // The clocks are computed server-side from "now", so a queue left open on a
    // screen goes stale in a way a list of customers does not. A minute is short
    // enough that an amber row appears while somebody could still act on it.
    refetchInterval: 60_000,
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: () => api.get<TicketView>(`/v1/crm/tickets/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

export function useSlaPolicies() {
  return useQuery({
    queryKey: ticketKeys.policies,
    queryFn: () => api.list<SlaPolicy>('/v1/crm/sla-policies'),
    staleTime: 5 * 60_000,
  });
}

/* ── Invalidation ───────────────────────────────────────────────────────── */

export function useInvalidateTickets() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: ticketKeys.detail(id) });
    // A request's timeline and the customer's are the same timeline (docs/144
    // §5.5), so anything that moves one moves the other.
    void queryClient.invalidateQueries({ queryKey: ['crm', 'activities'] });

    // THE FIRST REQUEST A TENANT EVER FILES BUILDS THE SUPPORT SURFACE AROUND
    // ITSELF. Opening it runs `ensureTicketPipeline` and `ensureDefaultPolicy`
    // server-side, so a pipeline and a promise that did not exist when this pane
    // mounted exist by the time it returns. Both were fetched BEFORE that and
    // cached empty, and neither sits under `ticketKeys.all` — `policies` is
    // ['crm','sla-policies'] and pipelines are ['crm','pipelines'], so the
    // invalidation above misses both.
    //
    // Left stale, the very first request in a tenant renders a DISABLED stage
    // picker labelled with a raw uuid (no stages to offer, so the Select falls
    // back to the value) beside a panel stating no response promise is attached
    // — while the row in the database has both. It comes right on reload, which
    // nobody thinks to do, and it lands on the one request that is somebody's
    // first impression of the whole surface.
    void queryClient.invalidateQueries({ queryKey: ticketKeys.policies });
    void queryClient.invalidateQueries({ queryKey: pipelineKeys.all });
  };
}

/* ── Mutations ──────────────────────────────────────────────────────────── */

export interface TicketInput {
  subject: string;
  description?: string | null;
  priority?: TicketPriority;
  source?: TicketSource;
  customerId?: string | null;
  companyId?: string | null;
  assignedToUserId?: string | null;
  pipelineId?: string | null;
  stageId?: string | null;
  slaPolicyId?: string | null;
  tags?: string[];
  customProperties?: Record<string, unknown>;
}

export function useCreateTicket() {
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: (input: TicketInput) => api.post<TicketView>('/v1/crm/tickets', input),
    onSuccess: (created) => {
      invalidate(created.ticket.id);
    },
  });
}

export function useUpdateTicket(id: string) {
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: (patch: Partial<TicketInput>) =>
      api.patch<TicketView>(`/v1/crm/tickets/${id}`, patch),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

/** Move a request along its process. Its own endpoint, not a field on the patch:
 *  the transition stamps resolved/closed, writes the timeline entry, and emits
 *  the event a tenant's own rules fire on. */
export function useMoveTicketStage(id: string) {
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: (input: { toStageId: string; note?: string }) =>
      api.post<TicketView>(`/v1/crm/tickets/${id}/stage`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useAssignTicket(id: string) {
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: (assignedToUserId: string | null) =>
      api.post<TicketView>(`/v1/crm/tickets/${id}/assign`, { assignedToUserId }),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteTicket(id: string) {
  const invalidate = useInvalidateTickets();
  return useMutation({
    mutationFn: () => api.delete(`/v1/crm/tickets/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export function ticketErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}
