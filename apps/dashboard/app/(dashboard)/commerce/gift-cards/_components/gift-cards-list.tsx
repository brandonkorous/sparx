'use client';

import { Badge } from '@wizeworks/silicaui-react';
import {
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  statusLabel,
  statusTone,
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

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function recipientCell(card: GiftCardSummary) {
  return card.recipientEmail ? (
    <div className="flex flex-col gap-0">
      <p className="text-sm">{card.recipientName ?? '—'}</p>
      <p className="text-base-content/70 text-xs">{card.recipientEmail}</p>
    </div>
  ) : (
    <p className="text-base-content/70 text-xs">none</p>
  );
}

function statusBadge(card: GiftCardSummary) {
  return (
    <Badge color={statusTone(card.status)} variant="soft" size="sm">
      {statusLabel(card.status)}
    </Badge>
  );
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
        <p className="text-base-content/70 text-xs">
          {moneyFmt.format(c.initialBalanceCents / 100)}
        </p>
      ),
    },
    { header: 'Recipient', cell: recipientCell },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Expires',
      cell: (c) => <p className="text-base-content/70 text-xs">{expiresLabel(c)}</p>,
    },
  ];

  const card: SelectionCard<GiftCardSummary> = {
    title: (c) => <span className="truncate font-mono text-sm">{c.code}</span>,
    subtitle: (c) => (
      <p className="text-base-content/70 text-xs">
        {c.recipientEmail ? (c.recipientName ?? c.recipientEmail) : 'No recipient'}
      </p>
    ),
    badge: statusBadge,
    body: (c) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-sm tabular-nums">{moneyFmt.format(c.balanceCents / 100)}</p>
          <p className="text-base-content/70 text-xs tabular-nums">
            of {moneyFmt.format(c.initialBalanceCents / 100)}
          </p>
        </div>
        <p className="text-base-content/70 text-xs">Expires {expiresLabel(c)}</p>
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
