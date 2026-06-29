import * as React from 'react';
import { Landmark } from 'lucide-react';
import { isModuleEnabled, requireSession } from '@sparx/auth';
import { Container, Grid, Heading, ModuleProvider, PageHeader, Stack, Text } from '@sparx/ui';

import { FINANCE_FLOW_LABELS, type FinanceFlow } from './nav';
import { loadFinanceOverview } from './_data/overview';
import {
  ChannelsCard,
  PaymentsCard,
  PayoutsCard,
  ReceivablesCard,
  SubscriptionCard,
} from './_components/overview-cards';
import { FinanceUpsellCard, MONEY_IN_UPSELLS } from './_components/finance-upsell-card';

// The Finance Overview (docs/109 §4, docs/110 Slice 2). The screen the hub exists for:
// every financial signal on one page, real data, grouped by the money-flow split
// (docs/109 §4.1) — "You get paid" vs "You pay sparx" — each card deep-linking to the
// section that manages it. Reads compose in one parallel load; any unavailable signal
// (disabled module, unreachable report) drops its card rather than breaking the page,
// so the Overview reads correctly for a commerce shop, a B2B distributor, and a
// content-only publisher alike.

export const dynamic = 'force-dynamic';

const FLOW_ORDER: FinanceFlow[] = ['in', 'sparx'];

export default async function FinanceOverviewPage() {
  const [session, o] = await Promise.all([requireSession(), loadFinanceOverview()]);

  // Commerce-gated reads return null when the module is off; that single fact decides
  // whether the "you get paid" acceptance cards belong on this tenant's Overview.
  const hasCommerce = o.payments !== null;

  const cards: Record<FinanceFlow, React.ReactNode[]> = { in: [], sparx: [] };

  // Every signal card is finance-hue, so the one-primary-card-per-hue rule means
  // exactly ONE wears the green tint (the rest plain) — a page of green cards is
  // competing washes, not wayfinding (root CLAUDE.md). Payments is the headline
  // money-in anchor; when Commerce is off, the first present signal (Receivables)
  // takes it instead. The upsell cards below each wear a *different* hue (one card
  // per hue), so they stay tinted on their own terms.
  if (hasCommerce && o.payments) {
    cards.in.push(<PaymentsCard key="payments" payments={o.payments} primary />);
    cards.in.push(
      <PayoutsCard key="payouts" balance={o.payoutBalance} settlement={o.settlement} />
    );
    if (o.channels) cards.in.push(<ChannelsCard key="channels" channels={o.channels} />);
  }
  if (o.receivables) {
    cards.in.push(<ReceivablesCard key="receivables" ar={o.receivables} primary={!hasCommerce} />);
  }
  cards.sparx.push(<SubscriptionCard key="subscription" sub={o.subscription} />);

  // Finance as an upsell surface (docs/109 §4): for each money-in module that is OFF —
  // not merely empty — append a "turn it on" card to the "You get paid" group. Off-not-
  // empty is the tasteful line: isModuleEnabled is false, so we invite a missing
  // capability and never nag a tenant who already has it. These trail the real signals,
  // so a content-only publisher (no real cards) sees the group become an honest "here's
  // how to get paid" row instead of staying hidden.
  const canActivate = session.user.role === 'owner' || session.user.role === 'admin';
  const moneyInEnabled = await Promise.all(
    MONEY_IN_UPSELLS.map((u) => isModuleEnabled(session.user.tenantId, u.module))
  );
  MONEY_IN_UPSELLS.forEach((u, i) => {
    if (moneyInEnabled[i]) return;
    cards.in.push(
      <FinanceUpsellCard
        key={`upsell-${u.module}`}
        module={u.module}
        pitch={u.pitch}
        canActivate={canActivate}
      />
    );
  });

  return (
    <ModuleProvider module="finance">
      <Container size="xl">
        <Stack gap={8} className="py-10">
          <PageHeader
            icon={<Landmark className="h-5 w-5" />}
            title="Finance"
            description="Every financial integration in one place — how you get paid, where your money lands, and what you pay sparx."
          />

          {FLOW_ORDER.map((flow) => {
            const group = cards[flow];
            if (group.length === 0) return null;
            return (
              <Stack key={flow} gap={4}>
                <Stack gap={1}>
                  <Heading level={2}>{FINANCE_FLOW_LABELS[flow]}</Heading>
                  <Text size="sm" variant="muted">
                    {flow === 'in'
                      ? 'Money coming to you — from customers, marketplaces, and accounts.'
                      : 'What you pay sparx to run on the platform.'}
                  </Text>
                </Stack>
                <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
                  {group}
                </Grid>
              </Stack>
            );
          })}
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
