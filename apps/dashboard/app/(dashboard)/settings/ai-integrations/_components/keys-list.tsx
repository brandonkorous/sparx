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
    <Stack direction="row" gap={1} className="flex-wrap">
      {scopes.map((s) => (
        <Badge key={s} color="neutral" variant="soft" size="sm">
          <code>{s}</code>
        </Badge>
      ))}
    </Stack>
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
        <Stack gap={1} className="min-w-0">
          <Text size="sm" weight="medium" className="truncate">
            {k.name}
          </Text>
          <code className="text-xs text-[var(--color-text-muted)]">{k.keyPrefix}…</code>
        </Stack>
      ),
    },
    { header: 'Scopes', cell: (k) => scopeBadges(k.scopes) },
    {
      header: 'Last used',
      cell: (k) => (
        <Text size="sm" variant="muted">
          {k.lastUsedAt ? k.lastUsedAt.toLocaleDateString() : 'Never'}
        </Text>
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
    title: (k) => (
      <Text weight="medium" className="truncate">
        {k.name}
      </Text>
    ),
    render: (k) => {
      const s = keyStatus(k);
      return (
        <Card variant="default" padding="md">
          <Stack gap={2}>
            <Stack direction="row" align="start" justify="between" gap={2}>
              <Stack gap={1} className="min-w-0">
                <Text weight="medium" className="truncate">
                  {k.name}
                </Text>
                <code className="text-xs text-[var(--color-text-muted)]">{k.keyPrefix}…</code>
              </Stack>
              <Badge color={s.color} variant="soft">
                {s.label}
              </Badge>
            </Stack>
            {scopeBadges(k.scopes)}
            <Stack direction="row" align="center" justify="between" gap={2}>
              <Text size="xs" variant="muted">
                {k.lastUsedAt ? `Last used ${k.lastUsedAt.toLocaleDateString()}` : 'Never used'}
              </Text>
              {revokeButton(k)}
            </Stack>
          </Stack>
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
