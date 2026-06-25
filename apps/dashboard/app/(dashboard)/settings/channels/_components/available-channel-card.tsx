'use client';

// One available-channel card: name + shape + pitch + a Connect button. Until the
// channel's adapter ships, `availability` is 'coming_soon' and the button is
// disabled (docs/106 §6). When live, Connect calls the API and redirects the
// merchant to the channel's OAuth screen.

import * as React from 'react';
import { Badge, Button, Stack, Text } from '@sparx/ui';
import { connectChannelAction } from '../actions';
import type { ChannelCatalogItem, ChannelShape } from '../_types';

const SHAPE_LABEL: Record<ChannelShape, string> = {
  order: 'Full sync',
  feed: 'Catalog feed',
  first_party: 'Marketplace',
};

export function AvailableChannelCard({ channel }: { channel: ChannelCatalogItem }) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const comingSoon = channel.availability !== 'available';

  function onConnect() {
    setError(null);
    startTransition(async () => {
      const res = await connectChannelAction(channel.slug);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      if (res.data.authUrl) window.location.href = res.data.authUrl;
    });
  }

  return (
    <Stack gap={2} className="rounded-md border border-[var(--color-border-default)] p-4">
      <Stack direction="row" align="center" gap={2} className="flex-wrap">
        <Text weight="medium">{channel.name}</Text>
        <Badge variant="outline" className="text-xs">
          {SHAPE_LABEL[channel.shape]}
        </Badge>
        {comingSoon && (
          <Badge color="neutral" variant="soft" className="text-xs">
            Coming soon
          </Badge>
        )}
      </Stack>
      <Text size="sm" variant="muted">
        {channel.tagline}
      </Text>
      <Text size="xs" variant="muted">
        Best for: {channel.bestFor}
      </Text>
      {error && (
        <Text size="xs" variant="danger" role="alert">
          {error}
        </Text>
      )}
      <div>
        <Button
          type="button"
          size="sm"
          variant="soft"
          color="primary"
          disabled={comingSoon || pending}
          loading={pending}
          onClick={onConnect}
        >
          {comingSoon ? 'Coming soon' : 'Connect'}
        </Button>
      </div>
    </Stack>
  );
}
