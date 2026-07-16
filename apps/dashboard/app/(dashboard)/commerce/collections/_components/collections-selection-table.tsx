'use client';

import { Sparkles, Star, Trash2 } from 'lucide-react';
import {
  type BulkAction,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
} from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

import { bulkDeleteCollectionsAction } from '../../collection-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';

export interface CollectionSummary {
  id: string;
  name: string;
  handle: string;
  type: 'manual' | 'rules';
  productCount: number;
  featured: boolean;
  updatedAt: string;
}

interface CollectionsSelectionTableProps {
  collections: CollectionSummary[];
  view: 'table' | 'card';
}

export function CollectionsSelectionTable({ collections, view }: CollectionsSelectionTableProps) {
  const bulkActions: BulkAction[] = [
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Delete {count} collection{count === 1 ? "" : "s"}? Products are unlinked but not removed. This cannot be undone.',
      onAction: async (ids) => {
        await bulkDeleteCollectionsAction(ids);
      },
    },
  ];

  const typeBadge = (c: CollectionSummary) => (
    <Badge color={c.type === 'rules' ? 'module' : 'neutral'} variant="soft" size="sm">
      {c.type === 'rules' ? (
        <>
          <Sparkles className="mr-1 h-3 w-3" />
          rules
        </>
      ) : (
        'manual'
      )}
    </Badge>
  );

  const featuredBadge = (
    <Badge color="accent" variant="soft" size="sm">
      <Star className="mr-1 h-3 w-3" />
      featured
    </Badge>
  );

  const columns: SelectionColumn<CollectionSummary>[] = [
    {
      header: 'Name',
      cell: (c) => (
        <div className="flex flex-col gap-1">
          <div className="flex flex-row items-center gap-2">
            <EntityRowLink
              href={`/commerce/collections/${c.id}`}
              entityType="collection"
              entityId={c.id}
              className="hover:text-module text-sm font-medium hover:underline"
            >
              {c.name}
            </EntityRowLink>
            {c.featured && featuredBadge}
          </div>
          <p className="text-base-content text-xs">/{c.handle}</p>
        </div>
      ),
    },
    { header: 'Type', cell: typeBadge },
    {
      header: 'Products',
      align: 'right',
      cell: (c) => <p className="text-sm">{c.productCount}</p>,
    },
    {
      header: 'Updated',
      cell: (c) => (
        <p className="text-base-content text-sm">{new Date(c.updatedAt).toLocaleDateString()}</p>
      ),
    },
  ];

  const card: SelectionCard<CollectionSummary> = {
    title: (c) => (
      <EntityRowLink
        href={`/commerce/collections/${c.id}`}
        entityType="collection"
        entityId={c.id}
        className="hover:text-module truncate text-sm font-medium hover:underline"
      >
        {c.name}
      </EntityRowLink>
    ),
    subtitle: (c) => <p className="text-base-content text-xs">/{c.handle}</p>,
    badge: typeBadge,
    body: (c) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          {c.featured ? featuredBadge : <span />}
          <p className="text-sm tabular-nums">
            {c.productCount} product{c.productCount === 1 ? '' : 's'}
          </p>
        </div>
        <p className="text-base-content text-xs">
          updated {new Date(c.updatedAt).toLocaleDateString()}
        </p>
      </>
    ),
  };

  return (
    <SelectionList
      items={collections}
      view={view}
      getId={(c) => c.id}
      getRowLabel={(c) => c.name}
      entityLabelPlural="collections"
      columns={columns}
      card={card}
      bulkActions={bulkActions}
    />
  );
}
