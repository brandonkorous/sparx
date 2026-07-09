'use client';

import Link from 'next/link';
import { type SelectionCard, type SelectionColumn, SelectionList } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the content-types browser. SelectionList takes render
// functions (columns/card) which can't cross the server→client boundary, so the
// server page hands serializable rows + a counts map + view and this builds both
// views. Read-only list (`selectable={false}` — no checkboxes / bulk bar). The
// type name + count link to that type's items (plain Link); the Schema action
// opens the identity/schema editor via EntityRowLink (honors detail-view pref).

interface ContentType {
  key: string;
  name: string;
  plural_name: string;
  url_pattern: string | null;
  is_built_in: boolean;
  is_singleton: boolean;
  description: string | null;
}

interface ContentTypesListProps {
  types: ContentType[];
  counts: Record<string, number>;
  view: 'table' | 'card';
}

export function ContentTypesList({ types, counts, view }: ContentTypesListProps) {
  const typeLink = (t: ContentType) => (
    <div className="flex flex-col gap-1">
      <Link
        href={`/cms/content?type=${t.key}`}
        className="hover:text-module text-sm font-medium hover:underline"
      >
        {t.plural_name}
      </Link>
      {t.description && (
        <p className="text-base-content/70 line-clamp-1 text-xs">{t.description}</p>
      )}
    </div>
  );

  const kindCell = (t: ContentType) => (
    <div className="flex flex-row items-center gap-2">
      <Badge color={t.is_built_in ? 'neutral' : 'module'} variant="soft" size="sm">
        {t.is_built_in ? 'built-in' : 'custom'}
      </Badge>
      {t.is_singleton && (
        <Badge color="info" variant="soft" size="sm">
          singleton
        </Badge>
      )}
    </div>
  );

  const urlCell = (t: ContentType) =>
    t.url_pattern ? (
      <p className="text-base-content/70 font-mono text-xs">{t.url_pattern}</p>
    ) : (
      <p className="text-base-content/70 text-xs">—</p>
    );

  const itemsLink = (t: ContentType) => (
    <Link href={`/cms/content?type=${t.key}`} className="hover:text-module hover:underline">
      {counts[t.key] ?? 0}
    </Link>
  );

  const schemaLink = (t: ContentType) => (
    <EntityRowLink
      href={`/cms/types/${t.key}`}
      entityType="content-type"
      entityId={t.key}
      className="text-base-content/70 hover:text-module text-xs hover:underline"
    >
      {t.is_built_in ? 'View' : 'Edit'}
    </EntityRowLink>
  );

  const columns: SelectionColumn<ContentType>[] = [
    { header: 'Type', cell: typeLink },
    { header: 'Kind', cell: kindCell },
    { header: 'URL pattern', cell: urlCell },
    {
      header: 'Items',
      align: 'right',
      cellClassName: 'tabular-nums',
      cell: itemsLink,
    },
    { header: 'Schema', align: 'right', cell: schemaLink },
  ];

  const card: SelectionCard<ContentType> = {
    title: (t) => (
      <Link
        href={`/cms/content?type=${t.key}`}
        className="hover:text-module truncate text-sm font-medium hover:underline"
      >
        {t.plural_name}
      </Link>
    ),
    subtitle: (t) =>
      t.description ? (
        <p className="text-base-content/70 line-clamp-1 text-xs">{t.description}</p>
      ) : null,
    badge: kindCell,
    body: (t) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">URL pattern</p>
          {urlCell(t)}
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">Items</p>
          <span className="text-sm tabular-nums">{itemsLink(t)}</span>
        </div>
        <div className="flex flex-row items-center justify-end gap-2">{schemaLink(t)}</div>
      </>
    ),
  };

  return (
    <SelectionList
      items={types}
      view={view}
      getId={(t) => t.key}
      getRowLabel={(t) => t.plural_name}
      selectable={false}
      entityLabelPlural="content types"
      columns={columns}
      card={card}
    />
  );
}
