'use client';

import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

import { revokeApiKeyAction } from '../actions';
import { RevokeButton } from './revoke-button';

// The tenant's scoped API keys, on the shared `SelectionList` substrate
// (table/cards + the user's `defaultListView`). Active + revoked live in one
// list with a Status column instead of separate card sections. A key has nothing
// to edit — it's immutable, you revoke and reissue — so there's no detail view,
// just a Revoke action per active row.

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

type Tone = 'success' | 'warning' | 'danger';

function keyStatus(k: ApiKey): { label: string; color: Tone } {
  if (k.revokedAt) return { label: 'Revoked', color: 'danger' };
  if (k.expiresAt && k.expiresAt.getTime() < Date.now())
    return { label: 'Expired', color: 'warning' };
  return { label: 'Active', color: 'success' };
}

function scopeBadges(scopes: string[]) {
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

function revokeButton(k: ApiKey) {
  if (k.revokedAt) return null;
  return (
    <RevokeButton
      action={() => revokeApiKeyAction(k.id)}
      ariaLabel={`Revoke ${k.name}`}
      confirmTitle={`Revoke “${k.name}”?`}
      confirmDescription="Any integration using this key will stop working immediately."
      confirmLabel="Revoke key"
    />
  );
}

export function KeysList({ keys, view }: { keys: ApiKey[]; view: 'table' | 'card' }) {
  const columns: SelectionColumn<ApiKey>[] = [
    {
      header: 'Name',
      cell: (k) => (
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-sm font-medium">{k.name}</p>
          <code className="text-base-content text-xs">{k.keyPrefix}…</code>
        </div>
      ),
    },
    { header: 'Scopes', cell: (k) => scopeBadges(k.scopes) },
    {
      header: 'Last used',
      cell: (k) => (
        <p className="text-base-content text-sm">
          {k.lastUsedAt ? k.lastUsedAt.toLocaleDateString() : 'Never'}
        </p>
      ),
    },
    {
      header: 'Status',
      cell: (k) => {
        const s = keyStatus(k);
        return (
          <Badge color={s.color} variant="soft">
            {s.label}
          </Badge>
        );
      },
    },
    { header: '', id: 'actions', align: 'right', cell: revokeButton },
  ];

  const card: SelectionCard<ApiKey> = {
    title: (k) => <p className="truncate font-medium">{k.name}</p>,
    render: (k) => {
      const s = keyStatus(k);
      return (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-2">
              <div className="flex flex-row items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate font-medium">{k.name}</p>
                  <code className="text-base-content text-xs">{k.keyPrefix}…</code>
                </div>
                <Badge color={s.color} variant="soft">
                  {s.label}
                </Badge>
              </div>
              {scopeBadges(k.scopes)}
              <div className="flex flex-row items-center justify-between gap-2">
                <p className="text-base-content text-xs">
                  {k.lastUsedAt ? `Last used ${k.lastUsedAt.toLocaleDateString()}` : 'Never used'}
                </p>
                {revokeButton(k)}
              </div>
            </div>
          </CardBody>
        </Card>
      );
    },
  };

  return (
    <SelectionList
      items={keys}
      view={view}
      getId={(k) => k.id}
      getRowLabel={(k) => k.name}
      entityLabelPlural="keys"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
