'use client';

import Link from 'next/link';
import {
  Badge,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  Stack,
  Text,
} from '@sparx/ui';

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
    <Stack gap={1}>
      <Link
        href={`/cms/content?type=${t.key}`}
        className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
      >
        {t.plural_name}
      </Link>
      {t.description && (
        <Text size="xs" variant="muted" className="line-clamp-1">
          {t.description}
        </Text>
      )}
    </Stack>
  );

  const kindCell = (t: ContentType) => (
    <Stack direction="row" align="center" gap={2}>
      <Badge color={t.is_built_in ? 'outline' : 'module'} className="text-xs">
        {t.is_built_in ? 'built-in' : 'custom'}
      </Badge>
      {t.is_singleton && (
        <Badge variant="outline" className="text-xs">
          singleton
        </Badge>
      )}
    </Stack>
  );

  const urlCell = (t: ContentType) =>
    t.url_pattern ? (
      <Text size="xs" variant="muted" className="font-mono">
        {t.url_pattern}
      </Text>
    ) : (
      <Text size="xs" variant="muted">
        —
      </Text>
    );

  const itemsLink = (t: ContentType) => (
    <Link
      href={`/cms/content?type=${t.key}`}
      className="hover:text-[var(--module-active)] hover:underline"
    >
      {counts[t.key] ?? 0}
    </Link>
  );

  const schemaLink = (t: ContentType) => (
    <EntityRowLink
      href={`/cms/types/${t.key}`}
      entityType="content-type"
      entityId={t.key}
      className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--module-active)] hover:underline"
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
        className="truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline"
      >
        {t.plural_name}
      </Link>
    ),
    subtitle: (t) =>
      t.description ? (
        <Text size="xs" variant="muted" className="line-clamp-1">
          {t.description}
        </Text>
      ) : null,
    badge: kindCell,
    body: (t) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            URL pattern
          </Text>
          {urlCell(t)}
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            Items
          </Text>
          <span className="text-sm tabular-nums">{itemsLink(t)}</span>
        </Stack>
        <Stack direction="row" align="center" justify="end" gap={2}>
          {schemaLink(t)}
        </Stack>
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
