'use client';

// Approvals: the QUEUE of wholesale orders held over a limit (approve places, reject
// cancels) and the RULES that hold them. A held order may wait on your team, the
// customer's own approvers, or both (sparx persona issue 087).

import { useState, type Dispatch, type SetStateAction } from 'react';
import { SearchInput } from '@wizeworks/silicaui-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { holdQueueNotice } from './approval-hold-notice';
import { useApprovalQueue, useApprovalRules } from './approvals-data';
import { type ApprovedStockNotice } from './sign-off-words';
import { type Decision } from './approvals/shared';
import { RulesSection } from './approvals/rules-section';
import { DecisionDialog } from './approvals/decision-dialog';
import { StockShortNotice } from './approvals/stock-short-notice';
import { QueueSection } from './approvals/queue-section';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

export function ApprovalsSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState<Decision>(null);
  // Approvals this visit that left the customer owed goods, newest first. Kept
  // here, not in the dialog, because the dialog is gone the moment it succeeds.
  const [stockNotices, setStockNotices] = useState<ApprovedStockNotice[]>([]);

  const queue = useApprovalQueue(search.trim());
  const items = queue.data?.items ?? [];

  // The rules below, read here too (same key, no extra request) so an empty queue
  // whose limits are all off says so rather than promise orders will be held.
  const rules = useApprovalRules().data ?? [];
  const emptyQueue = holdQueueNotice(rules);

  return (
    <div className={PANE_SHELL}>
      <ApprovalsToolbar search={search} setSearch={setSearch} queue={queue} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <StockNotices ctx={ctx} stockNotices={stockNotices} setStockNotices={setStockNotices} />
          <QueueSection
            ctx={ctx}
            search={search}
            queue={queue}
            items={items}
            emptyQueue={emptyQueue}
            setDecision={setDecision}
          />

          <RulesSection ctx={ctx} />
        </div>
      </div>

      {decision ? (
        <DecisionDialog
          decision={decision}
          onDone={() => {
            setDecision(null);
          }}
          onStockShort={(notice) => {
            setStockNotices((all) => withStockNotice(all, notice));
          }}
        />
      ) : null}
    </div>
  );
}

function ApprovalsToolbar({
  search,
  setSearch,
  queue,
}: {
  search: string;
  setSearch: (next: string) => void;
  queue: ReturnType<typeof useApprovalQueue>;
}) {
  return (
    <PaneToolbar
      label="Orders to approve controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search held orders"
            placeholder="Order number or company…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
      }
      refresh={
        <RefreshButton
          isFetching={queue.isFetching}
          updatedAt={queue.data ? queue.dataUpdatedAt : undefined}
          onRefresh={() => {
            void queue.refetch();
          }}
        />
      }
    />
  );
}

// Newest first, one per order.
function withStockNotice(
  all: ApprovedStockNotice[],
  notice: ApprovedStockNotice
): ApprovedStockNotice[] {
  return [notice, ...all.filter((one) => one.orderNumber !== notice.orderNumber)];
}

function StockNotices({
  ctx,
  stockNotices,
  setStockNotices,
}: {
  ctx: SurfaceContext;
  stockNotices: ApprovedStockNotice[];
  setStockNotices: Dispatch<SetStateAction<ApprovedStockNotice[]>>;
}) {
  return (
    <>
      {stockNotices.map((notice) => (
        <StockShortNotice
          key={notice.orderNumber}
          notice={notice}
          onOpenWaitingList={() => {
            ctx.open('inventory.backorders', {}, { target: 'beside' });
          }}
          onDismiss={() => {
            setStockNotices((all) => all.filter((one) => one.orderNumber !== notice.orderNumber));
          }}
        />
      ))}
    </>
  );
}
