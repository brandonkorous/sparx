'use client';

import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { Badge } from 'silicaui-react';
import {
  SelectionList,
  type BulkAction,
  type SelectionCard,
  type SelectionColumn,
  statusLabel,
  statusTone,
} from '@sparx/ui';

import { bulkModerateQuestionsAction } from '../../review-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the Q&A moderation list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page maps rows + hands view here and this builds the views. Rows
// are selectable so a moderator can publish/reject a whole batch from the bulk
// bar; a single row opens the moderation detail via EntityRowLink.

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
  return (
    <Badge color={statusTone(status)} variant="soft" size="sm">
      {statusLabel(status)}
    </Badge>
  );
}

export function QaList({ rows, view }: QaListProps) {
  const bulkActions: BulkAction[] = [
    {
      label: 'Publish',
      icon: Check,
      onAction: async (ids) => {
        await bulkModerateQuestionsAction(ids, 'published');
      },
    },
    {
      label: 'Reject',
      icon: X,
      requiresConfirm: true,
      confirmLabel:
        'Reject {count} question{count === 1 ? "" : "s"}? They stay off the storefront.',
      onAction: async (ids) => {
        await bulkModerateQuestionsAction(ids, 'rejected');
      },
    },
  ];

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

  const productCell = (q: DisplayRow) =>
    q.productTitle ? (
      <Link
        href={`/commerce/products/${q.productId}`}
        className="text-sm hover:text-[var(--module-active)] hover:underline"
      >
        {q.productTitle}
      </Link>
    ) : (
      <p className="text-base-content/70 text-sm">Deleted product</p>
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
      <p className="text-base-content/70 text-xs">{q.productTitle ?? 'Deleted product'}</p>
    ),
    badge: (q) => <StatusBadge status={q.status} />,
    body: (q) => (
      <p className="text-base-content/70 text-xs">
        {q.authorLabel} · {q.answerCount ?? '—'} answer{q.answerCount === 1 ? '' : 's'} · asked{' '}
        {new Date(q.createdAt).toLocaleDateString()}
      </p>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(q) => q.id}
      getRowLabel={(q) => truncate(q.body, 40)}
      entityLabelPlural="questions"
      columns={columns}
      card={card}
      bulkActions={bulkActions}
    />
  );
}
