// Shared primitive schemas reused across the CRM input types.
//
// These are the small leaf shapes that recur: UUIDs, ISO dates, the tag
// array shape, and the activity-actor type enum. Hoisted to one file so a
// rename or constraint change happens in one place.

import { z } from 'zod';

export const Uuid = z.string().uuid();

export const OptionalUuid = z.string().uuid().optional().nullable();

// Tags are stored as text[] in Postgres with VARCHAR(63) per slot; mirror
// the constraint at validation time so we never accept a tag that won't
// fit in the column.
const TagArray = z
  .array(
    z
      .string()
      .min(1)
      .max(63)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Tags must be alphanumeric (plus _ and -)')
  )
  .max(50);

/** Tags on a CREATE — absent means "no tags", so it defaults to `[]`. */
export const TagList = TagArray.default([]);

/**
 * Tags on a PATCH — the SAME validation with the default removed.
 *
 * `TagList.optional()` does not do what it looks like: a `.default()` survives
 * both `.optional()` and `.partial()`, so Zod fabricates `tags: []` for a body
 * that never mentioned tags, and every update service writes the fields that are
 * `!== undefined`. A patch of one unrelated field therefore DELETED every tag on
 * the record. Update schemas must use this, never `TagList`.
 */
export const TagListPatch = TagArray;

// Customer classification is THREE orthogonal axes, not one enum (docs/137,
// modelled on HubSpot). A contact carries one value on each at once.

// Axis 1 — RELATIONSHIP TYPE (`customers.type`): how a contact transacts. The
// load-bearing axis: only `b2b` carries behaviour (trade pricing + A/R), exactly
// as before — the meaning just narrowed from "everything" to "relationship kind".
// `retail` (individual/consumer) is the default; `partner`/`vendor` are label-only.
export const CustomerType = z.enum(['retail', 'b2b', 'partner', 'vendor']);
export type CustomerType = z.infer<typeof CustomerType>;

// Axis 2 — LIFECYCLE STAGE (`customers.lifecycle_stage`): where the contact is in
// the journey. Coarse and mostly auto-advanced (a completed order → `customer`);
// the Deals module carries the fine-grained opportunity/pipeline detail. HubSpot's
// eight defaults, in order.
export const LifecycleStage = z.enum([
  'subscriber',
  'lead',
  'marketing_qualified_lead',
  'sales_qualified_lead',
  'opportunity',
  'customer',
  'evangelist',
  'other',
]);
export type LifecycleStage = z.infer<typeof LifecycleStage>;

// Axis 3 — LEAD STATUS (`customers.lead_status`): the micro work-state, what a rep
// is doing right now. Only meaningful while a lead is being worked, so it is
// NULLABLE — a settled customer clears it.
export const LeadStatus = z.enum([
  'new',
  'open',
  'in_progress',
  'open_deal',
  'unqualified',
  'attempted_to_contact',
  'connected',
  'bad_timing',
]);
export type LeadStatus = z.infer<typeof LeadStatus>;

export const PreferredContactMethod = z.enum(['email', 'phone', 'sms']);
export type PreferredContactMethod = z.infer<typeof PreferredContactMethod>;

export const CompanyStatus = z.enum(['active', 'credit_hold', 'suspended', 'inactive']);
export type CompanyStatus = z.infer<typeof CompanyStatus>;

// Payment terms are what two businesses AGREED, so this is a SHAPE rather than a
// list. It was `z.enum(['prepay','net15','net30','net60','net90'])`, which meant
// a supplier on Net 14 -- an entirely ordinary agreement -- had to be recorded as
// 15 or 30, putting a wrong due date on a real invoice and mis-aging a real debt.
//
// Nothing downstream ever needed the enum: the column is VarChar(20) and
// `netTermsDays()` in @wizeworks/crm has always parsed whatever digits it finds,
// so every `netN` already worked end to end. The bound is a typo guard -- a year
// of credit is a mistake, and a four-digit day count is a due date in 2031.
export const PaymentTerms = z
  .string()
  .regex(
    /^(prepay|net(?:[1-9]|[1-9]\d|[12]\d\d|3[0-5]\d|36[0-5]))$/,
    'Payment terms must be "prepay" or "net" followed by 1-365 days, e.g. "net14".'
  );
export type PaymentTerms = z.infer<typeof PaymentTerms>;

// What a stage MEANS, across every object a pipeline can move (docs/144 §7.2).
// `won`/`lost` are the sales vocabulary; `resolved`/`closed` are the service
// one — we answered, versus filed and done with. One enum rather than one per
// object, because everything that reads it asks the same question of either:
// is this still ours to do?
export const StageType = z.enum(['open', 'won', 'lost', 'resolved', 'closed']);
export type StageType = z.infer<typeof StageType>;

/**
 * Which terminal vocabulary belongs to which object.
 *
 * A deal pipeline with a "Resolved" column is a mistake, not a preference: the
 * forecast counts `won` and the funnel divides by `lost`, so a deal parked on a
 * stage neither of them recognises silently vanishes from both. The enum above
 * is deliberately permissive (a tenant-invented object brings its own words);
 * this is the per-object narrowing the service applies at the boundary.
 *
 * An unknown object key gets the full set — we cannot know what a tenant's own
 * object considers finished, and refusing it would make custom objects
 * unusable in a pipeline.
 */
export const DEAL_STAGE_TYPES: readonly StageType[] = ['open', 'won', 'lost'];
export const TICKET_STAGE_TYPES: readonly StageType[] = ['open', 'resolved', 'closed'];

export function stageTypesFor(objectKey: string): readonly StageType[] {
  if (objectKey === 'deal') return DEAL_STAGE_TYPES;
  if (objectKey === 'ticket') return TICKET_STAGE_TYPES;
  return StageType.options;
}

// Service requests (docs/144 §7). Priority selects which SLA target applies, so
// it is not a decoration — changing it recomputes what was promised.
export const TicketPriority = z.enum(['low', 'medium', 'high', 'urgent']);
export type TicketPriority = z.infer<typeof TicketPriority>;

// WHERE the request came from — the first thing a support lead slices by, and
// the reason the intake can be idempotent (see Ticket.sourceRecordId).
export const TicketSource = z.enum(['chat', 'email', 'form', 'phone', 'manual', 'api']);
export type TicketSource = z.infer<typeof TicketSource>;

export const TaskPriority = z.enum(['low', 'medium', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof TaskPriority>;

export const TaskStatus = z.enum(['open', 'completed', 'cancelled']);
export type TaskStatus = z.infer<typeof TaskStatus>;

// Activity actor — set on every CrmActivity. Mirrors the actorType enum in
// docs/16 §7 (audit log) so cross-system events use the same vocabulary.
export const ActorType = z.enum(['staff', 'customer', 'system', 'api', 'mcp']);
export type ActorType = z.infer<typeof ActorType>;

// Activity types — canonical list. Service-layer ENUM check before insert.
// Extended carefully — adding a new value here means downstream consumers
// (timeline UI, MCP filters, segment rule predicates) get the new shape on
// the next build. Removals require a migration to rewrite historical rows.
export const ActivityType = z.enum([
  // Order lifecycle (consumed from Commerce events when that module ships)
  'order.placed',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'order.refunded',
  // Email engagement (consumed from Email module events)
  'email.sent',
  'email.opened',
  'email.clicked',
  'email.bounced',
  'email.unsubscribed',
  // Quote / invoice lifecycle (consumed from B2B module events)
  'quote.submitted',
  'quote.accepted',
  'quote.declined',
  'quote.expired',
  'invoice.sent',
  'invoice.paid',
  'invoice.overdue',
  // Account / auth events
  'login',
  'password.reset',
  'account.created',
  // Manual staff entries
  'note',
  'call',
  'meeting',
  'file.attached',
  // Task lifecycle
  'task.created',
  'task.completed',
  // CRM-internal lifecycle
  'deal.created',
  'deal.stage.changed',
  'deal.closed',
  'deal.lost',
  'segment.entered',
  'segment.exited',
  'customer.merged',
  'customer.assigned',
  'b2b.credit_hold',
  'b2b.credit_resumed',
  // The engagement spine (docs/144 §5.5). These are what someone SAID, as
  // opposed to what the platform DID — and they land in the same timeline as
  // everything above deliberately: a person looking at a customer should never
  // have to learn a second place to look for "what happened with them".
  'email.received',
  'email.replied',
  'call.logged',
  'call.missed',
  'meeting.booked',
  // A tenant-declared property moved (docs/144 §3). On the timeline because
  // "their warranty date changed" is history, not just current state.
  'property.changed',
  // Service requests (docs/144 §7).
  'ticket.opened',
  'ticket.replied',
  'ticket.resolved',
]);
export type ActivityType = z.infer<typeof ActivityType>;
