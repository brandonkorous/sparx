'use client';

import { Archive, Trash2, Zap } from 'lucide-react';
import {
  Badge,
  type BulkAction,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  Stack,
  Text,
} from '@sparx/ui';

import {
  bulkPublishEntriesAction,
  bulkArchiveEntriesAction,
  bulkDeleteEntriesAction,
} from '../../content-bulk-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';

export interface ApiEntry {
  id: string;
  type_key: string;
  slug: string | null;
  status: string;
  body: { title?: string; name?: string } & Record<string, unknown>;
  updated_at: string;
  published_at: string | null;
}

interface ContentSelectionTableProps {
  entries: ApiEntry[];
  view: 'table' | 'card';
  showType: boolean;
  typeName: Record<string, string>;
}

function entryTitle(e: ApiEntry): string {
  if (typeof e.body.title === 'string' && e.body.title) return e.body.title;
  if (typeof e.body.name === 'string' && e.body.name) return e.body.name;
  return e.slug ?? '(untitled)';
}

function entryHref(e: ApiEntry): string {
  return e.type_key === 'page' ? `/cms/${e.id}` : `/cms/types/${e.type_key}/${e.id}`;
}

function rowEntityType(e: ApiEntry): string {
  return e.type_key === 'page' ? 'page' : 'content-entry';
}

function rowEntityId(e: ApiEntry): string {
  return e.type_key === 'page' ? e.id : `${e.type_key}:${e.id}`;
}

export function ContentSelectionTable({
  entries,
  view,
  showType,
  typeName,
}: ContentSelectionTableProps) {
  const bulkActions: BulkAction[] = [
    {
      label: 'Publish',
      icon: Zap,
      onAction: async (ids) => {
        await bulkPublishEntriesAction(ids);
      },
    },
    {
      label: 'Archive',
      icon: Archive,
      onAction: async (ids) => {
        await bulkArchiveEntriesAction(ids);
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Delete {count} entr{count === 1 ? "y" : "ies"}? Revisions and media references are also removed. This cannot be undone.',
      onAction: async (ids) => {
        await bulkDeleteEntriesAction(ids);
      },
    },
  ];

  const statusBadge = (e: ApiEntry) => (
    <Badge color={e.status === 'published' ? 'success' : 'outline'} className="text-xs">
      {e.status}
    </Badge>
  );

  const typeBadge = (e: ApiEntry) => (
    <Badge color="module" variant="soft" className="text-xs">
      {typeName[e.type_key] ?? e.type_key}
    </Badge>
  );

  const titleCell = (e: ApiEntry, className: string) => (
    <Stack gap={1}>
      <EntityRowLink
        href={entryHref(e)}
        entityType={rowEntityType(e)}
        entityId={rowEntityId(e)}
        className={className}
      >
        {entryTitle(e)}
      </EntityRowLink>
      {e.slug && (
        <Text size="xs" variant="muted">
          /{e.slug}
        </Text>
      )}
    </Stack>
  );

  const columns: SelectionColumn<ApiEntry>[] = [
    {
      header: 'Title',
      cell: (e) =>
        titleCell(e, 'text-sm font-medium hover:text-[var(--module-active)] hover:underline'),
    },
    ...(showType ? [{ header: 'Type', cell: typeBadge } satisfies SelectionColumn<ApiEntry>] : []),
    { header: 'Status', cell: statusBadge },
    {
      header: 'Updated',
      cell: (e) => (
        <Text size="sm" variant="muted">
          {new Date(e.updated_at).toLocaleDateString()}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<ApiEntry> = {
    title: (e) =>
      titleCell(
        e,
        'truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline'
      ),
    badge: statusBadge,
    body: (e) => (
      <Stack direction="row" align="center" justify="between" gap={2}>
        {showType ? typeBadge(e) : <span />}
        <Text size="xs" variant="muted">
          {e.status === 'published' && e.published_at
            ? `Published ${new Date(e.published_at).toLocaleDateString()}`
            : `Updated ${new Date(e.updated_at).toLocaleDateString()}`}
        </Text>
      </Stack>
    ),
  };

  return (
    <SelectionList
      items={entries}
      view={view}
      getId={(e) => e.id}
      getRowLabel={entryTitle}
      entityLabelPlural="entries"
      columns={columns}
      card={card}
      bulkActions={bulkActions}
    />
  );
}
