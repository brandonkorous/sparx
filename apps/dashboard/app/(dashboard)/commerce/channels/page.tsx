// Commerce → Sales channels (docs/106) — connect the marketplaces and social
// platforms a tenant already sells on, and manage the connections. Channels are a
// Commerce capability (the API gates on it), so MANAGING them lives here in the
// Commerce module; the revenue ROLLUP (compare-by-channel + top-products drill) is
// the money view in Finance → Channels (docs/110 Slice 4b). This page keeps the
// lightweight per-connection 30-day metric and links across for the full breakdown.

import Link from 'next/link';
import { CheckCircle2, Store } from 'lucide-react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Card,
  CardBody,
  CardTitle,
} from '@wizeworks/silicaui-react';
import { ModuleProvider, PageHeader } from '@sparx/ui';

import { requireModuleOrUpsell } from '@/components/module-gate';

import { getChannelRevenue, getChannels } from './actions';
import { AvailableChannelCard } from './_components/available-channel-card';
import { ConnectedChannelRow } from './_components/connected-channel-row';
import type { ChannelRevenueRow } from './_types';

export const dynamic = 'force-dynamic';

export default async function CommerceChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}): Promise<React.JSX.Element> {
  const upsell = await requireModuleOrUpsell('commerce');
  if (upsell) return <>{upsell}</>;

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
    // Channels ARE Commerce functionality — tint the page with the Commerce hue
    // per the color-follows-functionality rule.
    <ModuleProvider module="commerce">
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <PageHeader
            icon={<Store className="h-5 w-5" />}
            title="Sales channels"
            description="Connect the marketplaces and social platforms you already sell on — TikTok Shop, Etsy, Amazon, Meta, Google, and more. Your catalog, orders, and stock stay in sync from one place."
          />

          {connectedName && (
            <Alert color="success" variant="soft">
              <CheckCircle2 />
              <AlertContent>
                <AlertTitle>{`${connectedName} connected`}</AlertTitle>
                <AlertDescription>
                  Your catalog will start syncing to {connectedName} shortly.
                </AlertDescription>
              </AlertContent>
            </Alert>
          )}
          {error && (
            <Alert color="danger" variant="soft">
              <AlertContent>
                <AlertTitle>Couldn’t connect that channel</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </AlertContent>
            </Alert>
          )}

          {connections.length > 0 && (
            <Card>
              <CardBody>
                <CardTitle>Connected ({connections.length})</CardTitle>
                <div className="flex flex-col gap-2">
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
                </div>
              </CardBody>
            </Card>
          )}

          {hasRevenue && (
            <p className="text-base-content text-sm">
              See the full revenue breakdown — gross, fees, net, and top products by channel — in{' '}
              <Link href="/finance/channels" className="text-module font-medium hover:underline">
                Finance → Channels
              </Link>
              .
            </p>
          )}

          <Card>
            <CardBody>
              <CardTitle>Available channels</CardTitle>
              {available.length === 0 ? (
                <p className="text-base-content text-sm">Every available channel is connected.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {available.map((c) => (
                    <AvailableChannelCard key={c.slug} channel={c} />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </ModuleProvider>
  );
}
