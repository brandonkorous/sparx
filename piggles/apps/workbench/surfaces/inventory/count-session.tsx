'use client';

// A loaded count in any of its states — counting, waiting on approval, ready to
// apply, applied, discarded.
//
// ── Not EditorLayout ──────────────────────────────────────────────────────
//
// The heart of this is a line-by-line count with a running difference — a table
// you read down, not a completion-ordered form with a summary rail. So it is one
// centred, capped column, and the lifecycle action lives in the toolbar where
// the pane's primary action belongs.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  EmptyState,
  Heading,
  Text,
  Timestamp,
} from '@wizeworks/silicaui-react';
import { faClipboardList, faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { useDirtySource } from '../../lib/workbench/dirty';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { plural } from './data';
import {
  countState,
  countTypeLabel,
  type CountDetail,
  type CountLine,
  type CountState,
} from './counts-data';
import { AddItems, ScanIntoCount } from './count-add-items';
import { useCountActions, type ChangedLine } from './count-actions';
import { LinesCard } from './count-lines';
import { buildNotice } from './count-notice';
import { COLUMN, parseQty } from './count-shared';
import { CountToolbar } from './count-toolbar';

interface SessionProps {
  ctx: SurfaceContext;
  count: CountDetail;
  isFetching: boolean;
  updatedAt: number | undefined;
  onRefresh: () => void;
}

export function CountSession({ ctx, count, isFetching, updatedAt, onRefresh }: SessionProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    ctx.setTitle(count.number);
  }, [ctx, count.number]);

  const editable = count.status === 'counting';
  const state = countState(count.status);

  const changed = useMemo<ChangedLine[]>(
    () =>
      count.lines
        .filter((line) => drafts[line.id] !== undefined)
        .map((line) => ({ line, value: parseQty(drafts[line.id]) }))
        .filter(
          (entry): entry is ChangedLine =>
            entry.value !== null && entry.value !== entry.line.countedQuantity
        ),
    [count.lines, drafts]
  );

  const uncounted = count.lines.filter((line) => {
    const value = drafts[line.id] !== undefined ? parseQty(drafts[line.id]) : line.countedQuantity;
    return value === null;
  }).length;

  useDirtySource(
    changed.length > 0,
    `You have counted quantities on ${count.number} that are not saved. Close anyway?`
  );

  const setDraft = (lineId: string, value: string) => {
    setDrafts((current) => ({ ...current, [lineId]: value }));
  };

  const act = useCountActions(count, changed);

  const canFinish = count.lineCount > 0 && uncounted === 0;
  const canApply =
    (count.status === 'review' && !count.requiresApproval) || count.status === 'approved';
  const canApprove = count.status === 'review' && count.requiresApproval;
  const canDiscard =
    count.status === 'counting' || count.status === 'review' || count.status === 'approved';

  const notice = buildNotice(count);
  const existing = new Set(count.lines.map((line) => line.variantId));

  return (
    <div className={PANE_SHELL}>
      <CountToolbar
        ctx={ctx}
        count={count}
        state={state}
        act={act}
        editable={editable}
        unsaved={changed.length}
        canFinish={canFinish}
        canApprove={canApprove}
        canApply={canApply}
        isFetching={isFetching}
        updatedAt={updatedAt}
        onRefresh={onRefresh}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <CountHeader count={count} editable={editable} uncounted={uncounted} state={state} />

          {notice ? (
            <Alert color={notice.tone} variant="soft">
              <AlertContent>
                <AlertTitle>{notice.title}</AlertTitle>
                <AlertDescription>{notice.body}</AlertDescription>
              </AlertContent>
            </Alert>
          ) : null}

          {/* Scanning comes FIRST, above the search box. Counting a shelf by
              scanning is the fast path and searching for each item by name is
              the slow one, so the fast path gets the position. */}
          {editable ? <ScanIntoCount count={count} /> : null}
          {editable ? (
            <AddItems countId={count.id} warehouseId={count.warehouseId} existing={existing} />
          ) : null}

          {count.lineCount === 0 ? (
            <EmptyState
              icon={<Icon glyph={faClipboardList} className="size-6" aria-hidden />}
              title="No items on this count yet"
              description={
                editable
                  ? 'Scan or type a code above to put the first item on it.'
                  : 'This count was closed without any items on it.'
              }
            />
          ) : (
            <LinesCard
              count={count}
              editable={editable}
              drafts={drafts}
              setDraft={setDraft}
              onRemove={(line: CountLine) => {
                act.removeItem(line);
              }}
              removingId={act.removingId}
            />
          )}

          {/* Rare, one-way, and NOT the point of the screen — so it sits under a
              divider after the work, not as a card of equal weight beside it. */}
          {canDiscard ? (
            <div className="border-base-300 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <Text className="min-w-0 text-sm">
                Started this by mistake, or need to begin again?
              </Text>
              <Button
                size="sm"
                variant="ghost"
                color="danger"
                loading={act.pending.cancel}
                onClick={() => {
                  void act.doDiscard();
                }}
              >
                <Icon glyph={faXmark} className="size-4" aria-hidden />
                Discard this count
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Identity first: where this count is, then its reference. */
function CountHeader({
  count,
  editable,
  uncounted,
  state,
}: {
  count: CountDetail;
  editable: boolean;
  uncounted: number;
  state: CountState;
}) {
  return (
    <section className="card bg-base-100 flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Heading level={1} className="min-w-0 text-2xl font-semibold break-words">
            {count.warehouseName ?? 'Stock count'}
          </Heading>
          <Text className="font-mono text-sm">{count.number}</Text>
        </div>
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </div>
      <Text className="text-sm">
        {countTypeLabel(count.type)} · {plural(count.lineCount, 'item', 'items')} · started{' '}
        <Timestamp value={count.startedAt} format="relative" />
        {count.note ? ` · ${count.note}` : ''}
      </Text>
      {editable && count.lineCount > 0 && uncounted > 0 ? (
        <Text className="text-sm">
          {String(count.lineCount - uncounted)} of {plural(count.lineCount, 'item', 'items')}{' '}
          counted — enter the rest before you can finish.
        </Text>
      ) : null}
    </section>
  );
}
