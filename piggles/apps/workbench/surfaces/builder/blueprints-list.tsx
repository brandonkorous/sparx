'use client';

// Ready-made site designs you can start from instead of building from nothing.
//
// A GALLERY OF CARDS, not a table. These are whole visual designs, and choosing
// one is an editorial, look-at-it decision — "which of these fits my business" —
// not a scan down a shared column the way content or invoices are. Each design
// leads with its preview image where it has one and a plain "what it includes"
// line where it doesn't, and carries its own state badge; a table would flatten
// all of that into cells and invent columns to justify themselves.
//
// NO free-text search box here, deliberately. The catalog endpoint has no query
// parameter, so a search could only filter the page already loaded — which would
// answer "is there a restaurant design?" with "not on this page", the exact
// half-truth to avoid. The catalog is a small curated set, so the honest filter
// is the server-backed one below (everything vs. what this site has installed),
// with real pages under it.
//
// The "Installed" filter reflects the SITE you are working in — a blueprint
// installs per-site, and this list reads the active site's install rows.

import { useState } from 'react';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { Badge, Button, Card, Filter, FilterItem, Heading, Text } from '@wizeworks/silicaui-react';
import { faTableLayout } from '@fortawesome/pro-solid-svg-icons';

import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { contentsSummary, installState, useBlueprints, type Blueprint } from './blueprints-data';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'builder';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** Title-cased vertical for the card's quiet meta line. Rendered as plain text,
 *  never a badge — a category chip introducing the name would read as an eyebrow. */
function verticalLabel(vertical: string | null): string | null {
  if (!vertical) return null;
  return vertical
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function BlueprintCard({
  blueprint,
  onOpen,
}: {
  blueprint: Blueprint;
  onOpen: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const state = blueprint.install ? installState(blueprint.install.status) : null;
  const updateAvailable = blueprint.install?.update_available ?? false;
  const vertical = verticalLabel(blueprint.vertical);
  const summary = contentsSummary(blueprint.contents);

  return (
    <button
      type="button"
      className="card bg-base-100 border-base-300 hover:border-module focus-visible:border-module flex cursor-pointer flex-col overflow-hidden border text-left transition-colors"
      title="Open this design — hold Shift to open alongside, Alt for a new window"
      onClick={onOpen}
    >
      {blueprint.preview ? (
        // Hot-linked marketplace preview on an arbitrary CDN — not an allow-listed
        // media host, so `next/image` would reject it (it THROWS on an
        // un-allow-listed host). Decorative (the name below is the label), so an
        // empty alt is correct.
        <img
          src={blueprint.preview}
          alt=""
          loading="lazy"
          className="bg-base-200 aspect-video w-full object-cover"
        />
      ) : (
        <div className="bg-base-200 flex aspect-video w-full items-center justify-center">
          <Icon glyph={faTableLayout} className="size-8 [color:var(--color-module)]" aria-hidden />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start gap-2">
          <Heading level={2} className="min-w-0 flex-1 text-base font-semibold">
            {blueprint.name}
          </Heading>
          {state ? (
            <Badge color={state.tone} variant="soft" size="sm">
              {state.label}
            </Badge>
          ) : null}
          {updateAvailable ? (
            <Badge color="module" variant="soft" size="sm">
              Update
            </Badge>
          ) : null}
        </div>

        {blueprint.summary ? (
          <Text className="line-clamp-2 text-sm">{blueprint.summary}</Text>
        ) : null}

        {/* The "what it includes" line is the fact people actually compare on, so
            it stays full-strength, not faded. */}
        <Text className="mt-auto pt-1 text-sm">
          {vertical ? `${vertical} · ` : ''}
          {summary}
        </Text>
      </div>
    </button>
  );
}

type FilterValue = 'all' | 'installed';

export function BlueprintsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(25);

  const skip = (page - 1) * pageSize;
  const installedOnly = filter === 'installed';

  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useBlueprints({
    installedOnly,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const open = (blueprint: Blueprint, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('builder.blueprint', { key: blueprint.key }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Blueprints controls"
        status={
          typeof total === 'number' ? (
            <Text className="ml-auto hidden shrink-0 text-sm whitespace-nowrap @md:block">
              {total === 1 ? '1 design' : `${String(total)} designs`}
            </Text>
          ) : null
        }
        controls={
          <Filter
            color="module"
            value={filter}
            onValueChange={(next) => {
              setFilter((next as FilterValue | null) ?? 'all');
              resetWindow();
            }}
            showReset={false}
            aria-label="Which designs to show"
          >
            <FilterItem value="all">All designs</FilterItem>
            <FilterItem value="installed">Added to this site</FilterItem>
          </Filter>
        }
        views={{
          target: '/builder/blueprints',
          params: { installed: installedOnly ? '1' : '' },
          onApply: (next) => {
            setFilter(next.installed === '1' ? 'installed' : 'all');
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          // A failed load REPLACES the gallery — "no designs yet" over a
          // connection failure is the wrong story to tell.
          <Card className="min-h-0 flex-1 items-center justify-center">
            <PaneLoadError
              icon={<Icon glyph={faTableLayout} className="size-6" aria-hidden />}
              title="Could not load the designs"
              description="This is a problem reaching the server. Your site and anything you have already added are unaffected."
              onRetry={() => {
                void refetch();
              }}
            />
          </Card>
        ) : isLoading ? (
          <Card className="min-h-0 flex-1 items-center justify-center">
            <PaneWaiting />
          </Card>
        ) : rows.length === 0 ? (
          <Card className="min-h-0 flex-1 items-center justify-center">
            <PaneEmpty
              module={MODULE}
              icon={<Icon glyph={faTableLayout} className="size-6" aria-hidden />}
              title={installedOnly ? 'Nothing added to this site yet' : 'No designs available'}
              description={
                installedOnly
                  ? 'You have not started this site from a ready-made design. Switch to All designs to browse them.'
                  : 'There are no ready-made designs to show right now. Try refreshing in a moment.'
              }
              actions={
                installedOnly ? (
                  <Button
                    size="sm"
                    color="module"
                    onClick={() => {
                      setFilter('all');
                      resetWindow();
                    }}
                  >
                    Browse all designs
                  </Button>
                ) : null
              }
            />
          </Card>
        ) : (
          // Capped and centred: a pane torn onto a second monitor is otherwise
          // 2000px wide with three lonely cards stranded on the left.
          <div className="mx-auto w-full max-w-6xl">
            <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
              {rows.map((blueprint) => (
                <BlueprintCard
                  key={blueprint.key}
                  blueprint={blueprint}
                  onOpen={(event) => {
                    open(blueprint, event);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

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
        <Text className="hidden px-1 pb-1 text-sm @xl:block">
          Click a design to preview it · Shift-click alongside · Alt-click new window
        </Text>
      </div>
    </div>
  );
}
