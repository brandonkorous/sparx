'use client';

// Wholesale customers — the businesses you supply.
//
// One carries several facts a person scans across to tell them apart — who it
// is, what wholesale group they are in, how much of their credit they have
// used, and whether they are open for orders — so this is a real table whose
// columns disclose with @container as the pane widens.
//
// A wholesale customer is a business that buys from you on agreed prices and
// terms, not card at checkout. The empty state says exactly that, because the
// audience runs a business, not a CRM.
//
// The pane called them "trade accounts" while the rail's + said "Add a
// wholesale customer" — one action with two names, which is what
// `PIGGLES_CREATE_LABELS` exists to stop, and it only ever reached the rail.
// "Account" is also Money's word in this console. Issue 740.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SearchInput,
  Select,
  Text,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faBuilding, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { accountState, formatCents, useAccounts, type AccountRow } from './accounts-data';
import { creditStanding } from '../../lib/credit-standing';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'b2b';

const FILTERS = [
  { value: 'all', label: 'All', status: undefined },
  { value: 'active', label: 'Open for orders', status: 'active' },
  { value: 'credit_hold', label: 'On credit hold', status: 'credit_hold' },
  { value: 'suspended', label: 'Suspended', status: 'suspended' },
  { value: 'inactive', label: 'Closed', status: 'inactive' },
] as const;

type FilterValue = (typeof FILTERS)[number]['value'];

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function AccountsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const active = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];
  const skip = (page - 1) * pageSize;
  const narrowed = search.trim() !== '' || filter !== 'all';

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useAccounts({
    q: search.trim(),
    status: active.status,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const openDetail = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('b2b.account.detail', { id }, { target: targetFor(event) });
  };
  // ONE object, two places: the toolbar's button and the empty state's
  // invitation. Split, the label drifts — and the first-run state used to
  // have no button at all, so "Add your first one" pointed at nothing.
  const createFirst = {
    label: 'Add a wholesale customer',
    onClick: (event: { shiftKey: boolean; altKey: boolean }) => {
      ctx.open('b2b.account.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Wholesale customers controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search wholesale customers"
              placeholder="Company name or tax number…"
              value={search}
              onValueChange={(next) => {
                setSearch(next);
                resetWindow();
              }}
            />
          </div>
        }
        primary={
          <Button
            data-tour="b2b-add-account"
            color="module"
            size="sm"
            className="ml-auto"
            title="Add a wholesale customer. Hold Shift to open alongside, Alt for a new window"
            onClick={createFirst.onClick}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            {createFirst.label}
          </Button>
        }
        controls={
          <div className="w-44 shrink-0">
            <Select
              size="sm"
              aria-label="Show which customers"
              value={filter}
              items={FILTERS.map((entry) => ({ value: entry.value, label: entry.label }))}
              onValueChange={(next) => {
                setFilter((next as FilterValue | null) ?? 'all');
                resetWindow();
              }}
            />
          </div>
        }
        // The standing picker rides `controls`, so it is this surface's job to
        // put it in the snapshot under its real name — "who is on credit hold"
        // is a question worth keeping.
        views={{
          target: '/b2b/accounts',
          params: { q: search.trim(), status: filter === 'all' ? '' : filter },
          onApply: (next) => {
            setSearch(next.q ?? '');
            const status = next.status ?? '';
            setFilter(
              FILTERS.some((entry) => entry.value === status) ? (status as FilterValue) : 'all'
            );
            resetWindow();
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

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <EmptyState
            icon={<Icon glyph={faBuilding} className="size-6" aria-hidden />}
            title="Could not load your wholesale customers"
            description="This is a problem reaching the server. Your customers are unaffected. Nothing has been lost."
          />
        ) : isPending ? (
          <PaneWaiting />
        ) : rows.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={narrowed}
            noResults={{
              icon: <Icon glyph={faBuilding} className="size-6" aria-hidden />,
              title: 'No wholesale customers match that',
              description: 'Try a different word, or switch back to All to see every one of them.',
            }}
            firstRun={{
              title: 'No wholesale customers yet',
              description:
                'A wholesale customer is a business you supply on agreed prices and terms, like a shop that stocks what you make, rather than a shopper paying by card at checkout. Add your first one to give them their own prices and let their people order.',
              action: createFirst,
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Company</th>
                <th className="hidden @lg:table-cell">Wholesale group</th>
                <th className="hidden text-right @xl:table-cell">Credit used</th>
                <th className="text-right">Standing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <AccountTableRow key={row.id} row={row} onOpen={openDetail} />
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : skip + 1}
          total={total}
          page={page}
          pageSize={pageSize}
          canLoadMore={take < MAX_TAKE}
          busy={isFetching}
          onLoadMore={() => {
            setTake((current) => Math.min(current + pageSize, MAX_TAKE));
          }}
          onPageChange={(next) => {
            setPage(next);
            setTake(pageSize);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setTake(size);
          }}
        />
        {rows.length > 0 ? <RowOpenHint /> : null}
      </div>
    </div>
  );
}

/**
 * What this account owes, and whether it may still order on terms.
 *
 * This guarded on `creditLimitCents > 0` and had two branches, so an account at
 * a zero limit printed "No credit set" and the outstanding balance went on the
 * floor. One company in the dev database is exactly there, owing $1,193.
 *
 * "No credit set" was also the wrong reading of the zero. The checkout works out
 * `creditLimit - creditUsed` and refuses anything larger, so a zero is not an
 * absent ceiling, it is a closed door: no order on terms gets through. The
 * Customers app drew the same record from the other side and printed
 * "$1,193.00 of $0.00 used"; lib/credit-standing.ts is the one place that now
 * decides which of the three things is true.
 */
function creditLine(row: AccountRow): string {
  switch (creditStanding(row.creditLimitCents, row.creditUsedCents)) {
    case 'limit':
      return `${formatCents(row.creditUsedCents)} of ${formatCents(row.creditLimitCents)}`;
    case 'owing':
      return `${formatCents(row.creditUsedCents)} owed, no more on terms`;
    default:
      return 'Cannot order on terms';
  }
}

function AccountTableRow({
  row,
  onOpen,
}: {
  row: AccountRow;
  onOpen: (id: string, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const state = accountState(row.status);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(row.id, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(row.id, event);
      }}
    >
      <td className="font-medium">
        <span className="block">{row.companyName}</span>
        <Text as="span" className="text-sm @lg:hidden">
          {row.pricingTierName ?? 'No group'}
        </Text>
      </td>
      <td className="hidden @lg:table-cell">{row.pricingTierName ?? '—'}</td>
      <td className="hidden text-right text-sm tabular-nums @xl:table-cell">{creditLine(row)}</td>
      <td className="text-right">
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </td>
    </tr>
  );
}
