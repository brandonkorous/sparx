'use client';

// The Overview tab's four lists — deals, tasks, orders, activity.
//
// Each renders rows it is GIVEN and nothing else: whether a list appears at all
// is the tab's decision, because only the tab can tell "no deals" from "the
// deals failed to load".

import { Badge, Text } from '@wizeworks/silicaui-react';

import { FormSection } from '../../components/form-section';
import { ModuleScope } from '../../components/module-scope';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { formatMoney } from './customer-display';
import { formatDate as formatOrderDate, shippingState, type Order } from '../commerce/data';
import { formatMoney as formatDealMoney, type Deal } from './deals-data';
import { stageTypeMeta } from './pipelines-data';
import { isOverdue, taskStatusMeta, type Task } from './tasks-data';
import { activityTone, activityTypeLabel, type CustomerActivity } from './customer-activity-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** One clickable row in an Overview list — opens a record on click. */
function OverviewRow({
  onOpen,
  children,
}: {
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-3 py-2 text-left"
        onClick={(event) => {
          onOpen(event);
        }}
      >
        {children}
      </button>
    </li>
  );
}

export function OpenDeals({ ctx, deals }: { ctx: SurfaceContext; deals: Deal[] }) {
  return (
    <FormSection
      title="Open deals"
      description="Live deals with this customer and where each one sits on its pipeline."
    >
      <ul className="divide-base-300 -my-1 flex flex-col divide-y">
        {deals.map((deal) => {
          const stage = stageTypeMeta(deal.stage?.stageType ?? 'open');
          return (
            <OverviewRow
              key={deal.id}
              onOpen={(event) => {
                ctx.open('crm.deal.detail', { id: deal.id }, { target: targetFor(event) });
              }}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{deal.title}</span>
              <Badge color={stage.tone} variant="soft" size="sm">
                {deal.stage?.name ?? stage.label}
              </Badge>
              <span className="w-20 shrink-0 text-right font-mono text-sm tabular-nums">
                {formatDealMoney(deal.value, deal.currency)}
              </span>
            </OverviewRow>
          );
        })}
      </ul>
    </FormSection>
  );
}

function taskDue(iso: string | null): string {
  if (!iso) return 'No date';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function OpenTasks({ ctx, tasks }: { ctx: SurfaceContext; tasks: Task[] }) {
  return (
    <FormSection title="Open tasks" description="Follow-ups you still owe this customer.">
      <ul className="divide-base-300 -my-1 flex flex-col divide-y">
        {tasks.map((task) => {
          const overdue = isOverdue(task);
          const meta = taskStatusMeta(task.status, overdue);
          return (
            <OverviewRow
              key={task.id}
              onOpen={(event) => {
                ctx.open('crm.task.detail', { id: task.id }, { target: targetFor(event) });
              }}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
              <Badge color={meta.tone} variant="soft" size="sm">
                {meta.label}
              </Badge>
              <span className="w-16 shrink-0 text-right text-sm">{taskDue(task.dueAt)}</span>
            </OverviewRow>
          );
        })}
      </ul>
    </FormSection>
  );
}

export function RecentOrders({
  ctx,
  orders,
  total,
}: {
  ctx: SurfaceContext;
  orders: Order[];
  /** How many they have in all. A window of three over eight orders looked
   *  identical to all three of them, so the figures above could not be
   *  reconciled with the rows below (issue 332). */
  total: number;
}) {
  const windowed = total > orders.length;
  return (
    <ModuleScope module="commerce">
      <FormSection
        title="Recent orders"
        description={
          windowed
            ? `Their ${orders.length} most recent. All ${total} are on the Orders tab.`
            : 'Everything they have ordered.'
        }
      >
        <ul className="divide-base-300 -my-1 flex flex-col divide-y">
          {orders.map((row) => {
            const state = shippingState(row);
            return (
              <OverviewRow
                key={row.id}
                onOpen={(event) => {
                  ctx.open('commerce.order.detail', { id: row.id }, { target: targetFor(event) });
                }}
              >
                <span className="font-mono text-sm">{row.orderNumber}</span>
                <Badge color={state.tone} variant="soft" size="sm">
                  {state.label}
                </Badge>
                <span className="ml-auto text-sm">{formatOrderDate(row.placedAt)}</span>
                {/* What the order came to, and what went back. The figures above
                    are net of refunds and this column was gross, so one order of
                    $147.00 sat under a total of $105.00 with nothing to explain
                    the gap — a full refund has a badge to carry it, a PARTIAL one
                    had nothing (issue 332). */}
                <span className="flex w-36 shrink-0 flex-col items-end">
                  <span className="text-right font-mono text-sm tabular-nums">
                    {formatMoney(row.total, row.currency)}
                  </span>
                  {row.refundTotal > 0 ? (
                    <span className="text-right text-sm whitespace-nowrap tabular-nums">
                      {formatMoney(row.refundTotal, row.currency)} refunded
                    </span>
                  ) : null}
                </span>
              </OverviewRow>
            );
          })}
        </ul>
      </FormSection>
    </ModuleScope>
  );
}

const DOT_TONE: Record<string, string> = {
  module: 'bg-module',
  warning: 'bg-warning',
  neutral: 'bg-base-300',
};

function activityWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function RecentActivity({ activity }: { activity: CustomerActivity[] }) {
  return (
    <FormSection
      title="Recent activity"
      description="The latest of everything involving this customer. The Activity tab has the full history."
    >
      <ul className="flex flex-col gap-2">
        {activity.map((item) => {
          const tone = activityTone(item.type, item.actorType);
          return (
            <li key={item.id} className="flex items-baseline gap-2.5">
              <span
                className={`size-2 shrink-0 translate-y-1.5 rounded-full ${DOT_TONE[tone] ?? 'bg-base-300'}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <Text as="span" className="font-medium">
                  {activityTypeLabel(item.type)}
                </Text>
                {item.description ? (
                  <Text as="span" className="text-sm">
                    {' — '}
                    {item.description}
                  </Text>
                ) : null}
              </span>
              <Text as="span" className="shrink-0 text-sm tabular-nums">
                {activityWhen(item.occurredAt)}
              </Text>
            </li>
          );
        })}
      </ul>
    </FormSection>
  );
}
