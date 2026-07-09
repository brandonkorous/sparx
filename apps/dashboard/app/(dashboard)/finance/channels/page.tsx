// Finance → Channels (docs/110 Slice 4b) — the revenue rollup across every sales
// channel: gross, channel fees, net-after-fees, AOV, and share of total, plus a
// per-channel top-products drill. This is the money view; connecting and syncing
// channels lives in Commerce → Sales channels (D4: rollup-in-Finance / manage-in-
// place). Commerce-gated but wears the Finance hue (Finance owns its color — docs/109).

import Link from 'next/link';
import { Store } from 'lucide-react';
import { channelKeyLabel } from '@sparx/crm-schemas';
import { Button, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

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
    <ModuleProvider module="finance">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <PageHeader
            icon={<Store className="h-5 w-5" />}
            title="Channels"
            description="Revenue, fees, and net by sales channel — your own storefront, sparx.market, and every connected marketplace, compared over the last 30 days."
          />

          {revenue && revenue.byChannel.length > 0 ? (
            <>
              <Card className="bg-module bg-soft">
                <CardBody>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>Revenue by channel</CardTitle>
                    <p className="text-base-content/70 text-xs">{revenue.rangeLabel}</p>
                  </div>
                  <ChannelRevenuePanel report={revenue} selectedChannel={selectedChannel} />
                </CardBody>
              </Card>

              {selectedChannel && topProducts && (
                <Card className="bg-module bg-soft">
                  <CardBody>
                    <ChannelTopProductsPanel
                      label={channelKeyLabel(selectedChannel)}
                      products={topProducts}
                      currency={revenue.currency}
                    />
                  </CardBody>
                </Card>
              )}
            </>
          ) : (
            <Card className="bg-module bg-soft">
              <CardBody>
                <p className="text-base-content/70 max-w-prose text-sm">
                  No channel sales in the last 30 days yet. Once orders come in — through your own
                  storefront or a connected marketplace — your revenue, fees, and net break down by
                  channel here.
                </p>
                <div>
                  <Button color="module" render={<Link href="/commerce/channels" />}>
                    Connect a sales channel
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          <p className="text-base-content/70 text-sm">
            Connect, disconnect, or sync channels in{' '}
            <Link href="/commerce/channels" className="text-module font-medium hover:underline">
              Commerce → Sales channels
            </Link>
            .
          </p>
        </div>
      </div>
    </ModuleProvider>
  );
}
