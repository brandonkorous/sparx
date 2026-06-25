// Channels settings (docs/106) — connect the marketplaces and social platforms a
// tenant already sells on, and manage the connections. Server component fetches
// the connections + the available channel catalog; the connect/disconnect client
// bits live in ./_components. Channels are part of Commerce (the API gates on it).

import { Store } from 'lucide-react';
import {
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

import { getChannels } from './actions';
import { AvailableChannelCard } from './_components/available-channel-card';
import { ConnectedChannelRow } from './_components/connected-channel-row';

export const dynamic = 'force-dynamic';

export default async function ChannelsPage() {
  const { connections, catalog } = await getChannels();
  const descriptorBySlug = new Map(catalog.map((c) => [c.slug, c]));
  const connectedSlugs = new Set(connections.map((c) => c.channel));
  const available = catalog.filter((c) => !connectedSlugs.has(c.slug));

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

          {connections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Connected ({connections.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Stack gap={2}>
                  {connections.map((c) => (
                    <ConnectedChannelRow
                      key={c.id}
                      connection={c}
                      descriptor={descriptorBySlug.get(c.channel)}
                    />
                  ))}
                </Stack>
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
