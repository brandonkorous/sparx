'use client';

// One connected-channel row: name + status + sync summary + Disconnect. Disconnect
// is destructive (it drops the connection and its product links — listings already
// on the channel are not deleted), so it goes behind useConfirm naming the target
// and the count loss (the platform destructive-action rule).

import * as React from 'react';
import { Badge, Button } from 'silicaui-react';
import { statusTone, useConfirm } from '@sparx/ui';
import { disconnectChannelAction } from '../actions';
import type { ChannelCatalogItem, ChannelConnectionView } from '../_types';

/** The connected channel's last-30-day performance, matched from the channel
 *  revenue report by derived key (docs/27 §9). Absent until it has sales. */
export interface ChannelRowMetrics {
  grossRevenueCents: number;
  orders: number;
  averageOrderValueCents: number;
  currency: string;
}

interface Props {
  connection: ChannelConnectionView;
  descriptor?: ChannelCatalogItem;
  metrics?: ChannelRowMetrics;
}

function fmtCents(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function ConnectedChannelRow({ connection, descriptor, metrics }: Props) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const name = descriptor?.name ?? connection.channel;
  const links = connection.mappingCount;

  async function onDisconnect() {
    const ok = await confirm({
      title: `Disconnect ${name}?`,
      description: `This removes the connection and its ${links} product link${links === 1 ? '' : 's'}. Listings already on ${name} are not deleted.`,
      confirmLabel: 'Disconnect',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await disconnectChannelAction(connection.channel);
      if (!res.ok) setError(res.error.message);
    });
  }

  return (
    <div className="flex flex-row items-center gap-3 rounded-md border border-[var(--color-border-default)] p-3">
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-row items-center gap-2">
          <p className="text-base font-medium">{name}</p>
          <Badge color={statusTone(connection.status)} variant="soft" className="text-xs">
            {connection.status}
          </Badge>
        </div>
        <p className="text-base-content/70 text-xs">
          {connection.shopName ? `${connection.shopName} · ` : ''}
          {links} product{links === 1 ? '' : 's'} linked
          {connection.lastSyncedAt
            ? ` · last synced ${new Date(connection.lastSyncedAt).toLocaleString()}`
            : ' · not synced yet'}
        </p>
        {metrics && metrics.orders > 0 && (
          <p className="text-base-content/70 text-xs">
            Last 30 days · {fmtCents(metrics.grossRevenueCents, metrics.currency)} ·{' '}
            {metrics.orders.toLocaleString()} order{metrics.orders === 1 ? '' : 's'} ·{' '}
            {fmtCents(metrics.averageOrderValueCents, metrics.currency)} AOV
          </p>
        )}
        {error && (
          <p className="text-danger text-xs" role="alert">
            {error}
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => void onDisconnect()}
        disabled={pending}
        loading={pending}
        aria-label={`Disconnect ${name}`}
      >
        Disconnect
      </Button>
    </div>
  );
}
