'use client';

import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { Card, CardBody } from '@wizeworks/silicaui-react';

import { SeoScoreBadge } from '@/components/seo/seo-score';
import { ENTITY_LABEL, type SeoAuditRow } from '@/components/seo/types';
import { SeoRowLink } from './seo-row-link';

// Client wrapper for the SEO overview list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view here and this builds the views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar); rows open the full report via
// SeoRowLink in the user's detail-view surface.

interface SeoAuditListProps {
  rows: SeoAuditRow[];
  view: 'table' | 'card';
}

export function SeoAuditList({ rows, view }: SeoAuditListProps) {
  const rowLink = (r: SeoAuditRow) => (
    <SeoRowLink
      type={r.entityType}
      id={r.entityId}
      title={r.title ?? '(untitled)'}
      entityLabel={ENTITY_LABEL[r.entityType]}
      path={r.path}
    />
  );

  const columns: SelectionColumn<SeoAuditRow>[] = [
    { header: 'Score', cell: (r) => <SeoScoreBadge score={r.score} grade={r.grade} size={30} /> },
    { header: 'Page', cell: rowLink },
    {
      header: 'Top fix',
      cell: (r) => <p className="text-base-content/70 text-sm">{r.fixFirst ?? '—'}</p>,
    },
  ];

  const card: SelectionCard<SeoAuditRow> = {
    title: rowLink,
    render: (r) => (
      <Card>
        <CardBody>
          <div className="flex flex-row items-start gap-3">
            <SeoScoreBadge score={r.score} grade={r.grade} size={36} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {rowLink(r)}
              {r.fixFirst ? (
                <p className="text-base-content/70 text-xs">Top fix: {r.fixFirst}</p>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(r) => r.id}
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
