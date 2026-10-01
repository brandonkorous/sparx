'use client';

// The segments list — the saved groups of customers.
//
// A table, matching the customers and accounts lists: name is the anchor, with
// the rule count and whether a segment came with the app or the tenant made it,
// in their own columns. Counts of members are NOT shown here — that is a per-row
// read, and the list must stay one request; membership lives on the detail. An
// archived segment says so beside its NAME — a state belongs with the thing, not
// in the column about where it came from (issue 895).

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SearchInput,
  Select,
  Table,
} from '@wizeworks/silicaui-react';
import { Filter, Plus } from 'lucide-react';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { RefreshButton } from '../../components/refresh-button';
import { segmentMembership, useSegments, type Segment } from './segments-data';
import { describeRule } from './segment-summary';
import { ListFooter } from '../../components/list-footer';
import { countLabel } from '../../components/list-footer-words';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/**
 * WHAT THE GROUP SELECTS, not how many clauses it has.
 *
 * `ruleCount` looked for `conditions` / `rules` / `all` / `any`. The stored tree
 * has none of those: its key is `children`. So it returned 0 for every segment
 * ever written, and every row in this column read "From activity" — a phrase
 * that reads like a statement about the group rather than like a value nothing
 * could compute. Piggles fixed this; this console never got it.
 */
function ruleSummary(segment: Segment): string {
  return describeRule(segment.rules);
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
      Comes with sparx
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

  const scopeItems = useMemo(() => ({ active: 'Active segments', all: 'Including archived' }), []);

  const open = (segment: Segment, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('crm.segment.detail', { id: segment.id }, { target: targetFor(event) });
  };
  // ONE object, two places: the toolbar's button and the empty state's
  // invitation. Split, the label drifts — and the first-run state used to
  // have no button at all, so "Add your first one" pointed at nothing.
  const createFirst = {
    label: 'New segment',
    onClick: (event: { shiftKey: boolean; altKey: boolean }) => {
      ctx.open('crm.segment.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Segments controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              color="module"
              size="sm"
              aria-label="Search segments"
              placeholder="Search segments…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        }
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0"
            title="New segment: hold Shift to open alongside, Alt for a new window"
            onClick={createFirst.onClick}
          >
            <Plus className="size-4" aria-hidden />
            {createFirst.label}
          </Button>
        }
        controls={
          <>
            <div className="hidden w-44 shrink-0 @lg:block">
              <Select
                color="module"
                size="sm"
                aria-label="Which segments to show"
                value={scope}
                items={scopeItems}
                onValueChange={(next) => {
                  setScope(next as 'active' | 'all');
                }}
              />
            </div>
          </>
        }
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
            icon={<Filter className="size-6" aria-hidden />}
            title="Could not load your segments"
            description="Something went wrong reaching the server. It may be a temporary problem. Try again in a moment."
            actions={
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  void refetch();
                }}
              >
                Try again
              </Button>
            }
          />
        ) : isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <ListEmptyState
            filtered={filtered}
            noResults={{
              icon: <Filter className="size-6" aria-hidden />,
              title: 'No segments match that',
              description: 'Try a different word, or switch back to active segments.',
            }}
            firstRun={{
              title: 'No segments yet',
              description:
                'A segment is a saved group of customers who share something: big spenders, or everyone who has not bought in a year. Create your first one to start targeting a group.',
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
                        Archived
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
