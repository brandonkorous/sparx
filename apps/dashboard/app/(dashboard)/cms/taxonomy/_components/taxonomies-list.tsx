'use client';

import {
  Badge,
  Button,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  Stack,
  Text,
} from '@sparx/ui';
import { Pencil } from 'lucide-react';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the taxonomies list (docs/34 §7). SelectionList takes render
// functions (columns/card) that can't cross the server→client boundary, so the
// server page hands serializable rows + `view` here and this builds both views.
// Read-only at the list level — `selectable={false}` (no checkboxes / bulk bar);
// the name links into the term manager (EntityRowLink resolves the detail-view
// preference) and an explicit "Manage terms" action is preserved in both views.

export interface TaxonomyListItem {
  id: string;
  key: string;
  name: string;
  plural_name: string;
  hierarchical: boolean;
  term_count: number;
}

interface TaxonomiesListProps {
  rows: TaxonomyListItem[];
  view: 'table' | 'card';
}

export function TaxonomiesList({ rows, view }: TaxonomiesListProps) {
  const nameLink = (t: TaxonomyListItem, className: string) => (
    <EntityRowLink
      href={`/cms/taxonomy/${t.key}`}
      entityType="taxonomy"
      entityId={t.key}
      className={className}
    >
      {t.name}
    </EntityRowLink>
  );

  const kindBadge = (t: TaxonomyListItem) => (
    <Badge color="info" variant="soft" size="sm">
      {t.hierarchical ? 'hierarchical' : 'flat'}
    </Badge>
  );

  const manageButton = (t: TaxonomyListItem) => (
    <Button asChild variant="ghost" size="xs" leftIcon={<Pencil className="h-3 w-3" />}>
      <EntityRowLink href={`/cms/taxonomy/${t.key}`} entityType="taxonomy" entityId={t.key}>
        Manage terms
      </EntityRowLink>
    </Button>
  );

  const columns: SelectionColumn<TaxonomyListItem>[] = [
    {
      header: 'Name',
      cell: (t) => (
        <Stack gap={1} className="min-w-0">
          {nameLink(
            t,
            'truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline'
          )}
          <Text size="xs" variant="muted" className="truncate">
            <code>{t.key}</code>
          </Text>
        </Stack>
      ),
    },
    { header: 'Kind', cell: kindBadge },
    {
      header: 'Terms',
      align: 'right',
      cell: (t) => <Text size="sm">{t.term_count}</Text>,
    },
    {
      header: '',
      id: 'actions',
      align: 'right',
      cell: (t) => <div className="flex justify-end">{manageButton(t)}</div>,
    },
  ];

  const card: SelectionCard<TaxonomyListItem> = {
    title: (t) =>
      nameLink(t, 'truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline'),
    subtitle: (t) => (
      <Text size="xs" variant="muted">
        <code>{t.key}</code>
      </Text>
    ),
    badge: kindBadge,
    body: (t) => (
      <Stack direction="row" align="center" justify="between" gap={2}>
        <Text size="sm" variant="muted">
          {t.term_count} term{t.term_count === 1 ? '' : 's'}
        </Text>
        {manageButton(t)}
      </Stack>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(t) => t.id}
      getRowLabel={(t) => t.name}
      entityLabelPlural="taxonomies"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
