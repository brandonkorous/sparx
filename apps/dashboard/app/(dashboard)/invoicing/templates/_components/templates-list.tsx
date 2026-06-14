'use client';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
} from '@sparx/ui';

import { TemplateRowActions } from './template-row-actions';

// Client wrapper for the print-templates list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view here and this builds both views. Read-only
// for selection (`selectable={false}`), but each row keeps the
// TemplateRowActions island (preview / publish / make-default / delete).

export interface TemplateRow {
  id: string;
  name: string;
  isDefault: boolean;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

interface TemplatesListProps {
  rows: TemplateRow[];
  view: 'table' | 'card';
}

export function TemplatesList({ rows, view }: TemplatesListProps) {
  const name = (t: TemplateRow) => (
    <Stack direction="row" align="center" gap={2} className="min-w-0">
      <Text size="sm" className="truncate font-medium">
        {t.name}
      </Text>
      {t.isDefault && (
        <Badge color="module" variant="soft" className="text-xs">
          Default
        </Badge>
      )}
    </Stack>
  );

  const statusBadge = (t: TemplateRow) =>
    t.published ? (
      <Badge color="success" variant="soft" className="text-xs">
        Published
      </Badge>
    ) : (
      <Badge color="neutral" variant="soft" className="text-xs">
        Draft
      </Badge>
    );

  const updated = (t: TemplateRow) => (
    <Text size="sm" variant="muted">
      {new Date(t.updatedAt).toLocaleDateString()}
    </Text>
  );

  const actions = (t: TemplateRow) => (
    <TemplateRowActions id={t.id} name={t.name} isDefault={t.isDefault} published={t.published} />
  );

  const columns: SelectionColumn<TemplateRow>[] = [
    { header: 'Name', cell: name },
    { header: 'Status', cell: statusBadge },
    { header: 'Updated', cell: updated },
    { header: 'Actions', cell: actions, align: 'right' },
  ];

  const card: SelectionCard<TemplateRow> = {
    title: name,
    badge: statusBadge,
    body: (t) => (
      <Stack direction="row" align="center" justify="between" gap={2}>
        <Text size="xs" variant="muted">
          Updated {new Date(t.updatedAt).toLocaleDateString()}
        </Text>
        {actions(t)}
      </Stack>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(t) => t.id}
      selectable={false}
      entityLabelPlural="templates"
      getRowLabel={(t) => t.name}
      columns={columns}
      card={card}
    />
  );
}
