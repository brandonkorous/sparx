'use client';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Card,
  Stack,
  Text,
} from '@sparx/ui';

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
      cell: (r) => (
        <Text size="sm" variant="muted">
          {r.fixFirst ?? '—'}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<SeoAuditRow> = {
    title: rowLink,
    render: (r) => (
      <Card variant="default" padding="md">
        <Stack direction="row" gap={3} align="start">
          <SeoScoreBadge score={r.score} grade={r.grade} size={36} />
          <Stack gap={1} className="min-w-0 flex-1">
            {rowLink(r)}
            {r.fixFirst ? (
              <Text size="xs" variant="muted">
                Top fix: {r.fixFirst}
              </Text>
            ) : null}
          </Stack>
        </Stack>
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
