'use client';

// The activity feed card — the long half of Pulse, and the reason this surface
// needed paging at all.
//
// Walked by keyset cursor rather than offset: the audit log is append-only and
// live, so with `skip` every row that lands while someone reads window 1 pushes
// a row they already saw down into window 2. A timestamp cursor is stable no
// matter how much arrives above it. See lib/api/activity.ts.

import { useState } from 'react';
import { Badge, EmptyState, Text } from '@wizeworks/silicaui-react';
import { faWavePulse } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../components/form-section';
import { ListPagination, type PageSize } from '../../components/list-pagination';
import { describeAgo, useActivity, type ActivityItem } from '../../lib/api/activity';
import {
  ModuleScope,
  WORKBENCH_MODULES,
  type WorkbenchModule,
} from '../../components/module-scope';
import { productCopy, productName } from '../../lib/product';

/** The server sends a module slug as a plain string; only render a hue for one
 *  we actually carry a token for, so an unmapped namespace degrades to neutral
 *  rather than to a `data-module` that matches no CSS rule. */
function asModule(slug: string | null): WorkbenchModule | null {
  return slug !== null && (WORKBENCH_MODULES as readonly string[]).includes(slug)
    ? (slug as WorkbenchModule)
    : null;
}

/** An activity line, plus how many identical ones it stands for. */
interface ActivityRun {
  item: ActivityItem;
  count: number;
}

/**
 * Folds consecutive identical rows into one line with a count.
 *
 * Bulk operations are the norm, not the exception — a single price update or
 * template edit writes one audit row per record, and on real data the newest 200
 * rows contained a run of **18 identical actions**. Left alone, one bulk edit
 * owns the entire first screen and the feed answers nothing.
 *
 * Consecutive only, and keyed on actor too: two different people doing the same
 * thing are two facts, and an unrelated event in between legitimately breaks the
 * run. Nothing is hidden — the count says exactly how many there were.
 *
 * Collapsing is per WINDOW, so a run spanning a window boundary shows as two
 * lines. Folding across the boundary would mean holding every window in memory
 * to know what preceded this one, which is the accumulate-and-merge problem the
 * paging design exists to avoid.
 */
function collapseRuns(items: readonly ActivityItem[]): ActivityRun[] {
  const runs: ActivityRun[] = [];
  for (const item of items) {
    const previous = runs[runs.length - 1];
    if (
      previous?.item.action === item.action &&
      previous.item.actor.id === item.actor.id &&
      // A run only collapses when the rows say the same thing. Distinct
      // subjects ("Product updated — Green Machine") stay their own lines,
      // because those name different records and that IS the information.
      previous.item.subject === item.subject
    ) {
      previous.count += 1;
      continue;
    }
    runs.push({ item, count: 1 });
  }
  return runs;
}

/**
 * When no person did it, the actor is named by CHANNEL rather than all being
 * flattened to "sparx" — "an AI assistant changed this page" and "the platform
 * did this on a schedule" are different facts an owner reacts to differently.
 */
function actorLabel(actor: ActivityItem['actor']): string {
  if (actor.name) return actor.name;
  if (actor.type === 'mcp') return 'AI assistant';
  if (actor.type === 'customer') return 'a customer';
  if (actor.type === 'api') return 'an integration';
  return productName();
}

/**
 * One thing that happened. The leading dot carries the module's hue via a
 * nested `ModuleScope` — colour follows FUNCTIONALITY, so a commerce line reads
 * commerce-orange inside this platform-hued pane rather than everything wearing
 * one colour (docs/23 Color-Follows-Functionality).
 */
function ActivityRow({ item, count = 1 }: { item: ActivityItem; count?: number }) {
  const module = asModule(item.module);

  const row = (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="flex min-w-0 items-baseline gap-2">
        <span
          className={`size-1.5 shrink-0 rounded-full ${module ? 'bg-module' : 'bg-base-300'}`}
          aria-hidden
        />
        <span className="min-w-0 truncate">
          {item.title}
          {item.subject ? ` — ${item.subject}` : ''}
        </span>
        {count > 1 ? (
          <Badge color="neutral" variant="soft" size="sm" className="shrink-0">
            ×{String(count)}
          </Badge>
        ) : null}
      </span>
      <Text className="shrink-0 text-sm">
        {actorLabel(item.actor)} · {describeAgo(item.at)}
      </Text>
    </div>
  );

  return module ? <ModuleScope module={module}>{row}</ModuleScope> : row;
}

export function ActivityFeed({ hasJobs }: { hasJobs: boolean }) {
  const [pageSize, setPageSize] = useState<PageSize>(50);
  // One cursor per step back in time. Empty = the newest window. Stored as a
  // stack rather than a single value so "Newer" is a pop — walking BACK toward
  // now needs the boundary of the window before, which only this remembers.
  const [cursors, setCursors] = useState<string[]>([]);

  const before = cursors[cursors.length - 1];
  const { items, ready, busy, hasMore } = useActivity({
    limit: pageSize,
    ...(before ? { before } : {}),
  });

  const runs = collapseRuns(items);
  // Positions in the feed, not in the collapsed view — every prior window was
  // full (we only step older when it was), so the arithmetic holds.
  const firstRow = cursors.length * pageSize + 1;

  if (ready && items.length === 0 && cursors.length === 0) {
    return (
      <FormSection title="What's happened">
        <EmptyState
          icon={<Icon glyph={faWavePulse} className="size-6" aria-hidden />}
          title="Nothing has happened yet"
          description={
            hasJobs
              ? 'Once your team starts publishing pages, taking orders or importing records, every one of those shows up here, newest first.'
              : 'As you and your team work — publishing pages, taking orders, importing records — it all shows up here, newest first.'
          }
        />
      </FormSection>
    );
  }

  return (
    <FormSection
      title="What's happened"
      description={productCopy(
        'pulse.activity.description',
        'Everything your team, your customers and Piggles itself have done, newest first.'
      )}
    >
      {items.length === 0 ? (
        // Reachable when a full last window left the cursor one step past the
        // end. Not an error, and not the same as an empty log.
        <Text className="py-2">
          Nothing older to show. Step back to Newer for the most recent activity.
        </Text>
      ) : (
        <ul className="divide-base-300 flex flex-col divide-y">
          {runs.map((run) => (
            <li key={run.item.id}>
              <ActivityRow item={run.item} count={run.count} />
            </li>
          ))}
        </ul>
      )}

      <ListPagination
        shown={items.length}
        firstRow={firstRow}
        page={cursors.length + 1}
        pageSize={pageSize}
        busy={busy}
        hasMore={hasMore}
        onOlder={() => {
          const last = items[items.length - 1];
          if (last) setCursors((current) => [...current, last.at]);
        }}
        {...(cursors.length > 0
          ? {
              onNewer: () => {
                setCursors((current) => current.slice(0, -1));
              },
            }
          : {})}
        onPageSizeChange={(size) => {
          // Window boundaries move, so every cursor below is meaningless —
          // return to the newest window rather than resuming mid-feed at an
          // offset that no longer lines up with anything.
          setPageSize(size);
          setCursors([]);
        }}
      />
    </FormSection>
  );
}
