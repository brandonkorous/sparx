// Service requests + the promises made about them (docs/144 §7).
//
// A ticket carries NO status field, here or in the database. Its state is the
// pipeline stage it sits on — see `MoveTicketStageInput` — because "New →
// Waiting on us → Waiting on them → Resolved" is a process a business owns
// rather than a vocabulary the platform hands them.

import { z } from 'zod';

import { OptionalUuid, TagList, TagListPatch, TicketPriority, TicketSource, Uuid } from './common';

// ─────────────────────────────────────────────────────────────────────────
// Business hours
// ─────────────────────────────────────────────────────────────────────────

const MINUTES_PER_DAY = 1440;

/**
 * One open window in the weekly pattern, in the policy's own timezone.
 *
 * Minutes from local midnight rather than "09:00" strings: the SLA arithmetic
 * adds and subtracts these, and a format that has to be parsed before it can be
 * added is a format that will eventually be parsed two different ways.
 *
 * `endMinute` is EXCLUSIVE and may equal 1440 — a desk open until midnight is a
 * real thing, and 1439 would quietly drop a minute a day.
 */
export const BusinessHourWindow = z
  .object({
    /** 0 = Sunday, matching Date#getUTCDay and the scheduling module. */
    day: z.number().int().min(0).max(6),
    startMinute: z
      .number()
      .int()
      .min(0)
      .max(MINUTES_PER_DAY - 1),
    endMinute: z.number().int().min(1).max(MINUTES_PER_DAY),
  })
  .refine((w) => w.endMinute > w.startMinute, {
    message: 'A window must end after it starts. Use two windows to span midnight.',
    path: ['endMinute'],
  });
export type BusinessHourWindow = z.infer<typeof BusinessHourWindow>;

/**
 * The whole weekly pattern.
 *
 * An EMPTY array means 24/7 — the honest reading of "this business declared no
 * hours" when the promise is about response time. Overlapping windows on one
 * day are rejected rather than merged: a business that entered 9–5 twice has
 * made a mistake, and silently accepting it would double-count the day in every
 * calculation that follows.
 */
export const BusinessHours = z
  .array(BusinessHourWindow)
  .max(21)
  .superRefine((windows, ctx) => {
    for (let day = 0; day <= 6; day++) {
      const onDay = windows
        .filter((w) => w.day === day)
        .sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 1; i < onDay.length; i++) {
        const previous = onDay[i - 1];
        const current = onDay[i];
        if (!previous || !current) continue;
        if (current.startMinute < previous.endMinute) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Two opening hours on day ${String(day)} overlap. Combine them into one window.`,
          });
          return;
        }
      }
    }
  });
export type BusinessHours = z.infer<typeof BusinessHours>;

/**
 * IANA zone name, checked against the runtime's own tz database rather than a
 * regex. A regex accepts `America/Nowhere`, which then throws inside the SLA
 * arithmetic at ticket-creation time — far away from the person who typed it.
 */
export const Timezone = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Not a recognised timezone name (for example: America/Denver).' }
  );

// ─────────────────────────────────────────────────────────────────────────
// SLA policies
// ─────────────────────────────────────────────────────────────────────────

/** Per-priority promise. Both halves optional — "no promise on low priority"
 *  is a real answer, and is expressed by leaving both empty. */
export const SlaTargetInput = z.object({
  priority: TicketPriority,
  /** BUSINESS minutes. 60 on a desk open 9–5 means mail arriving at 4:45pm is
   *  due at 9:45 the next morning. Capped at a year of them so a typo in a form
   *  cannot produce a due date in the next century. */
  firstResponseMinutes: z.number().int().min(1).max(525_600).nullable().optional(),
  resolutionMinutes: z.number().int().min(1).max(525_600).nullable().optional(),
});
export type SlaTargetInput = z.infer<typeof SlaTargetInput>;

export const CreateSlaPolicyInput = z.object({
  propertyId: OptionalUuid,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  isDefault: z.boolean().default(false),
  timezone: Timezone.default('UTC'),
  businessHours: BusinessHours.default([]),
  /** Whole local days the desk is shut. `YYYY-MM-DD` — a holiday is a day, not
   *  an instant, and giving it a time would make it land differently per zone. */
  holidays: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'))
    .max(60)
    .default([]),
  warnAtPercent: z.number().int().min(1).max(99).default(80),
  /** The targets, replaced as a set. A priority absent from the list has no
   *  promise attached to it. */
  targets: z.array(SlaTargetInput).max(4).default([]),
});
export type CreateSlaPolicyInput = z.infer<typeof CreateSlaPolicyInput>;

// Every default re-declared without its default, for the reason spelled out on
// UpdatePipelineInput: a `.default()` survives `.partial()`, so a patch that
// only renamed a policy would also reset its timezone to UTC, wipe its business
// hours, and delete every target on it.
export const UpdateSlaPolicyInput = CreateSlaPolicyInput.extend({
  isDefault: z.boolean(),
  timezone: Timezone,
  businessHours: BusinessHours,
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')).max(60),
  warnAtPercent: z.number().int().min(1).max(99),
  targets: z.array(SlaTargetInput).max(4),
}).partial();
export type UpdateSlaPolicyInput = z.infer<typeof UpdateSlaPolicyInput>;

// ─────────────────────────────────────────────────────────────────────────
// Tickets
// ─────────────────────────────────────────────────────────────────────────

export const CreateTicketInput = z.object({
  propertyId: OptionalUuid,
  /** Both optional: a request may come from a person we know, a trade account,
   *  or an address we have never seen. */
  customerId: OptionalUuid,
  b2bAccountId: OptionalUuid,
  assignedToUserId: OptionalUuid,

  subject: z.string().min(1).max(255),
  description: z.string().max(20_000).nullable().optional(),
  priority: TicketPriority.default('medium'),
  source: TicketSource.default('manual'),
  /** The id of the chat conversation / form submission / message that raised
   *  it. Makes the intake idempotent — see the partial unique index. */
  sourceRecordId: z.string().min(1).max(64).nullable().optional(),

  /** Omitted means the tenant's default `ticket` pipeline, opened on its first
   *  stage. A support queue should not have to name its own pipeline to file
   *  the first request. */
  pipelineId: OptionalUuid,
  stageId: OptionalUuid,

  /** Omitted means the default policy for the site. Explicit null means NO
   *  promise on this one, which is different and has to stay expressible. */
  slaPolicyId: OptionalUuid,

  tags: TagList,
  customProperties: z.record(z.string(), z.unknown()).default({}),
});
export type CreateTicketInput = z.infer<typeof CreateTicketInput>;

/**
 * A patch.
 *
 * `stageId` is absent on purpose — moving a ticket through its process is
 * `MoveTicketStageInput`, because that transition also sets `resolvedAt` /
 * `closedAt` and writes a timeline entry. A plain field write would move the
 * ticket and leave both of those wrong.
 *
 * `priority` IS here, and changing it recomputes the due dates: the promise
 * attached to an urgent request is not the one attached to a low one, and a
 * ticket re-prioritised an hour in should be measured against what it is now.
 */
export const UpdateTicketInput = CreateTicketInput.omit({
  source: true,
  sourceRecordId: true,
  pipelineId: true,
  stageId: true,
})
  .extend({
    priority: TicketPriority,
    tags: TagListPatch,
    customProperties: z.record(z.string(), z.unknown()),
  })
  .partial();
export type UpdateTicketInput = z.infer<typeof UpdateTicketInput>;

export const MoveTicketStageInput = z.object({
  toStageId: Uuid,
  /** Why it was resolved or closed, recorded on the timeline entry. Free text —
   *  a reason code list is a thing every business wants different. */
  note: z.string().max(2000).optional(),
});
export type MoveTicketStageInput = z.infer<typeof MoveTicketStageInput>;

export const AssignTicketInput = z.object({
  /** Explicit null unassigns — putting a request back in the queue is a real
   *  action and must not require a different endpoint. */
  assignedToUserId: Uuid.nullable(),
});
export type AssignTicketInput = z.infer<typeof AssignTicketInput>;

/** Filters for the list. Every one of these is a question a support lead asks
 *  first thing in the morning, which is why `breached` and `dueWithinMinutes`
 *  are server-side rather than something the client filters after the fact. */
export const TicketQuery = z.object({
  q: z.string().max(255).optional(),
  pipelineId: Uuid.optional(),
  stageId: Uuid.optional(),
  /** `open` excludes everything on a resolved/closed stage; `all` includes it.
   *  The default is `open`, because a support queue is by definition the things
   *  still owed an answer. */
  state: z.enum(['open', 'resolved', 'closed', 'all']).default('open'),
  priority: TicketPriority.optional(),
  source: TicketSource.optional(),
  customerId: Uuid.optional(),
  b2bAccountId: Uuid.optional(),
  assignedToUserId: Uuid.optional(),
  /** `unassigned` is not expressible as an id, and it is the single most
   *  important queue on the screen. */
  unassigned: z.boolean().optional(),
  /** Only tickets that have already missed something. */
  breached: z.boolean().optional(),
  /** Only tickets whose next promise falls due inside this many minutes. */
  dueWithinMinutes: z.number().int().min(1).max(43_200).optional(),
  tags: z.array(z.string().max(63)).max(20).optional(),
  sort: z
    .enum(['created_desc', 'created_asc', 'updated_desc', 'due_asc', 'priority_desc'])
    .default('due_asc'),
  take: z.number().int().min(1).max(250).default(50),
  skip: z.number().int().min(0).default(0),
});
export type TicketQuery = z.infer<typeof TicketQuery>;
