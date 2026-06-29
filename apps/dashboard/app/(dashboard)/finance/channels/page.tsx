// Finance → Channels (docs/110 Slice 4b) — the revenue rollup across every sales
// channel: gross, channel fees, net-after-fees, AOV, and share of total, plus a
// per-channel top-products drill. This is the money view; connecting and syncing
// channels lives in Commerce → Sales channels (D4: rollup-in-Finance / manage-in-
// place). Commerce-gated and tinted with the Commerce hue.

import Link from 'next/link';
import { Store } from 'lucide-react';
import { channelKeyLabel } from '@sparx/crm-schemas';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  ModuleProvider,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

import { requireModuleOrUpsell } from '@/components/module-gate';

import { getChannelRevenue, getChannelTopProducts } from './actions';
import { ChannelRevenuePanel, ChannelTopProductsPanel } from './_components/channel-revenue-panel';

export const dynamic = 'force-dynamic';

export default async function FinanceChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}): Promise<React.JSX.Element> {
  const upsell = await requireModuleOrUpsell('commerce');
  if (upsell) return <>{upsell}</>;

  const { channel: selectedChannel } = await searchParams;
  const revenue = await getChannelRevenue();
  // Channel drill: top products on the selected channel, fetched only when a
  // `?channel=` is chosen from the comparison table.
  const topProducts = selectedChannel ? await getChannelTopProducts(selectedChannel) : null;

  return (
    <ModuleProvider module="commerce">
      <Container size="xl">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<Store className="h-5 w-5" />}
            title="Channels"
            description="Revenue, fees, and net by sales channel — your own storefront, sparx.market, and every connected marketplace, compared over the last 30 days."
          />

          {revenue && revenue.byChannel.length > 0 ? (
            <>
              <Card variant="module">
                <CardHeader>
                  <Stack direction="row" align="center" justify="between" gap={2}>
                    <CardTitle>Revenue by channel</CardTitle>
                    <Text size="xs" variant="muted">
                      {revenue.rangeLabel}
                    </Text>
                  </Stack>
                </CardHeader>
                <CardContent>
                  <ChannelRevenuePanel report={revenue} selectedChannel={selectedChannel} />
                </CardContent>
              </Card>

              {selectedChannel && topProducts && (
                <Card variant="module">
                  <CardContent className="pt-6">
                    <ChannelTopProductsPanel
                      label={channelKeyLabel(selectedChannel)}
                      products={topProducts}
                      currency={revenue.currency}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card variant="module">
              <CardContent>
                <Stack gap={3}>
                  <Text size="sm" variant="muted" className="max-w-prose">
                    No channel sales in the last 30 days yet. Once orders come in — through your own
                    storefront or a connected marketplace — your revenue, fees, and net break down
                    by channel here.
                  </Text>
                  <div>
                    <Button asChild color="module">
                      <Link href="/commerce/channels">Connect a sales channel</Link>
                    </Button>
                  </div>
                </Stack>
              </CardContent>
            </Card>
          )}

          <Text size="sm" variant="muted">
            Connect, disconnect, or sync channels in{' '}
            <Link
              href="/commerce/channels"
              className="font-medium text-[var(--module-active-text)] hover:underline"
            >
              Commerce → Sales channels
            </Link>
            .
          </Text>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
