'use client';

import Link from 'next/link';
import { Check, Flag, Star, Trash2, X } from 'lucide-react';
import {
  Badge,
  type BulkAction,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  Stack,
  statusLabel,
  statusTone,
  Text,
} from '@sparx/ui';

import { bulkDeleteReviewsAction, bulkModerateReviewsAction } from '../../review-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the reviews moderation list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view here and this builds both views. Rows are
// selectable so a moderator can approve/flag/reject/delete a whole batch from
// the bulk bar; a single row still opens the full review via EntityRowLink.

interface ReviewCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface ReviewListRow {
  id: string;
  productId: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  verifiedPurchase: boolean;
  createdAt: string;
  productTitle?: string | null;
  productHandle?: string | null;
  customer?: ReviewCustomer | null;
  // Only present on the /pending endpoint:
  displayName?: string | null;
  customerId?: string | null;
}

interface ReviewsListProps {
  rows: ReviewListRow[];
  view: 'table' | 'card';
}

// Titles are optional on the storefront form, so most reviews have none. Lead
// with the title when present, otherwise a trimmed snippet of the body — never
// a blank, unclickable cell.
function reviewLabel(row: ReviewListRow): string {
  const title = row.title.trim();
  if (title) return title;
  const body = row.body.trim();
  if (!body) return 'Untitled review';
  return body.length > 60 ? `${body.slice(0, 60).trimEnd()}…` : body;
}

function authorLabel(row: ReviewListRow): string {
  if (row.displayName) return row.displayName;
  if (row.customer) {
    const full = `${row.customer.firstName ?? ''} ${row.customer.lastName ?? ''}`.trim();
    if (full) return full;
    if (row.customer.email) return row.customer.email;
    return 'Customer';
  }
  if (row.customerId) return 'Customer';
  return 'Anonymous';
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge color={statusTone(status)} variant="soft" size="sm">
      {statusLabel(status)}
    </Badge>
  );
}

function VerifiedBadge() {
  return (
    <Badge color="success" variant="soft" size="sm">
      Verified
    </Badge>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <Stack direction="row" gap={0} align="center">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={
            i <= value
              ? 'h-3.5 w-3.5 fill-[var(--module-active)] text-[var(--module-active)]'
              : 'h-3.5 w-3.5 text-[var(--color-text-muted)]'
          }
        />
      ))}
    </Stack>
  );
}

export function ReviewsList({ rows, view }: ReviewsListProps) {
  const bulkActions: BulkAction[] = [
    {
      label: 'Approve',
      icon: Check,
      onAction: async (ids) => {
        await bulkModerateReviewsAction(ids, 'approved');
      },
    },
    {
      label: 'Flag',
      icon: Flag,
      onAction: async (ids) => {
        await bulkModerateReviewsAction(ids, 'flagged');
      },
    },
    {
      label: 'Reject',
      icon: X,
      requiresConfirm: true,
      confirmLabel:
        'Reject {count} review{count === 1 ? "" : "s"}? They are hidden from the storefront.',
      onAction: async (ids) => {
        await bulkModerateReviewsAction(ids, 'rejected');
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel: 'Delete {count} review{count === 1 ? "" : "s"}? This cannot be undone.',
      onAction: async (ids) => {
        await bulkDeleteReviewsAction(ids);
      },
    },
  ];

  const titleLink = (r: ReviewListRow, className: string) => (
    <EntityRowLink
      href={`/commerce/reviews/${r.id}`}
      entityType="review"
      entityId={r.id}
      className={className}
    >
      {reviewLabel(r)}
    </EntityRowLink>
  );

  const productCell = (r: ReviewListRow) =>
    r.productTitle ? (
      <Link
        href={`/commerce/products/${r.productId}`}
        className="text-sm hover:text-[var(--module-active)] hover:underline"
      >
        {r.productTitle}
      </Link>
    ) : (
      <Text size="sm" variant="muted">
        Deleted product
      </Text>
    );

  const columns: SelectionColumn<ReviewListRow>[] = [
    { header: 'Rating', cell: (r) => <Stars value={r.rating} /> },
    { header: 'Review', cell: (r) => titleLink(r, 'hover:text-[var(--module-active)]') },
    { header: 'Product', cell: productCell },
    { header: 'Author', cell: (r) => authorLabel(r) },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Verified',
      cell: (r) =>
        r.verifiedPurchase ? (
          <VerifiedBadge />
        ) : (
          <Text size="xs" variant="muted">
            —
          </Text>
        ),
    },
    { header: 'Submitted', cell: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  const card: SelectionCard<ReviewListRow> = {
    title: (r) => titleLink(r, 'truncate hover:text-[var(--module-active)]'),
    subtitle: (r) => (
      <Stack direction="row" gap={2} align="center">
        <Stars value={r.rating} />
        {productCell(r)}
      </Stack>
    ),
    badge: (r) => <StatusBadge status={r.status} />,
    body: (r) => (
      <Stack direction="row" align="center" justify="between" gap={2}>
        <Text size="sm" variant="muted">
          {authorLabel(r)}
        </Text>
        <Stack direction="row" gap={2} align="center">
          {r.verifiedPurchase ? <VerifiedBadge /> : null}
          <Text size="xs" variant="muted">
            {new Date(r.createdAt).toLocaleDateString()}
          </Text>
        </Stack>
      </Stack>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(r) => r.id}
      getRowLabel={(r) => reviewLabel(r)}
      entityLabelPlural="reviews"
      columns={columns}
      card={card}
      bulkActions={bulkActions}
    />
  );
}
