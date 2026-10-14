// The details an "only if…" condition, or a campaign's "what counts as success",
// can check, in an owner's words (sparx persona issue 158).
//
// The picker used to be a type-ahead over raw code names (`customer.lifecycleStage`,
// `b2bAccount.hasOverdueInvoices`), and it lacked the details the server's own
// campaign goals use, so a "Filling the calendar" campaign had no way to say
// "they booked". Three of its names (`customer.lifetimeOrders`, `deal.stage`,
// `order.itemCount`) were never resolved by the server at all, so a rule on them
// could never come true. Every path here is one an automation resolver really
// fills; `condition-fields.test.ts` reads the resolvers and holds that.
//
// The stored rule still holds the code name. Only the screen speaks in words.

import type { CustomerType, LeadStatus, LifecycleStage } from '@wizeworks/crm-schemas';
import {
  LEAD_STATUSES,
  LIFECYCLE_STAGES,
  RELATIONSHIP_TYPES,
  customerTypeMeta,
  leadStatusMeta,
  lifecycleStageMeta,
} from '../crm/customers-data';
import { orderStatusWords } from '../commerce/orders-list-filters';
import { STATUS_OPTIONS as BOOKING_STATUS_OPTIONS } from '../scheduling/bookings-list-filters';
import type { ConditionOperator } from '@wizeworks/automation-schemas';

/** How a detail's value is entered, which decides the comparisons and the value box. */
export type ConditionFieldKind = 'text' | 'number' | 'yesno' | 'choice' | 'tags';

export interface ConditionChoice {
  value: string;
  label: string;
}

export interface ConditionFieldDef {
  path: string;
  /** What the detail belongs to: "Customer", "Booking", … */
  group: string;
  label: string;
  kind: ConditionFieldKind;
  /** For a `choice`: every value the server stores, in words. */
  choices?: readonly ConditionChoice[];
}

const ORDER_STATUSES = ['placed', 'fulfilled', 'delivered', 'cancelled', 'refunded'] as const;

const choices = (pairs: Record<string, string>): ConditionChoice[] =>
  Object.entries(pairs).map(([value, label]) => ({ value, label }));

export const CONDITION_FIELDS: readonly ConditionFieldDef[] = [
  // Customer
  { path: 'customer.firstName', group: 'Customer', label: 'First name', kind: 'text' },
  { path: 'customer.lastName', group: 'Customer', label: 'Last name', kind: 'text' },
  { path: 'customer.email', group: 'Customer', label: 'Email address', kind: 'text' },
  { path: 'customer.phone', group: 'Customer', label: 'Phone number', kind: 'text' },
  { path: 'customer.company', group: 'Customer', label: 'Company', kind: 'text' },
  {
    path: 'customer.type',
    group: 'Customer',
    label: 'Relationship',
    kind: 'choice',
    choices: RELATIONSHIP_TYPES.map((t: CustomerType) => ({
      value: t,
      label: customerTypeMeta(t).label,
    })),
  },
  {
    path: 'customer.lifecycleStage',
    group: 'Customer',
    label: 'Lifecycle stage',
    kind: 'choice',
    choices: LIFECYCLE_STAGES.map((s: LifecycleStage) => ({
      value: s,
      label: lifecycleStageMeta(s).label,
    })),
  },
  {
    path: 'customer.leadStatus',
    group: 'Customer',
    label: 'Lead status',
    kind: 'choice',
    choices: LEAD_STATUSES.map((s: LeadStatus) => ({ value: s, label: leadStatusMeta(s).label })),
  },
  { path: 'customer.tags', group: 'Customer', label: 'Labels', kind: 'tags' },
  { path: 'customer.totalSpent', group: 'Customer', label: 'Total spent', kind: 'number' },
  { path: 'customer.orderCount', group: 'Customer', label: 'Number of orders', kind: 'number' },
  { path: 'customer.hasOrdered', group: 'Customer', label: 'Has ever ordered', kind: 'yesno' },
  {
    path: 'customer.daysSinceLastOrder',
    group: 'Customer',
    label: 'Days since last order',
    kind: 'number',
  },
  {
    path: 'customer.daysSinceCreated',
    group: 'Customer',
    label: 'Days since they were added',
    kind: 'number',
  },
  {
    path: 'customer.doNotContact',
    group: 'Customer',
    label: 'Do not send marketing',
    kind: 'yesno',
  },

  // Order
  {
    path: 'order.status',
    group: 'Order',
    label: 'Where it is',
    kind: 'choice',
    choices: ORDER_STATUSES.map((s) => ({ value: s, label: orderStatusWords(s) })),
  },
  {
    path: 'order.paymentStatus',
    group: 'Order',
    label: 'Payment',
    kind: 'choice',
    choices: choices({
      unpaid: 'Not paid',
      partially_paid: 'Part paid',
      paid: 'Paid',
      refunded: 'Refunded',
    }),
  },
  { path: 'order.total', group: 'Order', label: 'Total', kind: 'number' },
  { path: 'order.subtotal', group: 'Order', label: 'Subtotal', kind: 'number' },
  { path: 'order.refundTotal', group: 'Order', label: 'Amount refunded', kind: 'number' },
  { path: 'order.number', group: 'Order', label: 'Order number', kind: 'text' },
  { path: 'order.channel', group: 'Order', label: 'Where it was sold', kind: 'text' },

  // Booking
  {
    path: 'booking.status',
    group: 'Booking',
    label: 'Status',
    kind: 'choice',
    choices: [
      // The bookings list's own words. Its "Any status" and "Happened, still
      // open" are list filters, not stored values.
      ...BOOKING_STATUS_OPTIONS.filter((o) => o.value !== '' && o.value !== 'still_open'),
      { value: 'waitlisted', label: 'On the waiting list' },
    ],
  },
  { path: 'booking.serviceName', group: 'Booking', label: 'Service', kind: 'text' },
  { path: 'booking.resourceName', group: 'Booking', label: 'Who or what is booked', kind: 'text' },
  { path: 'booking.durationMinutes', group: 'Booking', label: 'Length in minutes', kind: 'number' },
  { path: 'booking.hoursAway', group: 'Booking', label: 'Hours until it starts', kind: 'number' },

  // Quote
  { path: 'quote.stageName', group: 'Quote', label: 'Stage', kind: 'text' },
  { path: 'quote.total', group: 'Quote', label: 'Total', kind: 'number' },
  { path: 'quote.number', group: 'Quote', label: 'Quote number', kind: 'text' },

  // Invoice
  { path: 'invoice.total', group: 'Invoice', label: 'Total', kind: 'number' },
  { path: 'invoice.balance', group: 'Invoice', label: 'Still owed', kind: 'number' },
  { path: 'invoice.overdueDays', group: 'Invoice', label: 'Days overdue', kind: 'number' },
  { path: 'invoice.daysUntilDue', group: 'Invoice', label: 'Days until due', kind: 'number' },
  { path: 'invoice.number', group: 'Invoice', label: 'Invoice number', kind: 'text' },

  // Deal
  { path: 'deal.title', group: 'Deal', label: 'Name', kind: 'text' },
  { path: 'deal.value', group: 'Deal', label: 'Value', kind: 'number' },
  { path: 'deal.probability', group: 'Deal', label: 'Chance of winning', kind: 'number' },
  {
    path: 'deal.stageType',
    group: 'Deal',
    label: 'Outcome',
    kind: 'choice',
    choices: choices({ open: 'Still open', won: 'Won', lost: 'Lost' }),
  },
  { path: 'deal.isClosed', group: 'Deal', label: 'Is closed', kind: 'yesno' },
  { path: 'deal.tags', group: 'Deal', label: 'Labels', kind: 'tags' },

  // Wholesale account
  {
    path: 'b2bAccount.status',
    group: 'Wholesale account',
    label: 'Account status',
    kind: 'choice',
    choices: choices({
      active: 'Active',
      credit_hold: 'Credit hold',
      suspended: 'Suspended',
      inactive: 'Inactive',
    }),
  },
  {
    path: 'b2bAccount.companyName',
    group: 'Wholesale account',
    label: 'Company name',
    kind: 'text',
  },
  {
    path: 'b2bAccount.creditLimit',
    group: 'Wholesale account',
    label: 'Credit limit',
    kind: 'number',
  },
  {
    path: 'b2bAccount.creditUsed',
    group: 'Wholesale account',
    label: 'Credit used',
    kind: 'number',
  },
  {
    path: 'b2bAccount.maxDaysPastDue',
    group: 'Wholesale account',
    label: 'Days the oldest bill is late',
    kind: 'number',
  },
  {
    path: 'b2bAccount.hasOverdueInvoices',
    group: 'Wholesale account',
    label: 'Has a late bill',
    kind: 'yesno',
  },

  // A held wholesale order (sparx persona issue 087)
  {
    path: 'approval.asksBusiness',
    group: 'Held order',
    label: 'Waiting on your business',
    kind: 'yesno',
  },
  {
    path: 'approval.asksAccount',
    group: 'Held order',
    label: 'Waiting on the customer’s company',
    kind: 'yesno',
  },

  // Form
  { path: 'form.formName', group: 'Form', label: 'Form name', kind: 'text' },
  { path: 'form.pageSlug', group: 'Form', label: 'Page it was sent from', kind: 'text' },
  { path: 'form.siteName', group: 'Form', label: 'Website', kind: 'text' },

  // Subscription
  {
    path: 'subscription.status',
    group: 'Subscription',
    label: 'Status',
    kind: 'choice',
    choices: choices({
      trialing: 'On a free trial',
      active: 'Active',
      past_due: 'Payment late',
      paused: 'Paused',
      cancelled: 'Canceled',
    }),
  },
  { path: 'subscription.isCancelled', group: 'Subscription', label: 'Is canceled', kind: 'yesno' },

  // Support request
  {
    path: 'ticket.priority',
    group: 'Support request',
    label: 'Priority',
    kind: 'choice',
    choices: choices({ low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }),
  },
  { path: 'ticket.isResolved', group: 'Support request', label: 'Is resolved', kind: 'yesno' },
  {
    path: 'ticket.isAssigned',
    group: 'Support request',
    label: 'Has someone on it',
    kind: 'yesno',
  },
  { path: 'ticket.hasReplied', group: 'Support request', label: 'Has a reply', kind: 'yesno' },
  { path: 'ticket.stageName', group: 'Support request', label: 'Stage', kind: 'text' },
  { path: 'ticket.subject', group: 'Support request', label: 'Subject', kind: 'text' },
  { path: 'ticket.ageMinutes', group: 'Support request', label: 'Minutes open', kind: 'number' },

  // Review
  { path: 'review.rating', group: 'Review', label: 'Stars', kind: 'number' },

  // Cart
  { path: 'cart.total', group: 'Cart', label: 'Total', kind: 'number' },

  // Stock
  { path: 'inventory.available', group: 'Stock', label: 'Available to sell', kind: 'number' },
  { path: 'inventory.reorderPoint', group: 'Stock', label: 'Reorder point', kind: 'number' },

  // Task
  {
    path: 'task.priority',
    group: 'Task',
    label: 'Priority',
    kind: 'choice',
    choices: choices({ low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }),
  },
  { path: 'task.title', group: 'Task', label: 'Title', kind: 'text' },
];

const BY_PATH = new Map(CONDITION_FIELDS.map((f) => [f.path, f]));

/** The detail a stored path names, or undefined for a path this list does not offer. */
export function conditionField(path: string): ConditionFieldDef | undefined {
  return BY_PATH.get(path);
}

/** "Booking · Status" for a known detail; a path nobody worded shows as itself. */
export function conditionFieldLabel(path: string): string {
  const def = conditionField(path);
  return def ? `${def.group} · ${def.label}` : path;
}

/**
 * The picker's items. A stored rule on a path this list does not offer (one
 * written by an assistant, or by an older version of this screen) keeps its
 * place, under its own name, so opening a rule never drops a condition.
 */
export function conditionFieldItems(current: string): ConditionChoice[] {
  const items = CONDITION_FIELDS.map((f) => ({
    value: f.path,
    label: conditionFieldLabel(f.path),
  }));
  if (current !== '' && !BY_PATH.has(current)) items.push({ value: current, label: current });
  return items;
}

/**
 * Whether a picker item answers to what was typed: its name, or one of its
 * values. An owner who wants "they paid" types "paid", which is a value of
 * "Order · Payment" and not part of its name; "booked" is how they say a
 * booking's status. Every word typed has to appear somewhere.
 */
export function conditionFieldMatches(item: unknown, query: string): boolean {
  const { value, label } = item as ConditionChoice;
  const def = conditionField(value);
  const said = [label, ...(def?.choices ?? []).map((c) => c.label), ...(SAID_AS[value] ?? [])]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .every((w) => said.includes(w));
}

/** Words an owner uses for a detail that are neither its name nor its values. */
const SAID_AS: Record<string, readonly string[]> = {
  'booking.status': ['booked', 'appointment'],
  'order.paymentStatus': ['paid', 'unpaid', 'owed'],
  'order.total': ['bought', 'spent'],
  'quote.stageName': ['accepted', 'estimate'],
  'customer.orderCount': ['bought', 'ordered'],
  'customer.hasOrdered': ['bought', 'ordered'],
};

const OPERATORS_BY_KIND: Record<ConditionFieldKind, readonly ConditionOperator[]> = {
  text: ['eq', 'neq', 'contains', 'not_contains', 'in', 'not_in', 'is_set', 'is_not_set'],
  number: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is_set', 'is_not_set'],
  yesno: ['eq'],
  choice: ['eq', 'neq', 'in', 'not_in', 'is_set', 'is_not_set'],
  tags: ['contains', 'not_contains', 'is_set', 'is_not_set'],
};

/**
 * The comparisons that make sense for a detail. "Is more than" on a booking's
 * status compares words by size. The stored one is always kept, so an older
 * rule still opens as it was written.
 */
export function operatorsFor(path: string, current: ConditionOperator): ConditionOperator[] {
  const def = conditionField(path);
  if (!def) return [];
  const offered = [...OPERATORS_BY_KIND[def.kind]];
  return offered.includes(current) ? offered : [...offered, current];
}

/** The comparison a newly picked detail starts on. */
export function startingOperator(path: string): ConditionOperator {
  const def = conditionField(path);
  if (def?.kind === 'tags') return 'contains';
  return 'eq';
}

/** The value a newly picked detail starts on: a yes-or-no starts on yes. */
export function startingValue(path: string): unknown {
  return conditionField(path)?.kind === 'yesno' ? true : '';
}
