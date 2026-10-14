'use client';

// Wholesale groups: named sets of businesses charged the same way. A row per group
// shows what tells groups apart, what it takes off and how many businesses are in it.
// It was "Wholesale prices", one letter from the product panel's "Wholesale price" (issue 740).

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Badge, Button, Card, SearchInput, Text } from '@wizeworks/silicaui-react';
import { faDollarSign, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { discountSummary, formatCents, useTiers, type TierRow } from './pricing-tiers-data';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'b2b';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}
type TiersQuery = ReturnType<typeof useTiers>;
interface CreateFirst {
  label: string;
  onClick: (event: OpenEvent) => void;
}

function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function PricingTiersListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const tiers = useTiers({ q: search.trim(), take: 100, skip: 0 });
  const rows = tiers.data?.items ?? [];

  const open = (id: string, event: OpenEvent) => {
    ctx.open('b2b.pricing-tier.detail', { id }, { target: targetFor(event) });
  };
  // ONE object for the toolbar button and the empty state's invitation, so the
  // label cannot drift and the first-run state always has a button.
  const createFirst: CreateFirst = {
    label: 'Add a wholesale group',
    onClick: (event) => {
      ctx.open('b2b.pricing-tier.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };

  return (
    <div className={PANE_SHELL}>
      <TiersToolbar search={search} setSearch={setSearch} tiers={tiers} createFirst={createFirst} />
      <Card className="min-h-0 flex-1 overflow-y-auto p-2">
        <TiersBody
          tiers={tiers}
          narrowed={search.trim() !== ''}
          createFirst={createFirst}
          onOpen={open}
        />
      </Card>
      {rows.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}

function TiersToolbar({
  search,
  setSearch,
  tiers,
  createFirst,
}: {
  search: string;
  setSearch: (next: string) => void;
  tiers: TiersQuery;
  createFirst: CreateFirst;
}) {
  return (
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
      primary={<CreateGroupButton createFirst={createFirst} />}
      views={{
        target: '/b2b/pricing-tiers',
        params: { q: search.trim() },
        onApply: (next) => {
          setSearch(next.q ?? '');
        },
      }}
      refresh={
        <RefreshButton
          isFetching={tiers.isFetching}
          updatedAt={tiers.data ? tiers.dataUpdatedAt : undefined}
          onRefresh={() => {
            void tiers.refetch();
          }}
        />
      }
    />
  );
}

function CreateGroupButton({ createFirst }: { createFirst: CreateFirst }) {
  return (
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
  );
}

function TiersEmpty({ narrowed, createFirst }: { narrowed: boolean; createFirst: CreateFirst }) {
  return (
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
  );
}

function TiersBody({
  tiers,
  narrowed,
  createFirst,
  onOpen,
}: {
  tiers: TiersQuery;
  narrowed: boolean;
  createFirst: CreateFirst;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  const rows = tiers.data?.items ?? [];
  if (tiers.isError) {
    return (
      <PaneLoadError
        module={MODULE}
        icon={<Icon glyph={faDollarSign} className="size-6" aria-hidden />}
        title="Could not load your wholesale groups"
        description="This is a problem reaching the server. Your groups are unaffected. Nothing has been lost."
        error={tiers.error}
      />
    );
  }
  if (tiers.isPending) return <PaneWaiting />;
  if (rows.length === 0) return <TiersEmpty narrowed={narrowed} createFirst={createFirst} />;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => (
        <TierRowItem key={row.id} row={row} onOpen={onOpen} />
      ))}
    </ul>
  );
}

// "Businesses", not "accounts": in this console's Money app an account is a ledger.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
function memberLabelFor(count: number | undefined): string | null {
  if (count === undefined) return null;
  return count === 1 ? '1 business' : `${String(count)} businesses`;
}

function TierRowItem({
  row,
  onOpen,
}: {
  row: TierRow;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  const memberLabel = memberLabelFor(row.accountCount);
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
