'use client';

// The customer's RELATED records — one read-only tab each for the things that
// point at this person: their orders, their deals, their tasks, and their
// activity timeline. None of these are edited here. A row opens the REAL detail
// pane for that record (the order, the deal, the task), because that record has
// one home and this is a lens onto it, not a second copy of it.
//
// Orders are Commerce's data seen from the customer's side, so that one tab
// wears the Commerce hue via a nested ModuleScope; the rest are the CRM's own.

import { Badge, Card, EmptyState, Table, Text } from '@wizeworks/silicaui-react';
import { Activity, Handshake, ListTodo, Receipt, Repeat, StickyNote } from 'lucide-react';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { ModuleScope } from '../../components/module-scope';
import {
  formatDate as formatOrderDate,
  formatMoney as formatOrderMoney,
  shippingState,
  useOrders,
} from '../commerce/data';
import { useSubscriptions, type SubscriptionStatus } from '../commerce/subscriptions-data';
import { useDeals, formatMoney as formatDealMoney } from './deals-data';
import { stageTypeMeta } from './pipelines-data';
import { isOverdue, taskStatusMeta, useTasks } from './tasks-data';
import { EngagementComposer } from './engagement-composer';
import {
  activityTone,
  activityTypeLabel,
  useCustomerActivities,
  type CustomerActivity,
} from './customer-activity-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** A row that opens a detail pane — click, or Enter/Space with the keyboard,
 *  and shift/alt pick where it lands. The one interaction every related list
 *  shares, so it lives in one place. */
function openableRowProps(open: (event: { shiftKey: boolean; altKey: boolean }) => void) {
  return {
    className: 'cursor-pointer',
    tabIndex: 0,
    role: 'button' as const,
    onClick: (event: React.MouseEvent) => {
      open(event);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open(event);
    },
  };
}

/** The card every related list sits in, with its loading / error / empty faces
 *  handled once so each tab is just its table. */
function RelatedCard({
  isPending,
  isError,
  isEmpty,
  icon,
  emptyTitle,
  emptyDescription,
  children,
}: {
  isPending: boolean;
  isError: boolean;
  isEmpty: boolean;
  icon: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      {isError ? (
        <EmptyState
          icon={icon}
          title="Could not load this"
          description="Something went wrong reaching the server. It may be a temporary problem — try again in a moment."
        />
      ) : isPending ? (
        <p className="p-4 text-sm" role="status">
          Loading…
        </p>
      ) : isEmpty ? (
        <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
      ) : (
        children
      )}
    </Card>
  );
}

/* ── Orders ─────────────────────────────────────────────────────────────── */

export function CustomerOrdersTab({
  ctx,
  customerId,
}: {
  ctx: SurfaceContext;
  customerId: string;
}) {
  const { data, isPending, isError } = useOrders({
    customerId,
    sortBy: 'placedAt',
    order: 'desc',
    take: 100,
    skip: 0,
  });
  const rows = data?.items ?? [];

  return (
    // Selling's data, so the rows read as Selling — the Commerce hue on the badges.
    <ModuleScope module="commerce">
      <RelatedCard
        isPending={isPending}
        isError={isError}
        isEmpty={rows.length === 0}
        icon={<Receipt className="size-6" aria-hidden />}
        emptyTitle="No orders yet"
        emptyDescription="When this customer places an order, it shows here. Orders are placed at checkout, never typed up in the CRM."
      >
        <Table size="sm" hover>
          <thead>
            <tr>
              <th>Order</th>
              <th className="hidden @lg:table-cell">Placed</th>
              <th>Status</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const state = shippingState(row);
              return (
                <tr
                  key={row.id}
                  {...openableRowProps((event) => {
                    ctx.open('commerce.order.detail', { id: row.id }, { target: targetFor(event) });
                  })}
                >
                  <td className="font-mono text-sm">{row.orderNumber}</td>
                  <td className="hidden text-sm @lg:table-cell">{formatOrderDate(row.placedAt)}</td>
                  <td>
                    <Badge color={state.tone} variant="soft" size="sm">
                      {state.label}
                    </Badge>
                  </td>
                  <td className="text-right font-mono text-sm tabular-nums">
                    {formatOrderMoney(row.total, row.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </RelatedCard>
    </ModuleScope>
  );
}

/* ── Deals ──────────────────────────────────────────────────────────────── */

export function CustomerDealsTab({ ctx, customerId }: { ctx: SurfaceContext; customerId: string }) {
  const { data, isPending, isError } = useDeals({ customerId });
  const rows = data?.items ?? [];

  return (
    <RelatedCard
      isPending={isPending}
      isError={isError}
      isEmpty={rows.length === 0}
      icon={<Handshake className="size-6" aria-hidden />}
      emptyTitle="No deals with this customer"
      emptyDescription="A deal is a sale you are working on. Use “Deal” in the toolbar and it opens already linked to this customer."
    >
      <Table size="sm" hover>
        <thead>
          <tr>
            <th>Deal</th>
            <th>Stage</th>
            <th className="text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((deal) => {
            const stage = stageTypeMeta(deal.stage?.stageType ?? 'open');
            return (
              <tr
                key={deal.id}
                {...openableRowProps((event) => {
                  ctx.open('crm.deal.detail', { id: deal.id }, { target: targetFor(event) });
                })}
              >
                <td className="min-w-0">
                  <span className="block truncate font-medium">{deal.title}</span>
                </td>
                <td>
                  <Badge color={stage.tone} variant="soft" size="sm">
                    {deal.stage?.name ?? stage.label}
                  </Badge>
                </td>
                <td className="text-right font-mono text-sm tabular-nums">
                  {formatDealMoney(deal.value, deal.currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </RelatedCard>
  );
}

/* ── Tasks ──────────────────────────────────────────────────────────────── */

function shortDate(iso: string | null): string {
  if (!iso) return 'No date';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function CustomerTasksTab({ ctx, customerId }: { ctx: SurfaceContext; customerId: string }) {
  const { data, isPending, isError } = useTasks({ customerId });
  const rows = data?.items ?? [];

  return (
    <RelatedCard
      isPending={isPending}
      isError={isError}
      isEmpty={rows.length === 0}
      icon={<ListTodo className="size-6" aria-hidden />}
      emptyTitle="Nothing to do for this customer"
      emptyDescription="Tasks are the follow-ups you owe this person — “call back”, “send the quote”. Use “Task” in the toolbar and it opens already linked to this customer."
    >
      <Table size="sm" hover>
        <thead>
          <tr>
            <th>Task</th>
            <th className="hidden @md:table-cell">Due</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((task) => {
            const overdue = isOverdue(task);
            const meta = taskStatusMeta(task.status, overdue);
            return (
              <tr
                key={task.id}
                {...openableRowProps((event) => {
                  ctx.open('crm.task.detail', { id: task.id }, { target: targetFor(event) });
                })}
              >
                <td className="min-w-0">
                  <span className="block truncate font-medium">{task.title}</span>
                </td>
                <td className="hidden text-sm @md:table-cell">{shortDate(task.dueAt)}</td>
                <td>
                  <Badge color={meta.tone} variant="soft" size="sm">
                    {meta.label}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </RelatedCard>
  );
}

/* ── Subscriptions ──────────────────────────────────────────────────────── */

const SUB_STATUS_META: Record<
  SubscriptionStatus,
  { label: string; tone: 'success' | 'info' | 'danger' | 'warning' | 'neutral' }
> = {
  trialing: { label: 'Trialing', tone: 'info' },
  active: { label: 'Active', tone: 'success' },
  past_due: { label: 'Past due', tone: 'danger' },
  paused: { label: 'Paused', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

function subNextDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function CustomerSubscriptionsTab({
  ctx,
  customerId,
}: {
  ctx: SurfaceContext;
  customerId: string;
}) {
  const { data, isPending, isError } = useSubscriptions({ customerId, take: 100, skip: 0 });
  const rows = data?.items ?? [];

  return (
    // Standing orders are Selling's, so the rows read as Selling.
    <ModuleScope module="commerce">
      <RelatedCard
        isPending={isPending}
        isError={isError}
        isEmpty={rows.length === 0}
        icon={<Repeat className="size-6" aria-hidden />}
        emptyTitle="No repeat orders"
        emptyDescription="When this customer sets up a subscription — a standing order that renews on its own — it shows here."
      >
        <Table size="sm" hover>
          <thead>
            <tr>
              <th>Repeat order</th>
              <th className="hidden @md:table-cell">Next</th>
              <th>Status</th>
              <th className="text-right">Per month</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((sub) => {
              const meta = SUB_STATUS_META[sub.status] ?? { label: sub.status, tone: 'neutral' };
              return (
                <tr
                  key={sub.id}
                  {...openableRowProps((event) => {
                    ctx.open(
                      'commerce.subscription.detail',
                      { id: sub.id },
                      { target: targetFor(event) }
                    );
                  })}
                >
                  <td className="text-sm">
                    {sub.itemCount} {sub.itemCount === 1 ? 'item' : 'items'}
                  </td>
                  <td className="hidden text-sm @md:table-cell">
                    {subNextDate(sub.nextOccurrenceAt)}
                  </td>
                  <td>
                    <Badge color={meta.tone} variant="soft" size="sm">
                      {meta.label}
                    </Badge>
                  </td>
                  <td className="text-right font-mono text-sm tabular-nums">
                    {formatOrderMoney(sub.monthlyRecurringRevenueCents / 100, sub.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </RelatedCard>
    </ModuleScope>
  );
}

/* ── Activity timeline ──────────────────────────────────────────────────── */

function activityWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const DOT_TONE: Record<string, string> = {
  module: 'bg-module',
  warning: 'bg-warning',
  neutral: 'bg-base-300',
};

function ActivityRow({ activity, isLast }: { activity: CustomerActivity; isLast: boolean }) {
  const tone = activityTone(activity.type, activity.actorType);
  return (
    <li className="flex gap-3">
      {/* The rail + dot make a real timeline: a connecting line down the
          gutter, a coloured node on each event. The line is a base-tone edge,
          not a shadow — and it stops at the last event rather than trailing off
          into empty space. */}
      <div className="flex flex-col items-center gap-1 pt-1.5">
        <span className={`size-2.5 shrink-0 rounded-full ${DOT_TONE[tone] ?? 'bg-base-300'}`} />
        {isLast ? null : <span className="bg-base-300 w-px flex-1" aria-hidden />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <Text as="span" className="font-medium">
            {activityTypeLabel(activity.type)}
          </Text>
          <Text as="span" className="text-sm tabular-nums">
            {activityWhen(activity.occurredAt)}
          </Text>
        </div>
        {activity.description ? <Text className="text-sm">{activity.description}</Text> : null}
      </div>
    </li>
  );
}

// The activity types a person AUTHORS by hand — the Notes tab's whole content.
// Everything else in the log (orders, emails, task/deal lifecycle) is recorded
// by the services that own it and only ever shows on the broader Activity tab.
//
// The engagement kinds (docs/144 §5) join them: an email someone typed here and
// a call they logged are as hand-authored as a note, and belong in the same
// short list rather than buried in the full stream.
const HUMAN_ACTIVITY_TYPES = new Set([
  'note',
  'call',
  'meeting',
  'call.logged',
  'call.missed',
  'email.sent',
  'email.replied',
  'email.received',
]);

// NOTES — what YOU recorded. The engagement composer, and just the
// human-authored entries. Deliberately separate from Activity: notes are the
// handful of things you jot down; activity is the whole event stream, most of it
// not yours. Different sizes, different jobs, different tabs.
export function CustomerNotesTab({
  customerId,
  canEmail,
}: {
  customerId: string;
  /** Whether the person has an email address, so the Email tab is offered only
   *  when it can actually work. */
  canEmail?: boolean;
}) {
  const { data, isPending, isError } = useCustomerActivities(customerId);
  const rows = (data ?? []).filter((activity) => HUMAN_ACTIVITY_TYPES.has(activity.type));

  return (
    <div className="flex flex-col gap-3">
      {/* One control for note / email / call (docs/144 §5.5). It replaced a
          note-only composer: logging what just happened has to be cheaper than
          not logging it, and everything a CRM knows is downstream of that. */}
      <EngagementComposer customerId={customerId} canEmail={canEmail} />
      <RelatedCard
        isPending={isPending}
        isError={isError}
        isEmpty={rows.length === 0}
        icon={<StickyNote className="size-6" aria-hidden />}
        emptyTitle="No notes yet"
        emptyDescription="Jot the first note — or log a call or meeting — with the box above. It is only ever seen by your team."
      >
        <ul className="flex flex-col p-4">
          {rows.map((activity, index) => (
            <ActivityRow key={activity.id} activity={activity} isLast={index === rows.length - 1} />
          ))}
        </ul>
      </RelatedCard>
    </div>
  );
}

// ACTIVITY — the whole event stream, read-only. Everything that has touched this
// customer, newest first: the notes you logged AND every order, email and
// lifecycle event the platform recorded on its own.
export function CustomerActivityTab({ customerId }: { customerId: string }) {
  const { data, isPending, isError } = useCustomerActivities(customerId);
  const rows = data ?? [];

  return (
    <RelatedCard
      isPending={isPending}
      isError={isError}
      isEmpty={rows.length === 0}
      icon={<Activity className="size-6" aria-hidden />}
      emptyTitle="Nothing has happened yet"
      emptyDescription="Notes, orders, emails and account changes involving this customer all land here as they happen, newest first."
    >
      <ul className="flex flex-col p-4">
        {rows.map((activity, index) => (
          <ActivityRow key={activity.id} activity={activity} isLast={index === rows.length - 1} />
        ))}
      </ul>
    </RelatedCard>
  );
}
