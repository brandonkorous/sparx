'use client';

// The configurator (build-to-order templates) list — catalog-wide.
//
// A template belongs to a product and turns it into something a shopper builds
// to order. This list is the whole catalog of them in one place; each row leads
// with the template's name, says which product it is for, and whether shoppers
// are actually being asked its questions right now.

import { useState } from 'react';
import { Badge, Button, Card, EmptyState, SearchInput, Select, Text } from '@wizeworks/silicaui-react';
import { Plus, Settings2 } from 'lucide-react';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { Tone } from './products-data';
import { useConfiguratorTemplates } from './configurator-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function statusBadge(status: string): { label: string; tone: Tone } {
  if (status === 'active') return { label: 'Live', tone: 'success' };
  if (status === 'archived') return { label: 'Retired', tone: 'neutral' };
  return { label: 'Not live', tone: 'info' };
}

export function ConfiguratorListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useConfiguratorTemplates({
    q: search,
    ...(status !== 'all' ? { status } : {}),
  });

  const rows = data?.items ?? [];

  const open = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.configurator-template.detail', { id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Configurator list controls">
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search builds"
            placeholder="Search builds…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
        <div className="hidden w-36 shrink-0 @md:block">
          <Select
            size="sm"
            aria-label="Show which builds"
            value={status}
            items={{ all: 'All builds', active: 'Live', draft: 'Not live', archived: 'Retired' }}
            onValueChange={setStatus}
          />
        </div>
        <Button
          color="module"
          size="sm"
          className="ml-auto"
          title="Set up a build — hold Shift to open alongside, Alt for a new window"
          onClick={(event) => {
            ctx.open(
              'commerce.configurator-template.detail',
              { id: 'new' },
              { target: targetFor(event) }
            );
          }}
        >
          <Plus className="size-4" aria-hidden />
          Set up a build
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
            title="Could not load your builds"
            description="Something went wrong reaching the server. It may be temporary — try again in a moment."
          />
        ) : isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Settings2 className="size-6" aria-hidden />}
            title={
              search.trim() || status !== 'all' ? 'Nothing matches those filters' : 'No builds yet'
            }
            description={
              search.trim() || status !== 'all'
                ? 'Try a different word, or clear the filters to see everything.'
                : 'A build lets a shopper make a product to order — choosing a size, a finish, an engraving, anything that changes what they get or what it costs. Set up your first one to get started.'
            }
          />
        ) : (
          <ul className="flex flex-col p-1">
            {rows.map((row) => {
              const badge = statusBadge(row.status);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className="hover:bg-base-200 flex w-full flex-wrap items-center gap-2 rounded px-2 py-2 text-left"
                    onClick={(event) => {
                      open(row.id, event);
                    }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{row.name}</span>
                      <Text as="span" className="truncate text-sm">
                        {row.productTitle}
                      </Text>
                    </div>
                    <Text as="span" className="shrink-0 text-sm tabular-nums">
                      {row.optionCount === 1 ? '1 question' : `${String(row.optionCount)} questions`}
                    </Text>
                    <Badge color={badge.tone} variant="soft" size="sm">
                      {badge.label}
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
