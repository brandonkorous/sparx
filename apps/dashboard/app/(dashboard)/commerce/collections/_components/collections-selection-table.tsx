'use client';

import { Sparkles, Star, Trash2 } from 'lucide-react';
import {
  Badge,
  type BulkAction,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  Stack,
  Text,
} from '@sparx/ui';

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
        <Stack gap={1}>
          <Stack direction="row" align="center" gap={2}>
            <EntityRowLink
              href={`/commerce/collections/${c.id}`}
              entityType="collection"
              entityId={c.id}
              className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
            >
              {c.name}
            </EntityRowLink>
            {c.featured && featuredBadge}
          </Stack>
          <Text size="xs" variant="muted">
            /{c.handle}
          </Text>
        </Stack>
      ),
    },
    { header: 'Type', cell: typeBadge },
    {
      header: 'Products',
      align: 'right',
      cell: (c) => <Text size="sm">{c.productCount}</Text>,
    },
    {
      header: 'Updated',
      cell: (c) => (
        <Text size="sm" variant="muted">
          {new Date(c.updatedAt).toLocaleDateString()}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<CollectionSummary> = {
    title: (c) => (
      <EntityRowLink
        href={`/commerce/collections/${c.id}`}
        entityType="collection"
        entityId={c.id}
        className="truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline"
      >
        {c.name}
      </EntityRowLink>
    ),
    subtitle: (c) => (
      <Text size="xs" variant="muted">
        /{c.handle}
      </Text>
    ),
    badge: typeBadge,
    body: (c) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          {c.featured ? featuredBadge : <span />}
          <Text size="sm" className="tabular-nums">
            {c.productCount} product{c.productCount === 1 ? '' : 's'}
          </Text>
        </Stack>
        <Text size="xs" variant="muted">
          updated {new Date(c.updatedAt).toLocaleDateString()}
        </Text>
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
