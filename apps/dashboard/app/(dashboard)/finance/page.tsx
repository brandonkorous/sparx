import * as React from 'react';
import { Landmark } from 'lucide-react';
import { Container, Grid, Heading, PageHeader, Stack, Text } from '@sparx/ui';

import { FINANCE_FLOW_LABELS, type FinanceFlow } from './nav';
import { loadFinanceOverview } from './_data/overview';
import {
  ChannelsCard,
  PaymentsCard,
  PayoutsCard,
  ReceivablesCard,
  SubscriptionCard,
} from './_components/overview-cards';

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
  const o = await loadFinanceOverview();

  // Commerce-gated reads return null when the module is off; that single fact decides
  // whether the "you get paid" acceptance cards belong on this tenant's Overview.
  const hasCommerce = o.payments !== null;

  const cards: Record<FinanceFlow, React.ReactNode[]> = { in: [], sparx: [] };

  if (hasCommerce && o.payments) {
    cards.in.push(<PaymentsCard key="payments" payments={o.payments} />);
    cards.in.push(
      <PayoutsCard key="payouts" balance={o.payoutBalance} settlement={o.settlement} />
    );
    if (o.channels) cards.in.push(<ChannelsCard key="channels" channels={o.channels} />);
  }
  if (o.receivables) {
    cards.in.push(<ReceivablesCard key="receivables" ar={o.receivables} />);
  }
  cards.sparx.push(<SubscriptionCard key="subscription" sub={o.subscription} />);

  return (
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
  );
}
