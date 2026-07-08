'use client';

// One available-channel card: name + shape + pitch + a Connect button. Until the
// channel's adapter ships, `availability` is 'coming_soon' and the button is
// disabled (docs/106 §6). When live, Connect calls the API and redirects the
// merchant to the channel's OAuth screen.

import * as React from 'react';
import Link from 'next/link';
import { Badge, Button } from 'silicaui-react';
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

  // sparx.market is a FIRST-PARTY channel — it has no OAuth connect flow. It's
  // managed on its own settings surface, so its card links straight there
  // instead of trying to "connect" (and is always live, regardless of the
  // catalog's OAuth-oriented `availability` flag).
  const isFirstParty = channel.shape === 'first_party';

  function onConnect() {
    setError(null);
    startTransition(async () => {
      const res = await connectChannelAction(channel.slug);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      window.location.href = res.data.url;
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border-default)] p-4">
      <div className="flex flex-row flex-wrap items-center gap-2">
        <p className="text-base font-medium">{channel.name}</p>
        <Badge variant="outline" className="text-xs">
          {SHAPE_LABEL[channel.shape]}
        </Badge>
        {comingSoon && !isFirstParty && (
          <Badge color="neutral" variant="soft" className="text-xs">
            Coming soon
          </Badge>
        )}
        {isFirstParty && (
          <Badge color="success" variant="soft" className="text-xs">
            Available
          </Badge>
        )}
      </div>
      <p className="text-base-content/70 text-sm">{channel.tagline}</p>
      <p className="text-base-content/70 text-xs">Best for: {channel.bestFor}</p>
      {error && (
        <p className="text-danger text-xs" role="alert">
          {error}
        </p>
      )}
      <div>
        {isFirstParty ? (
          <Button
            size="sm"
            variant="soft"
            color="primary"
            render={<Link href="/commerce/market" />}
          >
            Manage
          </Button>
        ) : (
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
        )}
      </div>
    </div>
  );
}
