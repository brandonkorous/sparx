import * as React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Banknote, CreditCard, ReceiptText, Store, Wallet } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  ModuleProvider,
  Stack,
  Text,
  statusLabel,
  statusTone,
  type SparxModule,
} from '@sparx/ui';

import { fmtCents, fmtDate, fmtDollars } from '../_lib/format';
import type {
  ArSummary,
  ChannelTotals,
  SettlementSummary,
  SubscriptionSummary,
} from '../_data/overview';
import type { PaymentConfigState, SparxPayBalance } from '../payments/actions';

// The Finance Overview cards (docs/110 Slice 2). Each card is one financial signal.
// Finance owns a hue now (docs/109), so a tinted card wears the Finance green and a
// finance signal stays finance-colored even when surfaced inside another module (e.g.
// the Payouts card on the Commerce overview).
//
// Tint follows the module-card-tint rule (root CLAUDE.md): on a hue-dense page tint
// only ONE card per hue — the headline "primary" — and leave the rest plain, so the
// screen reads as wayfinding rather than competing washes. Every card is finance-hue,
// so exactly one passes `primary` (the page decides which); the rest drop to a neutral
// surface but keep their green icon. Every card carries a calm empty/zero state.

const GATEWAY_LABEL: Record<string, string> = {
  sparx_pay: 'sparx Pay',
  stripe_direct: 'Your Stripe account',
  manual: 'Manual payments',
};

function OverviewCard({
  module,
  href,
  icon: Icon,
  title,
  badge,
  plain,
  children,
}: {
  module: SparxModule;
  href: string;
  icon: LucideIcon;
  title: string;
  badge?: React.ReactNode;
  /** Tint the card with the module hue when false; render a neutral surface when
   *  true. Per the one-primary-card-per-hue rule, only the page's anchor card is
   *  tinted — the rest pass plain (their icon stays module-colored regardless). */
  plain?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ModuleProvider module={module} className="h-full">
      <Card variant={plain ? 'default' : 'module'} className="flex h-full flex-col">
        <CardHeader>
          <Stack direction="row" align="center" gap={2} className="justify-between">
            <Stack direction="row" align="center" gap={2}>
              <span aria-hidden className="text-[var(--module-active)]">
                <Icon className="h-4 w-4" />
              </span>
              <CardTitle>{title}</CardTitle>
            </Stack>
            {badge}
          </Stack>
        </CardHeader>
        <CardContent className="flex-1">{children}</CardContent>
        <CardFooter>
          <Button variant="ghost" size="sm" asChild>
            <Link href={href}>
              Open
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </ModuleProvider>
  );
}

function Metric({
  value,
  label,
  tone,
}: {
  value: React.ReactNode;
  label: string;
  tone?: 'danger';
}) {
  return (
    <Stack gap={1}>
      <Text
        className={`text-3xl font-medium tracking-tight tabular-nums ${
          tone === 'danger' ? 'text-[var(--color-danger-text)]' : ''
        }`}
      >
        {value}
      </Text>
      <Text size="sm" variant="muted">
        {label}
      </Text>
    </Stack>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Text size="sm" variant="muted" className="py-1">
      {text}
    </Text>
  );
}

export function PaymentsCard({
  payments,
  primary,
}: {
  payments: PaymentConfigState;
  primary?: boolean;
}) {
  const live = payments.isActive;
  const label = GATEWAY_LABEL[payments.gatewayId] ?? payments.gatewayId;
  return (
    <OverviewCard
      module="finance"
      href="/finance/payments"
      icon={Wallet}
      title="Payments"
      plain={!primary}
      badge={
        <Badge color={live ? 'success' : 'warning'} variant="soft">
          {live ? 'Accepting payments' : 'Setup needed'}
        </Badge>
      }
    >
      <Metric
        value={label}
        label={live ? 'Your active payment method' : 'Not accepting payments yet'}
      />
    </OverviewCard>
  );
}

export function PayoutsCard({
  balance,
  settlement,
  primary,
}: {
  balance: SparxPayBalance | null;
  settlement: SettlementSummary | null;
  primary?: boolean;
}) {
  let badge: React.ReactNode;
  let body: React.ReactNode;

  if (balance) {
    const cadence =
      balance.payoutInterval && balance.payoutInterval !== 'manual'
        ? `${statusLabel(balance.payoutInterval)} payouts`
        : null;
    badge = cadence ? (
      <Badge color="neutral" variant="soft">
        {cadence}
      </Badge>
    ) : undefined;
    body = (
      <>
        <Metric
          value={fmtCents(balance.availableCents, balance.currency)}
          label="Available to pay out"
        />
        <Text size="sm" variant="muted" className="mt-2">
          {fmtCents(balance.pendingCents, balance.currency)} settling
        </Text>
      </>
    );
  } else if (settlement && settlement.orderCount > 0) {
    body = (
      <>
        <Metric value={fmtCents(settlement.pendingCents)} label="Pending marketplace settlement" />
        <Text size="sm" variant="muted" className="mt-2">
          {fmtCents(settlement.paidCents)} paid out · {settlement.orderCount} orders
        </Text>
      </>
    );
  } else {
    body = <EmptyState text="No payouts yet — finish sparx Pay setup to start receiving money." />;
  }

  return (
    <OverviewCard
      module="finance"
      href="/finance/payouts"
      icon={Banknote}
      title="Payouts"
      plain={!primary}
      badge={badge}
    >
      {body}
    </OverviewCard>
  );
}

export function ChannelsCard({
  channels,
  primary,
}: {
  channels: ChannelTotals;
  primary?: boolean;
}) {
  if (channels.totalOrders === 0) {
    return (
      <OverviewCard
        module="finance"
        href="/finance/channels"
        icon={Store}
        title="Channels"
        plain={!primary}
      >
        <EmptyState text="No sales across your channels in the last 30 days yet." />
      </OverviewCard>
    );
  }
  return (
    <OverviewCard
      module="finance"
      href="/finance/channels"
      icon={Store}
      title="Channels"
      plain={!primary}
      badge={
        <Badge color="neutral" variant="soft">
          {channels.rangeLabel}
        </Badge>
      }
    >
      <Metric
        value={fmtCents(channels.totalNetAfterFeesCents, channels.currency)}
        label="Net after channel fees"
      />
      <Text size="sm" variant="muted" className="mt-2">
        {fmtCents(channels.totalGrossRevenueCents, channels.currency)} gross ·{' '}
        {channels.totalOrders} orders · {channels.channelCount} channels
      </Text>
    </OverviewCard>
  );
}

export function ReceivablesCard({ ar, primary }: { ar: ArSummary; primary?: boolean }) {
  if (ar.totalCount === 0) {
    return (
      <OverviewCard
        module="finance"
        href="/finance/receivables"
        icon={ReceiptText}
        title="Receivables"
        plain={!primary}
        badge={
          <Badge color="success" variant="soft">
            All current
          </Badge>
        }
      >
        <EmptyState text="Nothing outstanding — every invoice is paid." />
      </OverviewCard>
    );
  }
  const overdue = ar.overdue > 0;
  return (
    <OverviewCard
      module="finance"
      href="/finance/receivables"
      icon={ReceiptText}
      title="Receivables"
      plain={!primary}
      badge={
        overdue ? (
          <Badge color="danger" variant="soft">
            {fmtDollars(ar.overdue)} overdue
          </Badge>
        ) : undefined
      }
    >
      <Metric
        value={fmtDollars(ar.totalOutstanding)}
        label="Outstanding across Invoicing & B2B"
        tone={overdue ? 'danger' : undefined}
      />
      <Text size="sm" variant="muted" className="mt-2">
        {ar.totalCount} open invoice{ar.totalCount === 1 ? '' : 's'}
      </Text>
    </OverviewCard>
  );
}

export function SubscriptionCard({
  sub,
  primary,
}: {
  sub: SubscriptionSummary | null;
  primary?: boolean;
}) {
  let badge: React.ReactNode;
  let body: React.ReactNode;

  if (!sub) {
    body = <EmptyState text="View your plan, status, and invoices." />;
  } else if (sub.planType === 'enterprise') {
    badge = (
      <Badge color="info" variant="soft">
        Enterprise
      </Badge>
    );
    body = <Metric value="Managed" label="Your account team handles billing" />;
  } else {
    const interval = sub.billingInterval === 'annual' ? '/yr' : '/mo';
    const status = sub.subscriptionStatus;
    const nextBilling = fmtDate(sub.currentPeriodEnd);
    const trialEnds = fmtDate(sub.trialEndsAt);
    const sublabel =
      status === 'trialing' && trialEnds
        ? `Free trial ends ${trialEnds}`
        : nextBilling
          ? `Next billing ${nextBilling}`
          : sub.billingActive
            ? `${sub.planModuleCount} module${sub.planModuleCount === 1 ? '' : 's'} active`
            : 'Billing isn’t live yet — this is what you’ll pay';
    badge = status ? (
      <Badge color={statusTone(status)} variant="soft">
        {statusLabel(status)}
        {sub.cancelAtPeriodEnd ? ' · cancels' : ''}
      </Badge>
    ) : undefined;
    body = (
      <Metric
        value={
          <>
            {fmtCents(sub.planTotalCents)}
            <span className="text-base font-normal text-[var(--color-text-tertiary)]">
              {interval}
            </span>
          </>
        }
        label={sublabel}
      />
    );
  }

  return (
    <OverviewCard
      module="finance"
      href="/finance/subscription"
      icon={CreditCard}
      title="sparx subscription"
      plain={!primary}
      badge={badge}
    >
      {body}
    </OverviewCard>
  );
}
