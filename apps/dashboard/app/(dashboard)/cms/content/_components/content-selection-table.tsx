'use client';

import { Archive, Trash2, Zap } from 'lucide-react';
import {
  type BulkAction,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  statusLabel,
  statusTone,
} from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

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
      requiresConfirm: true,
      confirmLabel:
        'Archive {count} entries? They’ll be hidden from your site — restore them any time.',
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
    <Badge color={statusTone(e.status)} variant="soft" size="sm">
      {statusLabel(e.status)}
    </Badge>
  );

  const typeBadge = (e: ApiEntry) => (
    <Badge color="module" variant="soft" size="sm">
      {typeName[e.type_key] ?? e.type_key}
    </Badge>
  );

  const titleCell = (e: ApiEntry, className: string) => (
    <div className="flex flex-col gap-1">
      <EntityRowLink
        href={entryHref(e)}
        entityType={rowEntityType(e)}
        entityId={rowEntityId(e)}
        className={className}
      >
        {entryTitle(e)}
      </EntityRowLink>
      {e.slug && <p className="text-base-content text-xs">/{e.slug}</p>}
    </div>
  );

  const columns: SelectionColumn<ApiEntry>[] = [
    {
      header: 'Title',
      cell: (e) => titleCell(e, 'text-sm font-medium hover:text-module hover:underline'),
    },
    ...(showType ? [{ header: 'Type', cell: typeBadge } satisfies SelectionColumn<ApiEntry>] : []),
    { header: 'Status', cell: statusBadge },
    {
      header: 'Updated',
      cell: (e) => (
        <p className="text-base-content text-sm">{new Date(e.updated_at).toLocaleDateString()}</p>
      ),
    },
  ];

  const card: SelectionCard<ApiEntry> = {
    title: (e) => titleCell(e, 'truncate text-sm font-medium hover:text-module hover:underline'),
    badge: statusBadge,
    body: (e) => (
      <div className="flex flex-row items-center justify-between gap-2">
        {showType ? typeBadge(e) : <span />}
        <p className="text-base-content text-xs">
          {e.status === 'published' && e.published_at
            ? `Published ${new Date(e.published_at).toLocaleDateString()}`
            : `Updated ${new Date(e.updated_at).toLocaleDateString()}`}
        </p>
      </div>
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
