'use client';

import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

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
    return <p className="text-base-content text-xs">No capability scopes</p>;
  }
  return (
    <div className="flex flex-row flex-wrap gap-1">
      {scopes.map((s) => (
        <Badge key={s} color="neutral" variant="soft" size="sm">
          <code>{s}</code>
        </Badge>
      ))}
    </div>
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
        <div className="flex min-w-0 flex-row items-center gap-2">
          <p className="truncate text-sm font-medium">{displayName(c)}</p>
          <Badge color="success" variant="soft" size="sm">
            OAuth
          </Badge>
        </div>
      ),
    },
    { header: 'Scopes', cell: (c) => scopeBadges(capabilityScopes(c)) },
    {
      header: 'Connected',
      cell: (c) => (
        <p className="text-base-content text-sm">{c.firstAuthorizedAt.toLocaleDateString()}</p>
      ),
    },
    { header: '', id: 'actions', align: 'right', cell: revokeButton },
  ];

  const card: SelectionCard<Connection> = {
    title: (c) => <p className="font-medium">{displayName(c)}</p>,
    render: (c) => (
      <Card>
        <CardBody>
          <div className="flex flex-col gap-2">
            <div className="flex flex-row items-start justify-between gap-2">
              <div className="flex min-w-0 flex-row items-center gap-2">
                <p className="truncate font-medium">{displayName(c)}</p>
                <Badge color="success" variant="soft" size="sm">
                  OAuth
                </Badge>
              </div>
              {revokeButton(c)}
            </div>
            {scopeBadges(capabilityScopes(c))}
            <p className="text-base-content text-xs">
              Connected {c.firstAuthorizedAt.toLocaleDateString()} · last authorized{' '}
              {c.lastAuthorizedAt.toLocaleString()}
            </p>
          </div>
        </CardBody>
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
