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
  Button,
  Card,
  EmptyState,
  useToast,
} from '@wizeworks/silicaui-react';
import { faBuilding, faExclamationTriangle, faInbox } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useUpdateCustomer, type Customer } from './customers-data';
import { customerName } from './customer-display';
import { useCompanyDomainMatch } from './companies-data';
import { ScorePanel } from './score-panel';
import { StoreCredit, WorthKpis } from './customer-overview-money';
import { OpenDeals, OpenTasks, RecentActivity, RecentOrders } from './customer-overview-lists';
import { useOrders } from '../commerce/data';
import { useDeals } from './deals-data';
import { useTasks } from './tasks-data';
import { useCustomerActivities } from './customer-activity-data';

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
  // `countedOnly` because these rows sit directly under the figures above, and
  // those figures leave cancelled orders out. Without it the card said "3 orders,
  // $582.60" over three rows summing to $636.90, one of them cancelled, having
  // pushed off the only order she had actually been paid for (issue 332).
  const ordersQ = useOrders({
    customerId: customer.id,
    countedOnly: true,
    sortBy: 'placedAt',
    order: 'desc',
    take: 3,
    skip: 0,
  });
  const activityQ = useCustomerActivities(customer.id, 6);

  const deals = dealsQ.data?.items ?? [];
  const tasks = tasksQ.data?.items ?? [];
  const orders = ordersQ.data?.items ?? [];
  const orderTotal = ordersQ.data?.total ?? orders.length;
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
          {orders.length > 0 ? <RecentOrders ctx={ctx} orders={orders} total={orderTotal} /> : null}
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
