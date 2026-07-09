'use client';

import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

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
    <div className="flex min-w-0 flex-row items-center gap-2">
      <p className="truncate text-sm font-medium">{t.name}</p>
      {t.isDefault && (
        <Badge color="module" variant="soft" className="text-xs">
          Default
        </Badge>
      )}
    </div>
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
    <p className="text-base-content/70 text-sm">{new Date(t.updatedAt).toLocaleDateString()}</p>
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
      <div className="flex flex-row items-center justify-between gap-2">
        <p className="text-base-content/70 text-xs">
          Updated {new Date(t.updatedAt).toLocaleDateString()}
        </p>
        {actions(t)}
      </div>
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
