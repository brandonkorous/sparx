'use client';

// ══════════════════════════════════════════════════════════════════════════
// THE CUSTOMER ACTIVITY FEED (read side)
//
// The CRM keeps an append-only event log — notes, calls, meetings, and the
// business events that touch a person (an order placed, an email opened). This
// is the customer's TIMELINE, read from `GET /v1/crm/activities?customer_id=`.
//
// It is deliberately NOT the account-wide audit log (`lib/api/activity.ts`),
// which filters by ACTOR — who did something — not by the customer a thing was
// done ABOUT. Two different questions, two different endpoints.
//
// Read-only here: the log is append-only and recorded by the services that own
// each event (checkout records `order.placed`, email records `email.opened`).
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from '../../lib/api/client';

/** One row of the timeline. Mirrors the serialized Prisma `CrmActivity` the CRM
 *  returns — only the fields this surface reads are named, so a wider row can
 *  never quietly become a dependency. */
export interface CustomerActivity {
  id: string;
  type: string;
  description: string | null;
  /** staff · customer · system · api · mcp — who or what caused it. */
  actorType: string;
  actorId: string | null;
  /** ISO string. The real event time, which is what the timeline orders by. */
  occurredAt: string;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
}

export const customerActivityKeys = {
  all: ['crm', 'customer-activity'] as const,
  feed: (customerId: string, limit: number) =>
    [...customerActivityKeys.all, customerId, limit] as const,
};

export function useCustomerActivities(customerId: string, limit = 50) {
  return useQuery({
    queryKey: customerActivityKeys.feed(customerId, limit),
    queryFn: () =>
      api.get<CustomerActivity[]>('/v1/crm/activities', {
        customer_id: customerId,
        limit,
      }),
    enabled: customerId !== 'new',
  });
}

/* ── Logging a note / call / meeting ────────────────────────────────────── */

// The activity types a person LOGS by hand. The rest of the enum (order.placed,
// email.opened, task.completed…) is written by the services that own those
// events, never typed in here — so the composer only ever offers these three.
export const LOGGABLE_ACTIVITY_TYPES: { value: 'note' | 'call' | 'meeting'; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Phone call' },
  { value: 'meeting', label: 'Meeting' },
];

export interface RecordActivityInput {
  type: 'note' | 'call' | 'meeting';
  description?: string;
}

export function useRecordActivity(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordActivityInput) =>
      api.post<CustomerActivity>('/v1/crm/activities', {
        type: input.type,
        description: input.description?.trim() ? input.description.trim() : null,
        customerId,
        // A staff member typed this — the server stamps the actor id from the
        // session, so we only declare the KIND of actor.
        actorType: 'staff',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: customerActivityKeys.all });
    },
  });
}

/* ── Presentation ───────────────────────────────────────────────────────── */

/** A human label for an activity `type`. Types are open-ended strings (`note`,
 *  `call`, `order.placed`, `email.opened`…), so this humanises generically —
 *  drop the namespace, swap separators for spaces, capitalise — rather than
 *  enumerating a set that the server is free to grow. A few common ones get a
 *  hand-written label where the generic version reads awkwardly. */
export function activityTypeLabel(type: string): string {
  const known: Record<string, string> = {
    note: 'Note',
    call: 'Phone call',
    meeting: 'Meeting',
    email: 'Email',
    file: 'File',
    'order.placed': 'Order placed',
    'order.paid': 'Order paid',
    'order.fulfilled': 'Order fulfilled',
    'order.refunded': 'Order refunded',
    'email.opened': 'Email opened',
    'email.clicked': 'Email clicked',
  };
  if (known[type]) return known[type];
  const last = type.includes('.') ? type.slice(type.indexOf('.') + 1) : type;
  const words = last.replace(/[_-]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The tone an activity dot wears. Activities split into two families, and the
 * color says which: things a PERSON logged (note/call/meeting) read as the CRM
 * hue (`module`), and things the SYSTEM recorded (orders, emails) read neutral —
 * they are facts, not outreach. A refund is the one that earns a warning, since
 * it is money going back out.
 */
export function activityTone(type: string, actorType: string): 'module' | 'neutral' | 'warning' {
  if (type.includes('refund')) return 'warning';
  if (actorType === 'staff' || type === 'note' || type === 'call' || type === 'meeting') {
    return 'module';
  }
  return 'neutral';
}
