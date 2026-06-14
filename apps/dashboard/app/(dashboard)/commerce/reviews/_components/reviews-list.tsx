'use client';

import { Star } from 'lucide-react';
import {
  Badge,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  Stack,
  Text,
} from '@sparx/ui';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the reviews moderation list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view here and this builds both views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar); rows open the full review via
// EntityRowLink in the user's detail-view surface.

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

function authorLabel(row: ReviewListRow): string {
  if (row.displayName) return row.displayName;
  if (row.customer) {
    const full = `${row.customer.firstName ?? ''} ${row.customer.lastName ?? ''}`.trim();
    if (full) return full;
    if (row.customer.email) return row.customer.email;
    return 'Customer';
  }
  if (row.customerId) return 'Customer';
  return 'Anon';
}

function StatusBadge({ status }: { status: string }) {
  const variant: 'success' | 'warning' | 'outline' | 'danger' =
    status === 'approved'
      ? 'success'
      : status === 'flagged'
        ? 'warning'
        : status === 'rejected'
          ? 'danger'
          : 'outline';
  return <Badge color={variant}>{status}</Badge>;
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
  const titleLink = (r: ReviewListRow, className: string) => (
    <EntityRowLink
      href={`/commerce/reviews/${r.id}`}
      entityType="review"
      entityId={r.id}
      className={className}
    >
      {r.title}
    </EntityRowLink>
  );

  const productCell = (r: ReviewListRow) => (
    <Text size="sm">
      {r.productTitle ?? <span className="font-mono text-xs">{r.productId.slice(0, 8)}</span>}
    </Text>
  );

  const verifiedCell = (r: ReviewListRow) =>
    r.verifiedPurchase ? (
      <Badge color="success">verified</Badge>
    ) : (
      <Text size="xs" variant="muted">
        —
      </Text>
    );

  const columns: SelectionColumn<ReviewListRow>[] = [
    { header: 'Rating', cell: (r) => <Stars value={r.rating} /> },
    { header: 'Title', cell: (r) => titleLink(r, 'hover:text-[var(--module-active)]') },
    { header: 'Product', cell: productCell },
    { header: 'Author', cell: (r) => authorLabel(r) },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Verified', cell: verifiedCell },
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
          {r.verifiedPurchase ? <Badge color="success">verified</Badge> : null}
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
      selectable={false}
      getRowLabel={(r) => r.title}
      entityLabelPlural="reviews"
      columns={columns}
      card={card}
    />
  );
}
