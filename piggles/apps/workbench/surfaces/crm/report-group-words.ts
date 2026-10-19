// What a report breakdown calls each group (persona issue 247). The server names
// ids and sends `groupLabels`; a stored code like `lead` or `credit_hold` is named
// HERE, with the words this console already uses for it everywhere else.

import { CustomerType, LeadStatus, LifecycleStage } from '@wizeworks/crm-schemas';

import { formatAmount } from '../../lib/money-format';
import { paymentTermsLabel } from '../../lib/payment-terms';
import { accountStatusMeta } from './companies-data';
import { customerTypeMeta, leadStatusMeta, lifecycleStageMeta } from './customer-display';
import { TASK_PRIORITIES, taskStatusMeta } from './tasks-data';
import { priorityLabel, sourceLabel, type TicketPriority, type TicketSource } from './tickets-data';

type Words = (code: string) => string | null;

/** One cell of a report, as text, for the builder and a dashboard card alike.
 *  Money comes out as money, every other number with the same separators (251). */
export function formatCell(
  value: unknown,
  as?: { kind?: 'number' | 'currency'; currency?: string }
): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    if (as?.kind === 'currency') return formatAmount(value, as.currency ?? 'USD');
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (typeof value === 'bigint') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  // A JSONB value that is not a scalar would print "[object Object]".
  if (typeof value !== 'string') return '—';
  // A DATE_TRUNC bucket is a timestamp; nobody wants the time of "March".
  const asDate = /^\d{4}-\d{2}-\d{2}T/.exec(value) ? new Date(value) : null;
  return asDate ? asDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : value;
}

const TICKET_PRIORITIES: readonly string[] = ['low', 'medium', 'high', 'urgent'];
const TICKET_SOURCES: readonly string[] = ['chat', 'email', 'form', 'phone', 'manual', 'api'];

/** The coded fields a report can group by, per object, and their words. A code
 *  the console has no word for returns null and is shown as stored. */
const CODED: Record<string, Record<string, Words>> = {
  contact: {
    type: (c) =>
      CustomerType.safeParse(c).success ? customerTypeMeta(c as CustomerType).label : null,
    lifecycleStage: (c) =>
      LifecycleStage.safeParse(c).success ? lifecycleStageMeta(c as LifecycleStage).label : null,
    leadStatus: (c) =>
      LeadStatus.safeParse(c).success ? leadStatusMeta(c as LeadStatus).label : null,
  },
  company: {
    status: (c) => accountStatusMeta(c).label,
    paymentTerms: (c) => paymentTermsLabel(c),
  },
  ticket: {
    priority: (c) => (TICKET_PRIORITIES.includes(c) ? priorityLabel(c as TicketPriority) : null),
    source: (c) => (TICKET_SOURCES.includes(c) ? sourceLabel(c as TicketSource) : null),
  },
  task: {
    status: (c) => taskStatusMeta(c).label,
    priority: (c) => TASK_PRIORITIES.find((p) => p.value === c)?.label ?? null,
  },
};

/** What a breakdown is OF, and the server's names for its ids. */
export interface GroupNaming {
  objectKey: string;
  field: string | undefined;
  groupLabels: Record<string, string> | undefined;
}

/** The name for one group of a breakdown, or null when the value should be shown
 *  as it is (a date bucket, a number, free text the business typed). */
export function groupName(value: unknown, context: GroupNaming): string | null {
  if (typeof value !== 'string') return null;
  const named = context.groupLabels?.[value];
  if (named !== undefined) return named;
  if (!context.field) return null;
  return CODED[context.objectKey]?.[context.field]?.(value) ?? null;
}

/** A group's cell: its name when it has one, else the value as stored. */
export function groupText(value: unknown, context: GroupNaming): string {
  return groupName(value, context) ?? formatCell(value);
}

/** Why an answer is empty. "Loosen a filter" only when something narrows it AND
 *  there is something to find: a business with no deals is told so, even on a
 *  ready-made report that carries a filter of its own ("Where your deals are"
 *  keeps to open deals since issue 250), because loosening it would find nothing
 *  either (issue 255). `holdsAny` is unknown until asked; the narrowed sentence
 *  stands until then. */
export function emptyAnswer(context: {
  narrowed: boolean;
  holdsAny?: boolean;
  labelPlural: string;
}): string {
  const none = `There are no ${context.labelPlural.toLowerCase()} to count yet.`;
  if (context.holdsAny === false) return none;
  if (context.narrowed) return 'Nothing matches yet. Loosen a filter, or widen the period.';
  return none;
}
