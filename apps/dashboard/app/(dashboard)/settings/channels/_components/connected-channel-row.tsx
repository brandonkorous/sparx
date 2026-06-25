'use client';

// One connected-channel row: name + status + sync summary + Disconnect. Disconnect
// is destructive (it drops the connection and its product links — listings already
// on the channel are not deleted), so it goes behind useConfirm naming the target
// and the count loss (the platform destructive-action rule).

import * as React from 'react';
import { Badge, Button, Stack, Text, statusTone, useConfirm } from '@sparx/ui';
import { disconnectChannelAction } from '../actions';
import type { ChannelCatalogItem, ChannelConnectionView } from '../_types';

interface Props {
  connection: ChannelConnectionView;
  descriptor?: ChannelCatalogItem;
}

export function ConnectedChannelRow({ connection, descriptor }: Props) {
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
    <Stack
      direction="row"
      align="center"
      gap={3}
      className="rounded-md border border-[var(--color-border-default)] p-3"
    >
      <Stack gap={1} className="flex-1">
        <Stack direction="row" align="center" gap={2}>
          <Text weight="medium">{name}</Text>
          <Badge color={statusTone(connection.status)} variant="soft" className="text-xs">
            {connection.status}
          </Badge>
        </Stack>
        <Text size="xs" variant="muted">
          {connection.shopName ? `${connection.shopName} · ` : ''}
          {links} product{links === 1 ? '' : 's'} linked
          {connection.lastSyncedAt
            ? ` · last synced ${new Date(connection.lastSyncedAt).toLocaleString()}`
            : ' · not synced yet'}
        </Text>
        {error && (
          <Text size="xs" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </Stack>
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
    </Stack>
  );
}
