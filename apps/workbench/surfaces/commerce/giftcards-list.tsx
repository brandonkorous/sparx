'use client';

// The gift cards list.
//
// A gift card is money with a code on it, so the two facts this list leads with
// are exactly those: the code, and how much is left on it. Who it was for and
// whether it can still be spent come next.

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, SearchInput, Text } from '@wizeworks/silicaui-react';
import { Plus, Ticket } from 'lucide-react';
import { useQuery } from '@sparx/query';
import { api } from '../../lib/api/client';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { formatCents } from './products-data';
import { giftCardState, type GiftCardRow } from './giftcards-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function recipientLabel(row: GiftCardRow): string | null {
  const name = row.recipientName?.trim();
  if (name) return name;
  const email = row.recipientEmail?.trim();
  return email || null;
}

export function GiftCardsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['commerce', 'gift-cards', 'list', { q: search }],
    queryFn: () =>
      api.list<GiftCardRow>('/v1/commerce/gift-cards', {
        ...(search.trim() ? { q: search.trim() } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });

  const rows = data?.items ?? [];

  const open = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.giftcard.detail', { id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Gift card list controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search gift cards"
            placeholder="Search by code or recipient…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          title="Issue a gift card — hold Shift to open alongside, Alt for a new window"
          onClick={(event) => {
            ctx.open('commerce.giftcard.detail', { id: 'new' }, { target: targetFor(event) });
          }}
        >
          <Plus className="size-4" aria-hidden />
          Issue a gift card
        </Button>
        <RefreshButton
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      </PaneToolbar>

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <EmptyState
            title="Could not load your gift cards"
            description="Something went wrong reaching the server. It may be temporary — try again in a moment."
          />
        ) : isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Ticket className="size-6" aria-hidden />}
            title={search.trim() ? 'Nothing matches that search' : 'No gift cards yet'}
            description={
              search.trim()
                ? 'Try a different word, or clear the search box to see everything.'
                : 'A gift card lets someone pre-pay an amount for another person to spend with you. Issue your first one to get started.'
            }
          />
        ) : (
          <ul className="flex flex-col p-1">
            {rows.map((row) => {
              const state = giftCardState(row.status);
              const who = recipientLabel(row);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className="hover:bg-base-200 flex w-full flex-wrap items-center gap-2 rounded px-2 py-2 text-left"
                    onClick={(event) => {
                      open(row.id, event);
                    }}
                  >
                    <span className="shrink-0 font-mono font-semibold">{row.code}</span>
                    {who ? (
                      <Text as="span" className="min-w-0 flex-1 truncate text-sm">
                        {who}
                      </Text>
                    ) : (
                      <span className="min-w-0 flex-1" />
                    )}
                    <Text as="span" className="shrink-0 font-semibold tabular-nums">
                      {formatCents(row.balanceCents, row.currency)}
                    </Text>
                    <Badge color={state.tone} variant="soft" size="sm">
                      {state.label}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="shrink-0 px-1 text-xs">
        Click to open · Shift-click to open alongside · Alt-click to open in a new window
      </p>
    </div>
  );
}
