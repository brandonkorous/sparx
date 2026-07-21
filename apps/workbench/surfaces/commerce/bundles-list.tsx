'use client';

// The bundles list.
//
// A bundle is sold as one wrapper product, so that product's name is its
// identity. The two facts that tell one bundle from another are how it is priced
// and how many products are inside it — so each row leads with the name and
// carries those two.

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, SearchInput, Text } from '@wizeworks/silicaui-react';
import { Blocks, Plus } from 'lucide-react';
import { useQuery } from '@sparx/query';
import { api } from '../../lib/api/client';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { formatCents } from './products-data';
import type { Bundle } from './bundles-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function pricingLabel(bundle: Bundle): string {
  switch (bundle.pricingMode) {
    case 'fixed':
      return bundle.fixedPriceCents === null
        ? 'Flat price'
        : `Flat ${formatCents(bundle.fixedPriceCents)}`;
    case 'percent_off_sum':
      return bundle.percentOffSum === null
        ? '% off the parts'
        : `${String(bundle.percentOffSum)}% off the parts`;
    default:
      return 'Parts added up';
  }
}

export function BundlesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['commerce', 'bundles', 'list', { q: search }],
    queryFn: () =>
      api.list<Bundle>('/v1/commerce/bundles', {
        ...(search.trim() ? { q: search.trim() } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });

  const rows = data?.items ?? [];

  const open = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.bundle.detail', { id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Bundle list controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search bundles"
            placeholder="Search bundles…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          title="Add a bundle — hold Shift to open alongside, Alt for a new window"
          onClick={(event) => {
            ctx.open('commerce.bundle.detail', { id: 'new' }, { target: targetFor(event) });
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add a bundle
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
            title="Could not load your bundles"
            description="Something went wrong reaching the server. It may be temporary — try again in a moment."
          />
        ) : isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Blocks className="size-6" aria-hidden />}
            title={search.trim() ? 'Nothing matches that search' : 'No bundles yet'}
            description={
              search.trim()
                ? 'Try a different word, or clear the search box to see everything.'
                : 'A bundle sells several products together as one item — a kit, a gift set, a package — usually for less than buying the parts separately. Add your first one to get started.'
            }
          />
        ) : (
          <ul className="flex flex-col p-1">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="hover:bg-base-200 flex w-full flex-wrap items-center gap-2 rounded px-2 py-2 text-left"
                  onClick={(event) => {
                    open(row.id, event);
                  }}
                >
                  <span className="min-w-0 flex-1 font-semibold">{row.bundleProductTitle}</span>
                  <Badge color="info" variant="soft" size="sm">
                    {pricingLabel(row)}
                  </Badge>
                  <Text as="span" className="shrink-0 text-sm tabular-nums">
                    {row.componentCount === 1
                      ? '1 product'
                      : `${String(row.componentCount)} products`}
                  </Text>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="shrink-0 px-1 text-xs">
        Click to open · Shift-click to open alongside · Alt-click to open in a new window
      </p>
    </div>
  );
}
