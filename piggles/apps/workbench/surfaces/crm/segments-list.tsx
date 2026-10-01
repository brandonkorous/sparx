'use client';

// The segments list — the saved groups of customers.
//
// A table, matching the customers and accounts lists: name is the anchor, with
// the size, what the group selects, and whether it came with the app or she made
// it, in their own columns. The count rides along on the list request, so the
// list stays ONE request. A group that has been put away says so beside its
// NAME — a state belongs with the thing, not in the column about where it came
// from (issue 895).

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Badge, Button, Card, SearchInput, Select } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faFilter, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { RefreshButton } from '../../components/refresh-button';
import { segmentMembership, useSegments, type Segment } from './segments-data';
import { RecomputeAllButton } from './segments-recompute-all';
import { describeRule } from './segment-summary';
import { ListFooter } from '../../components/list-footer';
import { countLabel } from '../../components/list-footer-words';
import { productCopy } from '../../lib/product';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'crm';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** A hand-picked list has no rules to describe — somebody chose who is in it. */
function ruleSummary(segment: Segment): string {
  return segment.kind === 'static' ? 'Picked by hand' : describeRule(segment.rules);
}

/**
 * WHICH SIDE A GROUP IS ON: one that came with the app, or one she made.
 *
 * This column used to be headed "State" and hold three words from two different
 * vocabularies: "Archived", "Built-in", "Active". Only ONE of them ever showed
 * per row, so six of Devi's nine groups said "Built-in" and three said "Active",
 * which reads as a contrast — as though the six were not running. They all were.
 *
 * The sibling list one row down the same menu had already settled this:
 * `crm/object-types-list.tsx` heads its column "Kind", always names both sides
 * ("Yours" or the one that came with the app), and lets "put away" ride beside
 * the NAME, where a state belongs. This is that, applied here.
 */
function KindBadge({ segment }: { segment: Segment }) {
  return segment.isBuiltIn ? (
    <Badge color="info" variant="soft" size="sm">
      {productCopy('crm.objectTypes.builtInBadge', 'Comes with sparx')}
    </Badge>
  ) : (
    <Badge color="module" variant="soft" size="sm">
      Yours
    </Badge>
  );
}

export function SegmentsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'active' | 'all'>('active');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useSegments({
    q: search,
    includeArchived: scope === 'all',
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const filtered = search.trim() !== '' || scope !== 'active';

  const scopeItems = useMemo(() => ({ active: 'Groups in use', all: 'Including put away' }), []);

  const open = (segment: Segment, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('crm.segment.detail', { id: segment.id }, { target: targetFor(event) });
  };
  // ONE object, two places: the toolbar's button and the empty state's
  // invitation. Split, the label drifts — and the first-run state used to
  // have no button at all, so "Add your first one" pointed at nothing.
  const createFirst = {
    label: 'New customer group',
    onClick: (event: { shiftKey: boolean; altKey: boolean }) => {
      ctx.open('crm.segment.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Groups of customers controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              color="module"
              size="sm"
              aria-label="Search customer groups"
              placeholder="Search customer groups…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        }
        primary={
          <>
            <RecomputeAllButton />
            <Button
              color="module"
              size="sm"
              className="shrink-0"
              title="New customer group: hold Shift to open alongside, Alt for a new window"
              onClick={createFirst.onClick}
            >
              <Icon glyph={faPlus} className="size-4" aria-hidden />
              {createFirst.label}
            </Button>
          </>
        }
        controls={
          <div className="w-44 shrink-0">
            <Select
              color="module"
              size="sm"
              aria-label="Which groups to show"
              value={scope}
              items={scopeItems}
              onValueChange={(next) => {
                setScope(next as 'active' | 'all');
              }}
            />
          </div>
        }
        views={{
          target: '/crm/segments',
          params: { q: search, scope },
          onApply: (next) => {
            setSearch(next.q ?? '');
            setScope(next.scope === 'all' ? 'all' : 'active');
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
          <PaneLoadError
            icon={<Icon glyph={faFilter} className="size-6" aria-hidden />}
            title="Could not load your customer groups"
            description="Something went wrong reaching the server. It may be a temporary problem. Try again in a moment."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isPending ? (
          <PaneWaiting />
        ) : rows.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={filtered}
            noResults={{
              icon: <Icon glyph={faFilter} className="size-6" aria-hidden />,
              title: 'No customer groups match that',
              description: 'Try a different word, or switch back to the ones in use.',
            }}
            firstRun={{
              title: 'No customer groups yet',
              description:
                'A customer group is a saved set of people who share something: big spenders, or everyone who has not bought in a year. Create your first one and you can email or price for the whole group at once.',
              action: createFirst,
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Name</th>
                {/* The size leads the right-hand side because "how many people
                    is that" is what this list is opened to find out. */}
                <th className="text-right">People</th>
                <th className="hidden @lg:table-cell">Rules</th>
                <th>Kind</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((segment) => (
                <tr
                  key={segment.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  onClick={(event) => {
                    open(segment, event);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    open(segment, event);
                  }}
                >
                  <td>
                    <span className="font-medium">{segment.name}</span>
                    {segment.archivedAt ? (
                      <Badge color="neutral" variant="soft" size="sm" className="ml-2">
                        Put away
                      </Badge>
                    ) : null}
                    {segment.description ? (
                      <span className="block truncate text-sm @md:hidden">
                        {ruleSummary(segment)}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-right text-sm tabular-nums">
                    {segment._count ? segmentMembership(segment._count.members) : '—'}
                  </td>
                  <td className="hidden text-sm @lg:table-cell">{ruleSummary(segment)}</td>
                  <td>
                    <KindBadge segment={segment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <ListFooter
        shown={rows.length}
        count={countLabel({
          shown: rows.length,
          total,
          filtered,
          pending: isPending,
        })}
      />
    </div>
  );
}
