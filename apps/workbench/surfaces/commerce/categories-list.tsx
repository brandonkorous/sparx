'use client';

// The categories list — the whole tree, every level openable.
//
// A category is a nested thing ("Outdoor › Camping › Cookware"), and the generic
// list factory would only show the ROOTS (the tree endpoint returns nested
// nodes, and a flat list renders the top of it). That hides every sub-category
// from the one screen meant to manage them, so this list is hand-written: it
// FLATTENS the tree and shows each category as its full trail, so a person can
// reach and open any of them.

import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, SearchInput, Text } from '@wizeworks/silicaui-react';
import { Plus, Tags } from 'lucide-react';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { flattenCategories, useCategoryTree, type CategoryChoice } from './categories-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function CategoriesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useCategoryTree();

  const all = useMemo(() => flattenCategories(data), [data]);
  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle === '') return all;
    return all.filter((category) => category.trail.join(' › ').toLowerCase().includes(needle));
  }, [all, search]);

  const open = (category: CategoryChoice, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.category.detail', { id: category.id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Category list controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search categories"
            placeholder="Search categories…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          title="Add a category — hold Shift to open alongside, Alt for a new window"
          onClick={(event) => {
            ctx.open('commerce.category.detail', { id: 'new' }, { target: targetFor(event) });
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add a category
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
            title="Could not load your categories"
            description="Something went wrong reaching the server. It may be temporary — try again in a moment."
          />
        ) : isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : matches.length === 0 ? (
          <EmptyState
            icon={<Tags className="size-6" aria-hidden />}
            title={search ? 'Nothing matches that search' : 'No categories yet'}
            description={
              search
                ? 'Try a different word, or clear the search box to see everything.'
                : 'Categories are the aisles of your website menu — the structure shoppers browse down. Add your first one to get started.'
            }
          />
        ) : (
          <ul className="flex flex-col p-1">
            {matches.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  className="hover:bg-base-200 flex w-full items-center gap-3 rounded px-2 py-2 text-left"
                  onClick={(event) => {
                    open(category, event);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    {category.trail.slice(0, -1).map((ancestor) => (
                      <span key={ancestor}>{ancestor} › </span>
                    ))}
                    <span className="font-semibold">{category.name}</span>
                  </span>
                  <Text as="span" className="shrink-0 text-sm tabular-nums">
                    {category.productCount === 1
                      ? '1 product'
                      : `${String(category.productCount)} products`}
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
