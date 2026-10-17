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
import { Alert, Badge, Button, Card, Heading, Text } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { ApiError } from '@wizeworks/api-client';
import { buildPath } from '@wizeworks/links';
import { CreditCard, ExternalLink } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { PaneLoadError } from '../../components/pane-load-error';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useBill, useBillingPortal, useBillingCheckout } from './bill-data';
import { formatMoney } from './format';
import { planState, renewalLine } from './subscription-words';
import { moduleBillLabel } from '../modules/data';
import { ManagersOnlyNotice } from '../../components/managers-only';
import { useManageRights } from '../../lib/manage-rights';

export function SubscriptionSurface({ ctx }: { ctx: SurfaceContext }) {
  const { data: bill, isPending, isError, error, isFetching, dataUpdatedAt, refetch } = useBill();
  const portal = useBillingPortal();
  const checkout = useBillingCheckout();
  const rights = useManageRights();
  const [actionError, setActionError] = useState<string | null>(null);
  const [returnStatus, setReturnStatus] = useState<'success' | 'cancelled' | null>(null);

  // Stripe sends the tenant back here after Checkout with `?billing=success|cancelled`
  // (the api-rest checkout route builds that return URL). It arrives as a PANE
  // PARAMETER, not as something read off `window.location`: the address bar
  // tracks whichever pane is focused now, so by the time this runs the query
  // string may belong to a different surface entirely — and rewriting it here
  // would fight the URL tracker for control of the same string. The matcher
  // hands any query parameter a route does not name straight through to the
  // surface, which is exactly what this needs.
  //
  // Read once. `ctx.params` is stable for a pane's lifetime, so the effect keys
  // on the value and a refresh genuinely re-shows the outcome — which is right:
  // a reloaded Checkout return is still a Checkout return.
  const returnParam = ctx.params.billing;
  useEffect(() => {
    if (returnParam !== 'success' && returnParam !== 'cancelled') return;
    setReturnStatus(returnParam);
    // The subscription may have been created by the webhook moments ago.
    if (returnParam === 'success') void refetch();
  }, [returnParam, refetch]);

  // Before a subscription exists (trial, no card) we SET UP billing through Stripe
  // Checkout — that hosted page carries the card form AND the discount-code box.
  // Once it exists, the same button MANAGES it through the Customer Portal. Both are
  // single-use hosted URLs opened in a new tab.
  const inSetup = bill ? !bill.billingActive : false;

  const openBilling = () => {
    setActionError(null);
    // Stripe must come back to THIS surface, so the return URL is built from the
    // address table rather than read off `window.location` — the bar names
    // whichever pane is focused, which by the time someone clicks may be
    // anything. api-rest appends `?billing=success|cancelled` to whatever it is
    // given, and that lands as a pane parameter above.
    const returnUrl =
      typeof window === 'undefined'
        ? 'https://app.sparx.works/settings/billing'
        : (buildPath('finance.subscription', undefined, { origin: window.location.origin }) ??
          window.location.origin);
    const mutation = inSetup ? checkout : portal;
    mutation.mutate(returnUrl, {
      onSuccess: ({ url }) => {
        if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
      },
      onError: (error) => {
        setActionError(
          error instanceof ApiError
            ? error.message
            : 'Could not open billing. Please try again in a moment.'
        );
      },
    });
  };

  const enterprise = bill?.planType === 'enterprise';
  // A custom plan's subscription is made by the sparx team. Before it exists,
  // self-serve checkout would start a list-price plan beside the agreement, so the
  // button is not offered; once it exists, the portal opens for the card and
  // invoices as for anyone (docs/92 §10).
  const selfServeSetup = !(enterprise && !bill?.billingActive);
  const lapsed = bill?.billing.phase === 'grace' || bill?.billing.phase === 'suspended';
  const state = bill ? planState(bill) : null;
  const renewal = bill ? renewalLine(bill) : null;
  const intervalNote = bill?.billingInterval === 'annual' ? 'billed yearly' : 'per month';

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Your sparx bill controls"
        status={<p className="text-sm">Your sparx bill</p>}
        refresh={
          <RefreshButton
            className="ml-auto"
            isFetching={isFetching}
            updatedAt={bill ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <Card className="min-h-0 flex-1 items-center justify-center">
            <PaneLoadError
              error={error}
              icon={<CreditCard className="size-6" aria-hidden />}
              title="Could not load your bill"
              description="Something went wrong reaching the server. Your subscription is unaffected. Try again in a moment."
              onRetry={() => {
                void refetch();
              }}
            />
          </Card>
        ) : isPending || !bill || !state ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            {/* Confirmation after returning from Stripe Checkout. */}
            {returnStatus === 'success' ? (
              <Alert color="success" variant="soft">
                <div className="flex items-start justify-between gap-3">
                  <Text>
                    Payment method saved: you’re all set. Any discount code you entered has been
                    applied, and your bill below reflects your plan.
                  </Text>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReturnStatus(null)}
                    aria-label="Dismiss"
                  >
                    Dismiss
                  </Button>
                </div>
              </Alert>
            ) : returnStatus === 'cancelled' ? (
              <Alert color="info">
                <div className="flex items-start justify-between gap-3">
                  <Text>
                    Checkout was canceled: no changes were made. You can set up billing whenever
                    you’re ready.
                  </Text>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReturnStatus(null)}
                    aria-label="Dismiss"
                  >
                    Dismiss
                  </Button>
                </div>
              </Alert>
            ) : null}

            {/* The headline charge — the statement's total, up top. */}
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* A custom plan's price is in its agreement, not in this list, so
                    the list total is never printed as what the business pays
                    (sparx persona issue 288). */}
                {enterprise ? (
                  <div>
                    <Heading level={2} className="text-2xl font-semibold">
                      Your plan is agreed with the sparx team
                    </Heading>
                    <Text className="mt-1">
                      What you pay, and how, is set in your agreement. Your account contact arranges
                      any change.
                    </Text>
                  </div>
                ) : (
                  <div>
                    <Text className="text-sm">What you pay sparx</Text>
                    <Heading level={2} className="mt-1 text-3xl font-semibold tabular-nums">
                      {formatMoney(bill.planTotalCents / 100)}
                      <span className="ml-1 text-base font-normal">{intervalNote}</span>
                    </Heading>
                    {renewal ? <Text className="mt-1 text-sm">{renewal}</Text> : null}
                  </div>
                )}
                <Badge color={state.tone} variant="soft">
                  {state.label}
                </Badge>
              </div>
            </Card>

            {/* The itemised breakdown — which modules make up the charge. */}
            <Card className="overflow-hidden">
              <header className="border-base-300 border-b px-4 py-3">
                <Heading level={3} className="text-base font-semibold">
                  {enterprise ? 'The features you use, at list price' : 'What makes up your bill'}
                </Heading>
                {enterprise ? (
                  <Text className="mt-1 text-sm">
                    For reference. Your agreement sets what you pay for them.
                  </Text>
                ) : null}
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
                      const label = moduleBillLabel(m.moduleKey);
                      return (
                        <tr key={m.moduleKey}>
                          <td>
                            <div className="font-medium">{label.name}</div>
                            {label.blurb ? <div className="text-sm">{label.blurb}</div> : null}
                          </td>
                          <td
                            className="text-right whitespace-nowrap tabular-nums"
                            data-label="Price"
                          >
                            {formatMoney(m.monthlyCents / 100)}/mo
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-base-300 border-t font-medium">
                      <td>{enterprise ? 'List price in all' : 'Total'}</td>
                      <td className="text-right whitespace-nowrap tabular-nums" data-label="Price">
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
                  : !selfServeSetup
                    ? 'No card on file. Your account contact arranges how you pay.'
                    : rights.known && !rights.canManage
                      ? 'No card on file yet.'
                      : lapsed
                        ? 'No card on file. Add one to switch your paused features back on.'
                        : inSetup
                          ? 'No card on file yet. Set up billing to add your card and keep your plan active when the free trial ends.'
                          : 'No card on file yet. Add one to keep your plan active.'}
              </Text>

              {actionError ? (
                <Alert color="warning" className="mt-3">
                  <Text>{actionError}</Text>
                </Alert>
              ) : null}

              {/* Only an owner or an admin may add a card or change the plan: the
                  server refuses everybody else, so they are told so here instead of
                  being refused after (sparx persona issue 168). */}
              {!selfServeSetup ? null : rights.known && !rights.canManage ? (
                <div className="mt-4">
                  <ManagersOnlyNotice
                    title="An owner or an admin looks after the bill"
                    change="add a card or change the plan"
                  />
                </div>
              ) : (
                <>
                  <div className="mt-4">
                    <Button
                      color="module"
                      size="sm"
                      loading={portal.isPending || checkout.isPending}
                      onClick={openBilling}
                    >
                      <ExternalLink className="size-4" aria-hidden />
                      {inSetup
                        ? lapsed
                          ? 'Add payment method'
                          : 'Set up billing'
                        : bill.card
                          ? 'Manage billing & card'
                          : 'Add a card'}
                    </Button>
                  </div>
                  <Text className="mt-2 text-sm">
                    {inSetup
                      ? 'Opens sparx’s secure payment page in a new tab to add your card. Have a discount code? You can enter it there.'
                      : 'Opens sparx’s secure billing portal in a new tab, where you can update your card, change your plan, or download past invoices.'}
                  </Text>
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
