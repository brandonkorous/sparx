'use client';

// Your sparx bill — what WizeWorks charges this business, and the card it's on.
//
// This is the one surface in Finance about money going OUT, so it is built to read
// like a STATEMENT, not a ledger feed: a headline charge, an itemised breakdown of
// which modules make it up, a total line, and the card it comes off. That
// different shape is deliberate — mixing "what customers pay you" with "what you
// pay sparx" in one list is exactly how an owner misreads their own numbers.
//
// The plan itself is real data (derived from the business's active modules + list
// prices); managing the card or cancelling is Stripe's hosted portal, opened in a
// new tab — the only place a card is ever edited.

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Heading,
  Table,
  Text,
} from '@wizeworks/silicaui-react';
import { ApiError } from '@sparx/api-client';
import { CreditCard, ExternalLink } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useBill, useBillingPortal, type Bill } from './bill-data';
import { formatMoney, formatDate } from './format';

// Plain-language module names + what each does — an owner pays for capabilities,
// not slugs. Any module without an entry falls back to a tidied slug.
const MODULE_LABELS: Record<string, { name: string; blurb: string }> = {
  builder: { name: 'Website builder', blurb: 'Design and host your site' },
  commerce: { name: 'Online store', blurb: 'Sell products online' },
  cms: { name: 'Content & blog', blurb: 'Pages, posts and media' },
  crm: { name: 'Customers & contacts', blurb: 'Track customers and deals' },
  email: { name: 'Email marketing', blurb: 'Newsletters and campaigns' },
  b2b: { name: 'Wholesale', blurb: 'Trade pricing and accounts' },
  invoicing: { name: 'Invoicing', blurb: 'Estimates and invoices' },
  inventory: { name: 'Stock control', blurb: 'Track stock across locations' },
  chat: { name: 'Live chat', blurb: 'Talk to visitors on your site' },
  ai: { name: 'AI assistant', blurb: 'AI tools across your business' },
  scheduling: { name: 'Bookings', blurb: 'Appointments and classes' },
  dropship: { name: 'Dropshipping', blurb: 'Sell supplier-shipped products' },
};

function moduleLabel(key: string): { name: string; blurb: string } {
  return MODULE_LABELS[key] ?? { name: key.replace(/_/g, ' '), blurb: '' };
}

/** How the subscription is doing, in words + colour. */
function planState(bill: Bill): {
  label: string;
  tone: 'success' | 'warning' | 'error' | 'info' | 'neutral';
} {
  if (bill.planType === 'enterprise') return { label: 'Custom plan', tone: 'info' };
  const status = bill.subscriptionStatus;
  if (status === 'trialing') return { label: 'Free trial', tone: 'info' };
  if (status === 'active') return { label: 'Active', tone: 'success' };
  if (status === 'past_due' || status === 'unpaid') return { label: 'Payment due', tone: 'error' };
  if (status === 'canceled') return { label: 'Cancelled', tone: 'neutral' };
  if (bill.cancelAtPeriodEnd) return { label: 'Ends soon', tone: 'warning' };
  if (bill.planModules.length > 0) return { label: 'Active', tone: 'success' };
  return { label: 'No paid plan', tone: 'neutral' };
}

function renewalLine(bill: Bill): string | null {
  if (bill.subscriptionStatus === 'trialing' && bill.trialEndsAt) {
    return `Free trial ends ${formatDate(bill.trialEndsAt)}`;
  }
  if (bill.currentPeriodEnd) {
    return bill.cancelAtPeriodEnd
      ? `Your plan ends ${formatDate(bill.currentPeriodEnd)}`
      : `Renews ${formatDate(bill.currentPeriodEnd)}`;
  }
  return null;
}

export function SubscriptionSurface({ ctx }: { ctx: SurfaceContext }) {
  const { data: bill, isPending, isError, isFetching, dataUpdatedAt, refetch } = useBill();
  const portal = useBillingPortal();
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    ctx.setTitle('Your sparx bill');
  }, [ctx]);

  const openPortal = () => {
    setPortalError(null);
    const returnUrl =
      typeof window !== 'undefined' ? window.location.href : 'https://workbench.sparx.works';
    portal.mutate(returnUrl, {
      onSuccess: ({ url }) => {
        if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
      },
      onError: (error) => {
        setPortalError(
          error instanceof ApiError
            ? error.message
            : 'Could not open the billing portal. Please try again in a moment.'
        );
      },
    });
  };

  const state = bill ? planState(bill) : null;
  const renewal = bill ? renewalLine(bill) : null;
  const intervalNote = bill?.billingInterval === 'annual' ? 'billed yearly' : 'per month';

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Bill controls">
        <p className="text-sm">Your sparx bill</p>
        <RefreshButton
          className="ml-auto"
          isFetching={isFetching}
          updatedAt={bill ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <EmptyState
            icon={<CreditCard className="size-6" aria-hidden />}
            title="Could not load your bill"
            description="Something went wrong reaching the server. Your subscription is unaffected — try again in a moment."
            actions={
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  void refetch();
                }}
              >
                Try again
              </Button>
            }
          />
        ) : isPending || !bill || !state ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            {/* The headline charge — the statement's total, up top. */}
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Text className="text-sm">What you pay sparx</Text>
                  <Heading level={2} className="mt-1 text-3xl font-semibold tabular-nums">
                    {formatMoney(bill.planTotalCents / 100)}
                    <span className="text-base-content ml-1 text-base font-normal">
                      {intervalNote}
                    </span>
                  </Heading>
                  {renewal ? <Text className="mt-1 text-sm">{renewal}</Text> : null}
                </div>
                <Badge color={state.tone} variant="soft">
                  {state.label}
                </Badge>
              </div>
            </Card>

            {bill.planType === 'enterprise' ? (
              <Alert color="info" variant="soft">
                <Text>
                  You’re on a custom plan arranged with the sparx team. The breakdown below is for
                  reference — any changes go through your account contact rather than self-serve.
                </Text>
              </Alert>
            ) : null}

            {/* The itemised breakdown — which modules make up the charge. */}
            <Card className="overflow-hidden">
              <header className="border-base-300 border-b px-4 py-3">
                <Heading level={3} className="text-base font-semibold">
                  What makes up your bill
                </Heading>
              </header>
              {bill.planModules.length === 0 ? (
                <div className="p-4">
                  <Text>
                    You’re not paying for any paid modules right now. As you switch features on,
                    they’ll show up here with their price.
                  </Text>
                </div>
              ) : (
                <Table size="sm">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th className="text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.planModules.map((m) => {
                      const label = moduleLabel(m.moduleKey);
                      return (
                        <tr key={m.moduleKey}>
                          <td>
                            <div className="font-medium">{label.name}</div>
                            {label.blurb ? <div className="text-sm">{label.blurb}</div> : null}
                          </td>
                          <td className="text-right whitespace-nowrap tabular-nums">
                            {formatMoney(m.monthlyCents / 100)}/mo
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-base-300 border-t font-medium">
                      <td>Total</td>
                      <td className="text-right whitespace-nowrap tabular-nums">
                        {formatMoney(bill.planTotalCents / 100)}/mo
                      </td>
                    </tr>
                  </tfoot>
                </Table>
              )}
            </Card>

            {/* The card it comes off, and the one action that edits any of this. */}
            <Card className="p-4">
              <Heading level={3} className="text-base font-semibold">
                Card on file
              </Heading>
              <Text className="mt-1">
                {bill.card
                  ? `${bill.card.brand.replace(/\b\w/g, (ch) => ch.toUpperCase())} ending ${bill.card.last4} · expires ${String(bill.card.expMonth).padStart(2, '0')}/${String(bill.card.expYear).slice(-2)}`
                  : 'No card on file yet. Add one in the billing portal to keep your plan active.'}
              </Text>

              {portalError ? (
                <Alert color="warning" variant="soft" className="mt-3">
                  <Text>{portalError}</Text>
                </Alert>
              ) : null}

              <div className="mt-4">
                <Button color="module" size="sm" loading={portal.isPending} onClick={openPortal}>
                  <ExternalLink className="size-4" aria-hidden />
                  {bill.card ? 'Manage billing & card' : 'Add a card'}
                </Button>
              </div>
              <Text className="mt-2 text-sm">
                Opens sparx’s secure billing portal in a new tab, where you can update your card,
                change your plan, or download past invoices.
              </Text>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
