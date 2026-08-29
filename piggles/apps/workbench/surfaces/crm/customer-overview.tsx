'use client';

// The Overview tab — the customer at a glance, read-only.
//
// This is the answer to "who is this and are they worth my time": what they have
// spent (Commerce's numbers, so they wear the Commerce hue), their live work, and
// the last few things that happened. Everything is derived — nothing to save — so
// editing lives on the Details tab and never clutters this one.
//
// ── Empty is STATED, never hidden ─────────────────────────────────────────
//
// The sections below do NOT silently vanish when empty. A section that just
// disappears reads as broken — the viewer cannot tell "this customer has no
// deals" from "the deals failed to load". So the tab decides ONE thing up front:
// is there any activity to show? If not, it says so out loud with a single clear
// panel. If a load genuinely fails, that says so too. Only when there IS content
// do we drop the individual empty sections — because the populated page around
// them already proves nothing is broken.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  EmptyState,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { faBuilding, faExclamationTriangle, faInbox } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { FormSection } from '../../components/form-section';
import { ModuleScope } from '../../components/module-scope';
import {
  customerName,
  describeOrderRecency,
  formatMoney,
  longDate,
  useUpdateCustomer,
  type Customer,
} from './customers-data';
import { useCompanyDomainMatch } from './companies-data';
import { ScorePanel } from './score-panel';
import {
  formatDate as formatOrderDate,
  shippingState,
  useOrders,
  type Order,
} from '../commerce/data';
import { useDeals, formatMoney as formatDealMoney, type Deal } from './deals-data';
import { stageTypeMeta } from './pipelines-data';
import { isOverdue, taskStatusMeta, useTasks, type Task } from './tasks-data';
import { useAccountCreditLedger } from '../commerce/account-credit-data';
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

/* ── KPI tiles ──────────────────────────────────────────────────────────── */

// A bordered base-100 tile — the app's KPI shape (mirrors reports.tsx). Value
// leads on scale and weight; the label sits under it in full ink, never faded.
function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-base-300 bg-base-100 flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-sm">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint ? <span className="text-sm">{hint}</span> : null}
    </div>
  );
}

function WorthKpis({ customer }: { customer: Customer }) {
  // `totalSpent` is money RECEIVED (SUM of amountPaid); `orderCount` counts every
  // order placed. Dividing one by the other is "what each order has actually
  // brought in" and NOT the size of an order — the label has to say which, or a
  // customer with three unpaid orders reads as worth nothing (issue 323).
  const spent = Number(customer.totalSpent);
  const orders = customer.orderCount;
  const avg = orders > 0 ? spent / orders : 0;
  const nothingCollected = orders > 0 && spent === 0;

  return (
    // Commerce's data, so the band reads as Selling — the one signal that these
    // numbers come from orders, not something typed into the CRM.
    <ModuleScope module="commerce">
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <Kpi
          label="Paid you so far"
          value={formatMoney(spent)}
          hint={nothingCollected ? 'None of their orders has been paid yet' : undefined}
        />
        <Kpi label="Orders" value={orders.toLocaleString()} />
        <Kpi label="Average paid per order" value={orders > 0 ? formatMoney(avg) : '—'} />
        <Kpi
          label="Last order"
          value={orders > 0 ? describeOrderRecency(customer.lastOrderAt) : 'None yet'}
          hint={
            orders > 0 && customer.firstOrderAt
              ? `First ${longDate(customer.firstOrderAt)}`
              : undefined
          }
        />
      </div>
    </ModuleScope>
  );
}

/* ── Store credit (money the customer has WITH you) ─────────────────────── */

function StoreCredit({ customerId }: { customerId: string }) {
  const { data } = useAccountCreditLedger(customerId);
  const cents = data?.balanceCents ?? 0;
  // A positive-only accent: its ABSENCE is not something a viewer looks for (most
  // customers never have store credit), so unlike the sections below it stays
  // conditional rather than showing a "no credit" line for everyone.
  if (cents <= 0) return null;

  return (
    <ModuleScope module="commerce">
      <div className="border-base-300 bg-base-100 flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="flex min-w-0 flex-col">
          <Text as="span" className="font-medium">
            Store credit
          </Text>
          <Text as="span" className="text-sm">
            Balance this customer can spend at checkout.
          </Text>
        </div>
        <span className="shrink-0 text-2xl font-semibold tabular-nums">
          {formatMoney(cents / 100, data?.currency)}
        </span>
      </div>
    </ModuleScope>
  );
}

/* ── Presentational sections (rendered only when they have rows) ─────────── */

function OpenDeals({ ctx, deals }: { ctx: SurfaceContext; deals: Deal[] }) {
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

function OpenTasks({ ctx, tasks }: { ctx: SurfaceContext; tasks: Task[] }) {
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

function RecentOrders({ ctx, orders }: { ctx: SurfaceContext; orders: Order[] }) {
  return (
    <ModuleScope module="commerce">
      <FormSection
        title="Recent orders"
        description="Their latest purchases. Open the Orders tab for the rest."
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
                <span className="w-24 shrink-0 text-right font-mono text-sm tabular-nums">
                  {formatMoney(row.total, row.currency)}
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

function RecentActivity({ activity }: { activity: CustomerActivity[] }) {
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

/* ── Tab ────────────────────────────────────────────────────────────────── */

/**
 * "Do they work at Harborview Inn?" — the association offer (docs/144 §11).
 *
 * IT ASKS, IT NEVER DECIDES. Filing someone under a company changes who sees
 * them, which price list finds them and whose invoice they land on, so guessing
 * from an email domain and doing it silently would be the platform quietly
 * rewriting a relationship on the strength of a string after an @. The business
 * turns the suggestion on (it is off by default), the business says yes, and
 * personal mailboxes are never guessed from at all.
 *
 * Shown only where all three are true: there is an address, nobody has filed
 * them yet, and a company has actually claimed that domain. Everything else —
 * a personal address, an unclaimed domain, the setting off — renders nothing,
 * because a banner explaining why there is no suggestion is worse than silence.
 *
 * Dismissal is for this viewing only. It is not stored: the reason to say no is
 * almost always "not now", and a permanent "never ask about this contact" is a
 * preference nobody knows they set and nobody can find to undo.
 */
function CompanySuggestion({ ctx, customer }: { ctx: SurfaceContext; customer: Customer }) {
  const [dismissed, setDismissed] = useState(false);
  const toast = useToast();
  const update = useUpdateCustomer(customer.id);

  const unfiled = customer.companyId === null;
  const email = customer.email ?? '';
  const { data: match } = useCompanyDomainMatch(email, unfiled && !dismissed);
  const suggestion = match?.company ?? null;

  if (!unfiled || dismissed || suggestion === null) return null;

  const accept = (): void => {
    update.mutate(
      { companyId: suggestion.id },
      {
        onSuccess: () => {
          toast.add({
            title: `Filed under ${suggestion.companyName}`,
            type: 'success',
          });
        },
        onError: () => {
          toast.add({
            title: 'Could not file them there',
            description: 'Nothing was changed. Try again in a moment.',
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <Alert color="module" variant="soft">
      <Icon glyph={faBuilding} className="size-5 shrink-0" aria-hidden />
      <AlertContent>
        <AlertTitle>Do they work at {suggestion.companyName}?</AlertTitle>
        <AlertDescription>
          {match?.domain !== null && match?.domain !== undefined
            ? `${customerName(customer)} writes from ${match.domain}, which you have told us belongs to ${suggestion.companyName}.`
            : `${customerName(customer)}'s email domain belongs to ${suggestion.companyName}.`}{' '}
          Filing them there puts them on the company&rsquo;s page alongside everyone else you know
          at that business.
        </AlertDescription>
        <AlertActions>
          <Button color="module" size="sm" loading={update.isPending} onClick={accept}>
            Yes, file them there
          </Button>
          <Button
            color="neutral"
            variant="outline"
            size="sm"
            onClick={() => {
              setDismissed(true);
            }}
          >
            Not now
          </Button>
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            onClick={(event) => {
              ctx.open(
                'crm.account.detail',
                { id: suggestion.id },
                { target: event.shiftKey ? 'beside' : 'tab' }
              );
            }}
          >
            Look at {suggestion.companyName} first
          </Button>
        </AlertActions>
      </AlertContent>
    </Alert>
  );
}

export function CustomerOverviewTab({
  ctx,
  customer,
}: {
  ctx: SurfaceContext;
  customer: Customer;
}) {
  // The tab owns the reads so it can make ONE honest call about the whole
  // activity area — loading vs. genuinely empty vs. failed — instead of each
  // section quietly disappearing on its own.
  const dealsQ = useDeals({ customerId: customer.id, state: 'open' });
  const tasksQ = useTasks({ customerId: customer.id, status: 'open' });
  const ordersQ = useOrders({
    customerId: customer.id,
    sortBy: 'placedAt',
    order: 'desc',
    take: 3,
    skip: 0,
  });
  const activityQ = useCustomerActivities(customer.id, 6);

  const deals = dealsQ.data?.items ?? [];
  const tasks = tasksQ.data?.items ?? [];
  const orders = ordersQ.data?.items ?? [];
  const activity = activityQ.data ?? [];

  const loading = dealsQ.isPending || tasksQ.isPending || ordersQ.isPending || activityQ.isPending;
  const anyError = dealsQ.isError || tasksQ.isError || ordersQ.isError || activityQ.isError;
  const hasContent =
    deals.length > 0 || tasks.length > 0 || orders.length > 0 || activity.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <CompanySuggestion ctx={ctx} customer={customer} />
      {/* Worth always shows — $0 across zero orders is a real, meaningful state. */}
      <WorthKpis customer={customer} />
      <StoreCredit customerId={customer.id} />
      {/* "Are they worth my time" is the question this tab exists to answer, and
          the score is this business's own answer to it — so it sits with the
          money rather than below the activity feed. */}
      <ScorePanel
        ctx={ctx}
        objectKey="contact"
        recordId={customer.id}
        score={customer.score}
        scoredAt={customer.scoredAt}
        scoreOffset={customer.scoreOffset}
        noun="customer"
      />

      {loading ? (
        <Card>
          <PaneWaiting />
        </Card>
      ) : hasContent ? (
        <>
          {deals.length > 0 ? <OpenDeals ctx={ctx} deals={deals} /> : null}
          {tasks.length > 0 ? <OpenTasks ctx={ctx} tasks={tasks} /> : null}
          {orders.length > 0 ? <RecentOrders ctx={ctx} orders={orders} /> : null}
          {activity.length > 0 ? <RecentActivity activity={activity} /> : null}
        </>
      ) : anyError ? (
        // A failure must NEVER look like "nothing here" — say it plainly.
        <Card>
          <EmptyState
            icon={<Icon glyph={faExclamationTriangle} className="size-6" aria-hidden />}
            title="Some of this couldn't load"
            description="There was a problem reaching the server, so this customer's deals, tasks, orders and activity aren't showing. Nothing is wrong with the customer — try again in a moment."
          />
        </Card>
      ) : (
        // Genuinely empty — say so, so it reads as NEW, not broken.
        <Card>
          <EmptyState
            icon={<Icon glyph={faInbox} className="size-6" aria-hidden />}
            title="Nothing here yet"
            description={`${customerName(customer)} has no deals, tasks, orders or logged activity so far. As soon as any of that happens — or you log a note — it will show up here.`}
          />
        </Card>
      )}
    </div>
  );
}
