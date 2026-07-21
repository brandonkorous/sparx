'use client';

// The collections list.
//
// A collection is a flat, one-line thing, so it is a row per collection rather
// than a table — but each row carries the two facts that actually distinguish
// one collection from another: whether it is HAND-PICKED or AUTOMATIC, and how
// many products are in it. Those are what someone scans this list to tell apart.

import { useState } from 'react';
import { useQuery } from '@sparx/query';
import { Badge, Button, Card, EmptyState, SearchInput, Text } from '@wizeworks/silicaui-react';
import { Layers, Plus } from 'lucide-react';
import { api } from '../../lib/api/client';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';

interface CollectionSummary {
  id: string;
  name: string;
  handle: string;
  type: 'manual' | 'rules';
  productCount: number;
  featured: boolean;
  updatedAt: string;
}

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function CollectionsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['commerce', 'collections', 'list', { q: search }],
    queryFn: () =>
      api.list<CollectionSummary>('/v1/commerce/collections', {
        ...(search.trim() ? { q: search.trim() } : {}),
        take: 100,
      }),
    placeholderData: (previous) => previous,
  });

  const rows = data?.items ?? [];

  const open = (row: CollectionSummary, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.collection.detail', { id: row.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Collection list controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search collections"
            placeholder="Search collections…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          title="Add a collection — hold Shift to open alongside, Alt for a new window"
          onClick={(event) => {
            ctx.open('commerce.collection.detail', { id: 'new' }, { target: targetFor(event) });
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add a collection
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
            title="Could not load your collections"
            description="Something went wrong reaching the server. It may be temporary — try again in a moment."
          />
        ) : isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Layers className="size-6" aria-hidden />}
            title={search ? 'Nothing matches that search' : 'No collections yet'}
            description={
              search
                ? 'Try a different word, or clear the search box to see everything.'
                : 'A collection is a themed group of products you show together — a sale, a gift guide, new arrivals. Add your first one to get started.'
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
                    open(row, event);
                  }}
                >
                  <span className="min-w-0 flex-1 font-semibold">{row.name}</span>
                  <Badge color={row.type === 'rules' ? 'info' : 'neutral'} variant="soft" size="sm">
                    {row.type === 'rules' ? 'Automatic' : 'Hand-picked'}
                  </Badge>
                  {row.featured ? (
                    <Badge color="warning" variant="soft" size="sm">
                      Featured
                    </Badge>
                  ) : null}
                  <Text as="span" className="shrink-0 text-sm tabular-nums">
                    {row.productCount === 1 ? '1 product' : `${String(row.productCount)} products`}
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
