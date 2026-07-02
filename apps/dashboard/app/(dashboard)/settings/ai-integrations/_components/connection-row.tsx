'use client';

// One connected AI assistant (OAuth) — client name + granted scopes + when it
// was authorized, with a revoke button that cuts it off immediately.

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Badge, Button, Stack, Text, useConfirm } from '@sparx/ui';

import { revokeMcpConnectionAction } from '../actions';

export interface ConnectionRowProps {
  connection: {
    clientId: string;
    clientName: string | null;
    scopes: string[];
    tokenCount: number;
    firstAuthorizedAt: Date;
    lastAuthorizedAt: Date;
    accessExpiresAt: Date;
  };
}

export function ConnectionRow({ connection }: ConnectionRowProps) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const rawName = connection.clientName?.trim();
  const name = rawName?.length ? rawName : 'AI assistant';
  // OIDC framing scopes aren't capabilities — hide them from the row.
  const shownScopes = connection.scopes.filter((s) => s.includes(':'));

  async function onRevoke() {
    const ok = await confirm({
      title: `Revoke "${name}"?`,
      description:
        'This assistant will lose access immediately. Reconnecting requires signing in and approving scopes again.',
      confirmLabel: 'Revoke access',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await revokeMcpConnectionAction(connection.clientId);
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
          <Badge color="success" variant="soft" size="sm">
            OAuth
          </Badge>
        </Stack>
        <Stack direction="row" align="center" gap={2} className="flex-wrap">
          {shownScopes.length === 0 ? (
            <Text size="xs" variant="muted">
              No capability scopes
            </Text>
          ) : (
            shownScopes.map((s) => (
              <Badge key={s} color="neutral" variant="soft" size="sm">
                <code>{s}</code>
              </Badge>
            ))
          )}
        </Stack>
        <Text size="xs" variant="muted">
          Connected {connection.firstAuthorizedAt.toLocaleDateString()} · last authorized{' '}
          {connection.lastAuthorizedAt.toLocaleString()}
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
        onClick={() => void onRevoke()}
        disabled={pending}
        loading={pending}
        aria-label={`Revoke ${name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </Stack>
  );
}
