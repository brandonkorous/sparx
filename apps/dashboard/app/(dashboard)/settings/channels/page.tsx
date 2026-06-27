// Channels settings (docs/106) — connect the marketplaces and social platforms a
// tenant already sells on, and manage the connections. Server component fetches
// the connections + the available channel catalog; the connect/disconnect client
// bits live in ./_components. Channels are part of Commerce (the API gates on it).
// The revenue ROLLUP (compare-by-channel + top-products drill) lives in Finance →
// Channels (docs/110 Slice 4b); this page keeps the lightweight per-connection
// 30-day metric and links across for the full breakdown.

import Link from 'next/link';
import { CheckCircle2, Store } from 'lucide-react';
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

import { getChannelRevenue, getChannels } from './actions';
import { AvailableChannelCard } from './_components/available-channel-card';
import { ConnectedChannelRow } from './_components/connected-channel-row';
import type { ChannelRevenueRow } from './_types';

export const dynamic = 'force-dynamic';

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const [{ connections, catalog }, revenue] = await Promise.all([
    getChannels(),
    getChannelRevenue(),
  ]);
  const descriptorBySlug = new Map(catalog.map((c) => [c.slug, c]));
  const connectedSlugs = new Set(connections.map((c) => c.channel));
  const available = catalog.filter((c) => !connectedSlugs.has(c.slug));
  const connectedName = connected ? (descriptorBySlug.get(connected)?.name ?? connected) : null;

  // Per-channel 30-day metrics matched by derived key: a marketplace connection's
  // slug IS its derived channel key (docs/27 §9). Kept here as connection-health
  // context; the full compare-and-drill rollup is in Finance → Channels.
  const revenueByKey = new Map<string, ChannelRevenueRow>(
    (revenue?.byChannel ?? []).map((r) => [r.channel, r])
  );
  const hasRevenue = (revenue?.byChannel.length ?? 0) > 0;

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

          {hasRevenue && (
            <Text size="sm" variant="muted">
              See the full revenue breakdown — gross, fees, net, and top products by channel — in{' '}
              <Link
                href="/finance/channels"
                className="font-medium text-[var(--module-active-text)] hover:underline"
              >
                Finance → Channels
              </Link>
              .
            </Text>
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
