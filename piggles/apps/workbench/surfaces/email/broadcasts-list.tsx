'use client';

// The broadcasts table — every email you have sent to a group, and every one you
// are still writing. A standard list surface: a real <Table> inside a Card scroll
// container, matching every other list in the app.
//
// Search and the status filter are CLIENT-side, which is correct rather than
// lazy: `GET /v1/email/broadcasts` returns the whole (bounded) set in one go, so
// there is no page 2 for a local filter to give a wrong answer about.
//
// Engagement (opened / clicked) is loaded per SENT row, on demand, from that
// broadcast's own stats — the list endpoint carries no counts. Only sent and
// sending rows fetch, so a wall of drafts costs nothing, and the cached result is
// reused the moment you open the broadcast itself.
//
// Columns disclose progressively with @container, never a viewport query: a
// narrow pane on a wide monitor must not show six columns in 300px.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Badge,
  Button,
  Card,
  NativeSelect,
  SearchInput,
  Timestamp,
} from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faPaperPlane, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { RefreshButton } from '../../components/refresh-button';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  broadcastState,
  useBroadcasts,
  useBroadcastStats,
  type Broadcast,
} from './broadcasts-data';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'email';

const DETAIL_KEY = 'email.broadcasts.detail';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** A whole percentage of a base, or an em-dash when the base is zero (dividing by
 *  nobody is not "0%", it is "not applicable yet"). */
function rate(part: number, base: number): string {
  if (base <= 0) return '—';
  return `${String(Math.round((part / base) * 100))}%`;
}

/** Opened / clicked for one SENT broadcast, fetched from its own stats. Rendered
 *  only for sent and sending rows, so drafts never trigger a request. */
function EngagementCells({ broadcast }: { broadcast: Broadcast }) {
  const { data } = useBroadcastStats(broadcast.id, true);
  // Opens and clicks are shares of what actually landed — fall back to accepted,
  // then to the recorded recipient count, so an early row still reads sensibly.
  const base = data ? data.delivered || data.accepted || broadcast.recipientCount : 0;
  return (
    <>
      <td className="hidden text-right tabular-nums @xl:table-cell">
        {data ? rate(data.opened, base) : '…'}
      </td>
      <td className="hidden text-right tabular-nums @2xl:table-cell">
        {data ? rate(data.clicked, base) : '…'}
      </td>
    </>
  );
}

export function BroadcastsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useBroadcasts();

  const needle = search.trim().toLowerCase();

  const rows = useMemo(() => {
    const all = data ?? [];
    return all.filter((b) => {
      if (status !== 'all' && b.status !== status) return false;
      if (!needle) return true;
      return b.name.toLowerCase().includes(needle) || b.subject.toLowerCase().includes(needle);
    });
  }, [data, needle, status]);

  const open = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id }, { target: targetFor(event) });
  };

  const filtering = status !== 'all' || needle !== '';

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Broadcasts list controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search broadcasts"
              placeholder="Search broadcasts…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        }
        primaryAction={{
          label: 'New broadcast',
          icon: faPlus,
          onClick: (event) => {
            ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
          },
          title: 'New broadcast — hold Shift to open alongside, Alt for a new window',
        }}
        controls={
          <div className="w-40 shrink-0">
            <NativeSelect
              size="sm"
              aria-label="Filter by status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
              }}
            >
              <option value="all">Any status</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="sent">Sent</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </NativeSelect>
          </div>
        }
        views={{
          target: '/email/broadcasts',
          params: { q: search.trim(), status },
          onApply: (next) => {
            setSearch(next.q ?? '');
            setStatus(next.status ?? 'all');
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
            icon={<Icon glyph={faPaperPlane} className="size-6" aria-hidden />}
            title="Could not load your broadcasts"
            description="Something went wrong reaching the server. Anything already sent is unaffected — try again in a moment."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isPending ? (
          <PaneWaiting label="Loading broadcasts…" />
        ) : rows.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={filtering}
            noResults={{
              icon: <Icon glyph={faPaperPlane} className="size-6" aria-hidden />,
              title: 'No broadcasts match those filters',
              description: 'Try a different search, or switch the status back to Any.',
            }}
            firstRun={{
              title: 'No broadcasts yet',
              description:
                'A broadcast is one email sent to a group of people at once — a newsletter, an offer, an announcement. Write your first to reach your audience.',
              actions: (
                <Button
                  size="sm"
                  color="module"
                  onClick={(event) => {
                    ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
                  }}
                >
                  <Icon glyph={faPlus} className="size-4" aria-hidden />
                  New broadcast
                </Button>
              ),
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Name</th>
                <th className="hidden text-right @md:table-cell">Sent to</th>
                <th className="hidden @lg:table-cell">When</th>
                <th className="hidden text-right @xl:table-cell">Opened</th>
                <th className="hidden text-right @2xl:table-cell">Clicked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((broadcast) => {
                const state = broadcastState(broadcast.status);
                const isSent = broadcast.status === 'sent' || broadcast.status === 'sending';
                return (
                  <tr
                    key={broadcast.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      open(broadcast.id, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      open(broadcast.id, event);
                    }}
                  >
                    <td className="max-w-72">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{broadcast.name}</span>
                        <span className="truncate text-sm">{broadcast.subject}</span>
                      </div>
                    </td>
                    <td className="hidden text-right tabular-nums @md:table-cell">
                      {isSent ? broadcast.recipientCount.toLocaleString() : '—'}
                    </td>
                    <td className="hidden text-sm @lg:table-cell">
                      {broadcast.sentAt ? (
                        <Timestamp value={broadcast.sentAt} format="relative" />
                      ) : broadcast.scheduledAt ? (
                        <Timestamp value={broadcast.scheduledAt} format="relative" />
                      ) : (
                        'Not sent yet'
                      )}
                    </td>
                    {isSent ? (
                      <EngagementCells broadcast={broadcast} />
                    ) : (
                      <>
                        <td className="hidden text-right @xl:table-cell">—</td>
                        <td className="hidden text-right @2xl:table-cell">—</td>
                      </>
                    )}
                    <td>
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

      <p className="shrink-0 px-1 text-xs">
        Click a broadcast to open it · Shift-click to open alongside · Alt-click for a new window
      </p>
    </div>
  );
}
