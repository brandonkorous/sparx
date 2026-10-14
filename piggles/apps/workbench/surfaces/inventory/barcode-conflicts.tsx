'use client';

// SHARED BARCODES: the codes two items both claim. A barcode must point at exactly
// one thing or a scan is a coin toss, so the registry refuses the second claimant.
// This is the only inventory screen whose job is to be EMPTY.

// Two answers, and only two: this item owns the code, or it does not. "Keep both"
// is the problem, so each row offers the two buttons that end it and names the
// other claimant so the choice can actually be made.

import { EmptyState, Text } from '@wizeworks/silicaui-react';
import { faArrowRightArrowLeft, faCheckCircle } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useConfirm } from '../../lib/confirm';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { plural } from './data';
import { useBarcodeConflicts, useResolveBarcodeConflict, type BarcodeConflict } from './scan-data';
import { InlineWaiting } from '../../components/inline-waiting';
import { BarcodeConflictCard } from './barcode-conflicts-card';

type Conflicts = ReturnType<typeof useBarcodeConflicts>;

/** The two confirmed answers to a conflict: this item takes the code, or drops it. */
function useConflictAnswers() {
  const resolve = useResolveBarcodeConflict();
  const confirm = useConfirm();

  const takeIt = async (row: BarcodeConflict) => {
    const ok = await confirm({
      title: `Give ${row.value} to ${row.productTitle}?`,
      description: row.heldByProductTitle
        ? `Scanning ${row.value} will start bringing up ${row.productTitle} (${row.sku}) instead of ${row.heldByProductTitle} (${row.heldBySku ?? ''}). The code is removed from that item entirely.`
        : `Scanning ${row.value} will bring up ${row.productTitle} (${row.sku}).`,
      confirmLabel: 'Give it to this item',
      color: 'danger',
    });
    if (!ok) return;
    resolve.mutate({ variantId: row.variantId, action: 'take' });
  };

  const clearIt = async (row: BarcodeConflict) => {
    const ok = await confirm({
      title: `Remove ${row.value} from ${row.productTitle}?`,
      description: `${row.productTitle} (${row.sku}) will no longer claim this code. Nothing changes for the item that has it.`,
      confirmLabel: 'Remove it',
      color: 'danger',
    });
    if (!ok) return;
    resolve.mutate({ variantId: row.variantId, action: 'clear' });
  };

  return { takeIt, clearIt, busy: resolve.isPending };
}

function BarcodeConflictsBody({ ctx, conflicts }: { ctx: SurfaceContext; conflicts: Conflicts }) {
  const { takeIt, clearIt, busy } = useConflictAnswers();
  const rows = conflicts.data ?? [];
  if (conflicts.isError) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faArrowRightArrowLeft} className="size-6" aria-hidden />}
        title="Could not check for shared barcodes"
        description="This is a problem reaching the server. Your codes are unaffected."
        error={conflicts.error}
      />
    );
  }
  if (conflicts.isLoading) {
    return <InlineWaiting label="Checking for shared barcodes…" />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon glyph={faCheckCircle} className="size-6" aria-hidden />}
        title="Every barcode points at one thing"
        description="Nothing to sort out. Scanning any registered code will bring up exactly one item."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <BarcodeConflictCard
          key={row.variantId}
          row={row}
          busy={busy}
          onTake={() => {
            void takeIt(row);
          }}
          onClear={() => {
            void clearIt(row);
          }}
          onOpenItem={() => {
            ctx.open('commerce.product.detail', { id: row.productId }, { target: 'tab' });
          }}
        />
      ))}
    </div>
  );
}

export function BarcodeConflictsSurface({ ctx }: { ctx: SurfaceContext }) {
  const conflicts = useBarcodeConflicts();
  const { isLoading, isFetching, dataUpdatedAt, isError, refetch } = conflicts;
  const rows = conflicts.data ?? [];

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Shared barcodes controls"
        status={
          <Text className="text-sm">
            {rows.length > 0
              ? `${plural(rows.length, 'code', 'codes')} claimed by more than one item`
              : 'Nothing shared'}
          </Text>
        }
        statusReady={!isLoading}
        statusFailed={isError}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={dataUpdatedAt}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <BarcodeConflictsBody ctx={ctx} conflicts={conflicts} />
      </div>
    </div>
  );
}
