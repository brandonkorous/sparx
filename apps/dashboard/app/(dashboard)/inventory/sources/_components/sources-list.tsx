'use client';

import Link from 'next/link';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
} from '@sparx/ui';

import { SourceActions } from './source-actions';

// Client wrapper for the inventory sources list. SelectionList takes render
// functions (columns/card) that can't cross the server→client boundary, so the
// server page hands serializable rows + view here and this builds both views.
// Read-only selection (`selectable={false}`, no bulk bar); each row carries the
// per-row SourceActions menu (sync / edit / remove).

interface InventorySource {
  id: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, string>;
  lastSyncAt: string | null;
  syncIntervalSec: number;
  notes: string | null;
  createdAt: string;
}

interface SourcesListProps {
  sources: InventorySource[];
  view: 'table' | 'card';
}

const TYPE_LABELS: Record<string, string> = {
  csv: 'CSV Feed',
  api: 'API',
};

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  paused: 'warning',
  error: 'danger',
};

function syncInterval(sec: number): string {
  if (sec === 0) return 'Manual';
  if (sec < 3600) return `Every ${sec / 60}m`;
  return `Every ${sec / 3600}h`;
}

export function SourcesList({ sources, view }: SourcesListProps) {
  const typeText = (s: InventorySource) => (
    <Text size="sm" className="text-[var(--color-muted-foreground)]">
      {TYPE_LABELS[s.type] ?? s.type}
    </Text>
  );

  const statusBadge = (s: InventorySource) => (
    <Badge color={STATUS_COLOR[s.status] ?? 'neutral'} variant="soft" size="sm">
      {s.status}
    </Badge>
  );

  const intervalText = (s: InventorySource) => (
    <Text size="sm" className="text-[var(--color-muted-foreground)]">
      {syncInterval(s.syncIntervalSec)}
    </Text>
  );

  const lastSyncText = (s: InventorySource) => (
    <Text size="sm" className="text-[var(--color-muted-foreground)]">
      {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleDateString() : 'Never'}
    </Text>
  );

  const nameLink = (s: InventorySource) => (
    <Link
      href={`/inventory/sources/${s.id}`}
      className="text-sm font-medium hover:text-[var(--module-active)]"
    >
      {s.name}
    </Link>
  );

  const columns: SelectionColumn<InventorySource>[] = [
    { header: 'Name', cell: nameLink },
    { header: 'Type', cell: typeText },
    { header: 'Status', cell: statusBadge },
    { header: 'Interval', cell: intervalText },
    { header: 'Last sync', cell: lastSyncText },
    {
      header: '',
      id: 'actions',
      headClassName: 'w-10',
      cellClassName: 'w-10',
      cell: (s) => <SourceActions source={s} />,
    },
  ];

  const card: SelectionCard<InventorySource> = {
    title: nameLink,
    subtitle: typeText,
    badge: statusBadge,
    body: (s) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          {intervalText(s)}
          {lastSyncText(s)}
        </Stack>
        <Stack direction="row" justify="end">
          <SourceActions source={s} />
        </Stack>
      </>
    ),
  };

  return (
    <SelectionList
      items={sources}
      view={view}
      getId={(s) => s.id}
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
