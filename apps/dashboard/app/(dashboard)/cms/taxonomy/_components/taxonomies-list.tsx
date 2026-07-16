'use client';

import { type SelectionCard, type SelectionColumn, SelectionList } from '@sparx/ui';
import { Badge, Button } from '@wizeworks/silicaui-react';
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
    <Button
      variant="ghost"
      size="xs"
      iconStart={<Pencil className="h-3 w-3" />}
      render={
        <EntityRowLink href={`/cms/taxonomy/${t.key}`} entityType="taxonomy" entityId={t.key} />
      }
    >
      Manage terms
    </Button>
  );

  const columns: SelectionColumn<TaxonomyListItem>[] = [
    {
      header: 'Name',
      cell: (t) => (
        <div className="flex min-w-0 flex-col gap-1">
          {nameLink(t, 'truncate text-sm font-medium hover:text-module hover:underline')}
          <p className="text-base-content truncate text-xs">
            <code>{t.key}</code>
          </p>
        </div>
      ),
    },
    { header: 'Kind', cell: kindBadge },
    {
      header: 'Terms',
      align: 'right',
      cell: (t) => <p className="text-sm">{t.term_count}</p>,
    },
    {
      header: '',
      id: 'actions',
      align: 'right',
      cell: (t) => <div className="flex justify-end">{manageButton(t)}</div>,
    },
  ];

  const card: SelectionCard<TaxonomyListItem> = {
    title: (t) => nameLink(t, 'truncate text-sm font-medium hover:text-module hover:underline'),
    subtitle: (t) => (
      <p className="text-base-content text-xs">
        <code>{t.key}</code>
      </p>
    ),
    badge: kindBadge,
    body: (t) => (
      <div className="flex flex-row items-center justify-between gap-2">
        <p className="text-base-content text-sm">
          {t.term_count} term{t.term_count === 1 ? '' : 's'}
        </p>
        {manageButton(t)}
      </div>
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
