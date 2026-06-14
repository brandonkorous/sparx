'use client';

import {
  Badge,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  Stack,
  Text,
} from '@sparx/ui';

// Client wrapper for the issued gift-cards list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view here and this builds both views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar). Issuing a card stays in the
// IssueGiftCardForm above the toolbar, not in this list.

export interface GiftCardSummary {
  id: string;
  code: string;
  balanceCents: number;
  initialBalanceCents: number;
  currency: string;
  status: string;
  expiresAt: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  createdAt: string;
}

interface GiftCardsListProps {
  cards: GiftCardSummary[];
  view: 'table' | 'card';
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline'> = {
  active: 'success',
  spent: 'outline',
  expired: 'warning',
  cancelled: 'warning',
};

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function recipientCell(card: GiftCardSummary) {
  return card.recipientEmail ? (
    <Stack gap={0}>
      <Text size="sm">{card.recipientName ?? '—'}</Text>
      <Text size="xs" variant="muted">
        {card.recipientEmail}
      </Text>
    </Stack>
  ) : (
    <Text size="xs" variant="muted">
      none
    </Text>
  );
}

function statusBadge(card: GiftCardSummary) {
  return <Badge color={STATUS_VARIANT[card.status] ?? 'outline'}>{card.status}</Badge>;
}

function expiresLabel(card: GiftCardSummary): string {
  return card.expiresAt ? new Date(card.expiresAt).toLocaleDateString() : 'never';
}

export function GiftCardsList({ cards, view }: GiftCardsListProps) {
  const columns: SelectionColumn<GiftCardSummary>[] = [
    { header: 'Code', cell: (c) => <span className="font-mono text-xs">{c.code}</span> },
    { header: 'Balance', cell: (c) => moneyFmt.format(c.balanceCents / 100) },
    {
      header: 'Initial',
      cell: (c) => (
        <Text size="xs" variant="muted">
          {moneyFmt.format(c.initialBalanceCents / 100)}
        </Text>
      ),
    },
    { header: 'Recipient', cell: recipientCell },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Expires',
      cell: (c) => (
        <Text size="xs" variant="muted">
          {expiresLabel(c)}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<GiftCardSummary> = {
    title: (c) => <span className="truncate font-mono text-sm">{c.code}</span>,
    subtitle: (c) => (
      <Text size="xs" variant="muted">
        {c.recipientEmail ? (c.recipientName ?? c.recipientEmail) : 'No recipient'}
      </Text>
    ),
    badge: statusBadge,
    body: (c) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" className="tabular-nums">
            {moneyFmt.format(c.balanceCents / 100)}
          </Text>
          <Text size="xs" variant="muted" className="tabular-nums">
            of {moneyFmt.format(c.initialBalanceCents / 100)}
          </Text>
        </Stack>
        <Text size="xs" variant="muted">
          Expires {expiresLabel(c)}
        </Text>
      </>
    ),
  };

  return (
    <SelectionList
      items={cards}
      view={view}
      getId={(c) => c.id}
      selectable={false}
      getRowLabel={(c) => c.code}
      entityLabelPlural="gift cards"
      columns={columns}
      card={card}
    />
  );
}
