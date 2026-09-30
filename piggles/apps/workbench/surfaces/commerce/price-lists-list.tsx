'use client';

// The price-lists list.
//
// A price list carries several distinct facts a person scans across to tell one
// from another — who it is for, which currency, how many prices are on it, and
// whether it is live — so unlike the one-line collection/discount lists this is
// a real table, its columns disclosing with @container as the pane widens.
//
// A SPECIAL PRICE is a set of prices for particular customers: a wholesale
// sheet, a distributor's rates, the "trade" price you give the businesses you
// supply. The platform calls it a price list; the empty state does not, because
// the audience owns a shop, not a pricing engine.

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
import { faPlus, faTag } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import { audienceSummary, priceListState, type PriceListRow } from './price-lists-data';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'commerce';

const FILTERS = [
  { value: 'all', label: 'All', status: undefined },
  { value: 'active', label: 'Live', status: 'active' },
  { value: 'draft', label: 'Not live', status: 'draft' },
  { value: 'archived', label: 'Retired', status: 'archived' },
] as const;

type FilterValue = (typeof FILTERS)[number]['value'];

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function PriceListsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');

  const active = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['commerce', 'price-lists', 'list', { q: search, status: active.status }],
    queryFn: () =>
      api.list<PriceListRow>('/v1/commerce/price-lists', {
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(active.status ? { status: active.status } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });

  const rows = data?.items ?? [];
  const narrowed = search.trim() !== '' || filter !== 'all';

  const openDetail = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.pricelist.detail', { id }, { target: targetFor(event) });
  };
  // ONE object, two places: the toolbar's button and the empty state's
  // invitation. Split, the label drifts — and the first-run state used to
  // have no button at all, so "Add your first one" pointed at nothing.
  const createFirst = {
    label: 'Add a special price',
    onClick: (event: { shiftKey: boolean; altKey: boolean }) => {
      ctx.open('commerce.pricelist.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Special prices controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search special prices"
              placeholder="Search special prices…"
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
            title="Add a special price: hold Shift to open alongside, Alt for a new window"
            onClick={createFirst.onClick}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            {createFirst.label}
          </Button>
        }
        controls={
          <div className="w-40 shrink-0">
            <Select
              size="sm"
              aria-label="Show which special prices"
              value={filter}
              items={FILTERS.map((entry) => ({ value: entry.value, label: entry.label }))}
              onValueChange={(next) => {
                setFilter((next as FilterValue | null) ?? 'all');
              }}
            />
          </div>
        }
        views={{
          target: '/commerce/pricing',
          // The status picker lives in `controls`, not `filters`, so it rides here.
          params: { q: search.trim(), status: filter },
          onApply: (next) => {
            setSearch(next.q ?? '');
            setFilter((next.status as FilterValue | undefined) ?? 'all');
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
            icon={<Icon glyph={faTag} className="size-6" aria-hidden />}
            title="Could not load your special prices"
            description="This is a problem reaching the server. Your special prices are unaffected. Nothing has been lost."
          />
        ) : isPending ? (
          <PaneWaiting />
        ) : rows.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={narrowed}
            noResults={{
              icon: <Icon glyph={faTag} className="size-6" aria-hidden />,
              title: 'Nothing matches those filters',
              description: 'Try a different word, or clear the filters to see everything.',
            }}
            firstRun={{
              title: 'No special prices yet',
              description:
                'A special price is a set of prices for particular customers: a wholesale sheet for the businesses you supply, or a members’ rate. Add your first one to start giving certain customers their own prices.',
              action: createFirst,
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Name</th>
                <th className="hidden @lg:table-cell">Who it&apos;s for</th>
                <th className="hidden @xl:table-cell">Currency</th>
                <th className="hidden text-right @md:table-cell">Prices</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const state = priceListState(row);
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      openDetail(row.id, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      openDetail(row.id, event);
                    }}
                  >
                    <td className="font-medium">
                      <span className="block">{row.name}</span>
                      <Text as="span" className="text-sm @lg:hidden">
                        {audienceSummary(row)}
                      </Text>
                    </td>
                    <td className="hidden @lg:table-cell">{audienceSummary(row)}</td>
                    <td className="hidden font-mono text-sm @xl:table-cell">{row.currency}</td>
                    <td className="hidden text-right tabular-nums @md:table-cell">
                      {row.entryCount === 1 ? '1 price' : `${String(row.entryCount)} prices`}
                    </td>
                    <td className="text-right">
                      <Badge color={state.tone} variant="soft" size="sm">
                        {state.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {rows.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}
