'use client';

import { SelectionList, type SelectionCard, type SelectionColumn, Badge, Text } from '@sparx/ui';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the Q&A moderation list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page maps rows + hands view here and this builds the views.
// Read-only — `selectable={false}` (no checkboxes / bulk bar); rows open the
// moderation detail via EntityRowLink in the user's detail-view surface.

export interface DisplayRow {
  id: string;
  productId: string;
  body: string;
  status: string;
  createdAt: string;
  authorLabel: string;
  productTitle: string | null;
  answerCount: number | null;
}

interface QaListProps {
  rows: DisplayRow[];
  view: 'table' | 'card';
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function StatusBadge({ status }: { status: string }) {
  const variant: 'success' | 'outline' | 'danger' =
    status === 'published' ? 'success' : status === 'rejected' ? 'danger' : 'outline';
  return <Badge color={variant}>{status}</Badge>;
}

export function QaList({ rows, view }: QaListProps) {
  const questionLink = (q: DisplayRow, className: string) => (
    <EntityRowLink
      href={`/commerce/qa/${q.id}`}
      entityType="qa-question"
      entityId={q.id}
      className={className}
    >
      {truncate(q.body, 80)}
    </EntityRowLink>
  );

  const productCell = (q: DisplayRow) => (
    <Text size="sm">
      {q.productTitle ?? <span className="font-mono text-xs">{q.productId.slice(0, 8)}</span>}
    </Text>
  );

  const columns: SelectionColumn<DisplayRow>[] = [
    { header: 'Question', cell: (q) => questionLink(q, 'hover:text-[var(--module-active)]') },
    { header: 'Product', cell: productCell },
    { header: 'Author', cell: (q) => <>{q.authorLabel}</> },
    { header: 'Answers', cell: (q) => <>{q.answerCount ?? '—'}</> },
    { header: 'Status', cell: (q) => <StatusBadge status={q.status} /> },
    { header: 'Asked', cell: (q) => <>{new Date(q.createdAt).toLocaleDateString()}</> },
  ];

  const card: SelectionCard<DisplayRow> = {
    title: (q) => questionLink(q, 'truncate hover:text-[var(--module-active)]'),
    subtitle: (q) => (
      <Text size="xs" variant="muted">
        {q.productTitle ?? q.productId.slice(0, 8)}
      </Text>
    ),
    badge: (q) => <StatusBadge status={q.status} />,
    body: (q) => (
      <Text size="xs" variant="muted">
        {q.authorLabel} · {q.answerCount ?? '—'} answer{q.answerCount === 1 ? '' : 's'} · asked{' '}
        {new Date(q.createdAt).toLocaleDateString()}
      </Text>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(q) => q.id}
      getRowLabel={(q) => truncate(q.body, 40)}
      entityLabelPlural="questions"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
