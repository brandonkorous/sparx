'use client';

// Wholesale groups — the named sets of businesses you charge the same way.
//
// A group is a discount you set once and give to everyone in it, so the list
// shows the two things that tell groups apart: what it takes off, and how many
// businesses are in it. A group is a one-line idea, so it is a row per group,
// not a wide table inventing columns to fill.
//
// It was called "Wholesale prices", one letter from the product panel's
// "Wholesale price" and stacked under the same Sell heading in the launcher.
// Issue 740.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Badge, Button, Card, EmptyState, SearchInput, Text } from '@wizeworks/silicaui-react';
import { faDollarSign, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { discountSummary, formatCents, useTiers, type TierRow } from './pricing-tiers-data';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'b2b';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function PricingTiersListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useTiers({
    q: search.trim(),
    take: 100,
    skip: 0,
  });

  const rows = data?.items ?? [];
  const narrowed = search.trim() !== '';

  const open = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('b2b.pricing-tier.detail', { id }, { target: targetFor(event) });
  };
  // ONE object, two places: the toolbar's button and the empty state's
  // invitation. Split, the label drifts — and the first-run state used to
  // have no button at all, so "Add your first one" pointed at nothing.
  const createFirst = {
    label: 'Add a wholesale group',
    onClick: (event: { shiftKey: boolean; altKey: boolean }) => {
      ctx.open('b2b.pricing-tier.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Wholesale groups controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search wholesale groups"
              placeholder="Search wholesale groups…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        }
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            title="Add a wholesale group: hold Shift to open alongside, Alt for a new window"
            onClick={createFirst.onClick}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            {createFirst.label}
          </Button>
        }
        views={{
          target: '/b2b/pricing-tiers',
          params: { q: search.trim() },
          onApply: (next) => {
            setSearch(next.q ?? '');
          },
        }}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-y-auto p-2">
        {isError ? (
          <EmptyState
            icon={<Icon glyph={faDollarSign} className="size-6" aria-hidden />}
            title="Could not load your wholesale groups"
            description="This is a problem reaching the server. Your groups are unaffected. Nothing has been lost."
          />
        ) : isPending ? (
          <PaneWaiting />
        ) : rows.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={narrowed}
            noResults={{
              icon: <Icon glyph={faDollarSign} className="size-6" aria-hidden />,
              title: 'No groups match that',
              description: 'Try a different word, or clear the search to see every group.',
            }}
            firstRun={{
              title: 'No wholesale groups yet',
              description:
                'A wholesale group is a set of businesses you charge the same way. Give the group a discount once and every business in it gets it. Add your first one, then put businesses in it.',
              action: createFirst,
            }}
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map((row) => (
              <TierRowItem key={row.id} row={row} onOpen={open} />
            ))}
          </ul>
        )}
      </Card>

      {rows.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}

function TierRowItem({
  row,
  onOpen,
}: {
  row: TierRow;
  onOpen: (id: string, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  // "Businesses", not "accounts": this console has a Money app, and an account
  // there is a ledger. The screen was renamed off that word and the row was left
  // saying it. [[feedback_a_fix_leaves_its_neighbour_behind]]
  const memberLabel =
    row.accountCount === undefined
      ? null
      : row.accountCount === 1
        ? '1 business'
        : `${String(row.accountCount)} businesses`;

  return (
    <li>
      <button
        type="button"
        className="hover:bg-base-200 flex w-full items-center gap-3 rounded p-3 text-left"
        onClick={(event) => {
          onOpen(row.id, event);
        }}
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{row.name}</span>
          {row.description ? (
            <Text as="span" className="block truncate text-sm">
              {row.description}
            </Text>
          ) : null}
        </span>
        {memberLabel ? (
          <Text as="span" className="hidden shrink-0 text-sm @md:inline">
            {memberLabel}
          </Text>
        ) : null}
        <Badge
          color={row.discountValue > 0 ? 'module' : 'neutral'}
          variant="soft"
          size="sm"
          className="shrink-0"
        >
          {row.discountValue > 0 ? discountSummary(row) : 'No discount'}
        </Badge>
        {row.minOrderCents > 0 ? (
          <Text as="span" className="hidden shrink-0 text-sm @lg:inline">
            min {formatCents(row.minOrderCents)}
          </Text>
        ) : null}
      </button>
    </li>
  );
}
