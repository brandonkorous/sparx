'use client';

import {
  Badge,
  Card,
  SelectionList,
  Stack,
  Text,
  type SelectionCard,
  type SelectionColumn,
} from '@sparx/ui';

import { revokeMcpConnectionAction } from '../actions';
import { RevokeButton } from './revoke-button';

// Connected AI assistants (OAuth) — a fixed table (no view toggle; the API-key
// list below owns the page's `defaultListView`). Each connection can be revoked,
// cutting the assistant off immediately.

interface Connection {
  clientId: string;
  clientName: string | null;
  scopes: string[];
  tokenCount: number;
  firstAuthorizedAt: Date;
  lastAuthorizedAt: Date;
  accessExpiresAt: Date;
}

function displayName(c: Connection): string {
  const raw = c.clientName?.trim();
  return raw && raw.length > 0 ? raw : 'AI assistant';
}

// OIDC framing scopes aren't capabilities — show only capability scopes (`x:y`).
function capabilityScopes(c: Connection): string[] {
  return c.scopes.filter((s) => s.includes(':'));
}

function scopeBadges(scopes: string[]) {
  if (scopes.length === 0) {
    return (
      <Text size="xs" variant="muted">
        No capability scopes
      </Text>
    );
  }
  return (
    <Stack direction="row" gap={1} className="flex-wrap">
      {scopes.map((s) => (
        <Badge key={s} color="neutral" variant="soft" size="sm">
          <code>{s}</code>
        </Badge>
      ))}
    </Stack>
  );
}

function revokeButton(c: Connection) {
  return (
    <RevokeButton
      action={() => revokeMcpConnectionAction(c.clientId)}
      ariaLabel={`Revoke ${displayName(c)}`}
      confirmTitle={`Revoke “${displayName(c)}”?`}
      confirmDescription="This assistant will lose access immediately. Reconnecting requires signing in and approving scopes again."
      confirmLabel="Revoke access"
    />
  );
}

export function ConnectionsList({ connections }: { connections: Connection[] }) {
  const columns: SelectionColumn<Connection>[] = [
    {
      header: 'Assistant',
      cell: (c) => (
        <Stack direction="row" align="center" gap={2} className="min-w-0">
          <Text size="sm" weight="medium" className="truncate">
            {displayName(c)}
          </Text>
          <Badge color="success" variant="soft" size="sm">
            OAuth
          </Badge>
        </Stack>
      ),
    },
    { header: 'Scopes', cell: (c) => scopeBadges(capabilityScopes(c)) },
    {
      header: 'Connected',
      cell: (c) => (
        <Text size="sm" variant="muted">
          {c.firstAuthorizedAt.toLocaleDateString()}
        </Text>
      ),
    },
    { header: '', id: 'actions', align: 'right', cell: revokeButton },
  ];

  const card: SelectionCard<Connection> = {
    title: (c) => <Text weight="medium">{displayName(c)}</Text>,
    render: (c) => (
      <Card variant="default" padding="md">
        <Stack gap={2}>
          <Stack direction="row" align="start" justify="between" gap={2}>
            <Stack direction="row" align="center" gap={2} className="min-w-0">
              <Text weight="medium" className="truncate">
                {displayName(c)}
              </Text>
              <Badge color="success" variant="soft" size="sm">
                OAuth
              </Badge>
            </Stack>
            {revokeButton(c)}
          </Stack>
          {scopeBadges(capabilityScopes(c))}
          <Text size="xs" variant="muted">
            Connected {c.firstAuthorizedAt.toLocaleDateString()} · last authorized{' '}
            {c.lastAuthorizedAt.toLocaleString()}
          </Text>
        </Stack>
      </Card>
    ),
  };

  return (
    <SelectionList
      items={connections}
      view="table"
      getId={(c) => c.clientId}
      getRowLabel={displayName}
      entityLabelPlural="connections"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
