// Channels settings (docs/106) — connect the marketplaces and social platforms a
// tenant already sells on, and manage the connections. Server component fetches
// the connections + the available channel catalog; the connect/disconnect client
// bits live in ./_components. Channels are part of Commerce (the API gates on it).

import { CheckCircle2, Store } from 'lucide-react';
import { channelKeyLabel } from '@sparx/crm-schemas';
import {
  Alert,
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

import { getChannelRevenue, getChannelTopProducts, getChannels } from './actions';
import { AvailableChannelCard } from './_components/available-channel-card';
import { ConnectedChannelRow } from './_components/connected-channel-row';
import { ChannelRevenuePanel, ChannelTopProductsPanel } from './_components/channel-revenue-panel';
import type { ChannelRevenueRow } from './_types';

export const dynamic = 'force-dynamic';

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; channel?: string }>;
}) {
  const { connected, error, channel: selectedChannel } = await searchParams;
  const [{ connections, catalog }, revenue] = await Promise.all([
    getChannels(),
    getChannelRevenue(),
  ]);
  const descriptorBySlug = new Map(catalog.map((c) => [c.slug, c]));
  const connectedSlugs = new Set(connections.map((c) => c.channel));
  const available = catalog.filter((c) => !connectedSlugs.has(c.slug));
  const connectedName = connected ? (descriptorBySlug.get(connected)?.name ?? connected) : null;

  // Per-channel 30-day metrics matched by derived key: a marketplace connection's
  // slug IS its derived channel key (docs/27 §9).
  const revenueByKey = new Map<string, ChannelRevenueRow>(
    (revenue?.byChannel ?? []).map((r) => [r.channel, r])
  );
  // Channel drill-down: top products on the selected channel (server-fetched only
  // when a `?channel=` is chosen from the comparison table).
  const topProducts = selectedChannel ? await getChannelTopProducts(selectedChannel) : null;

  return (
    // Channels surface Commerce functionality — tint the page with the Commerce
    // hue per the color-follows-functionality rule.
    <ModuleProvider module="commerce">
      <Container size="xl">
        <Stack gap={6} className="py-10">
          <PageHeader
            icon={<Store className="h-5 w-5" />}
            title="Sales channels"
            description="Connect the marketplaces and social platforms you already sell on — TikTok Shop, Etsy, Amazon, Meta, Google, and more. Your catalog, orders, and stock stay in sync from one place."
          />

          {connectedName && (
            <Alert
              color="success"
              variant="soft"
              icon={<CheckCircle2 />}
              title={`${connectedName} connected`}
            >
              Your catalog will start syncing to {connectedName} shortly.
            </Alert>
          )}
          {error && (
            <Alert color="danger" variant="soft" title="Couldn’t connect that channel">
              {error}
            </Alert>
          )}

          {connections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Connected ({connections.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Stack gap={2}>
                  {connections.map((c) => {
                    const m = revenueByKey.get(c.channel);
                    return (
                      <ConnectedChannelRow
                        key={c.id}
                        connection={c}
                        descriptor={descriptorBySlug.get(c.channel)}
                        metrics={
                          m
                            ? {
                                grossRevenueCents: m.grossRevenueCents,
                                orders: m.orders,
                                averageOrderValueCents: m.averageOrderValueCents,
                                currency: revenue?.currency ?? 'USD',
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          )}

          {revenue && revenue.byChannel.length > 0 && (
            <Card>
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
          )}

          {selectedChannel && topProducts && (
            <Card>
              <CardContent className="pt-6">
                <ChannelTopProductsPanel
                  label={channelKeyLabel(selectedChannel)}
                  products={topProducts}
                  currency={revenue?.currency ?? 'USD'}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Available channels</CardTitle>
            </CardHeader>
            <CardContent>
              {available.length === 0 ? (
                <Text size="sm" variant="muted">
                  Every available channel is connected.
                </Text>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {available.map((c) => (
                    <AvailableChannelCard key={c.slug} channel={c} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </ModuleProvider>
  );
}
