'use client';

// WHOSE STOCK IS THIS: the goods in your building that are not your asset. For
// most businesses this is empty, correctly. For the rest (consignment, a customer's
// own parts, a warehouse partner's buffer) counting them as yours overstates value.

// Ownership changes VALUATION only, never availability: consigned stock is
// sellable, which is the reason to hold it. The screen says so out loud, or someone
// marks a level "consignment" expecting it to vanish from the site.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Card,
  EmptyState,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { faBoxMagnifyingGlass, faHandshake } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useState } from 'react';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural } from './data';
import { useNonOwnedStock } from './demand-data';
import { InlineWaiting } from '../../components/inline-waiting';
import { StockOwnershipTable } from './stock-ownership-table';

type OwnedList = ReturnType<typeof useNonOwnedStock>;
type OpenItem = (variantId: string, event: { shiftKey: boolean; altKey: boolean }) => void;

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function OwnershipBody({ list, onOpen }: { list: OwnedList; onOpen: OpenItem }) {
  const rows = list.data?.items ?? [];
  if (list.isError) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faBoxMagnifyingGlass} className="size-6" aria-hidden />}
        title="Could not load ownership"
        description="This is a problem reaching the server, not a finding about your stock. Try again in a moment."
        error={list.error}
      />
    );
  }
  if (list.isLoading) {
    return <InlineWaiting label="Checking whose stock is whose…" />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon glyph={faHandshake} className="size-6" aria-hidden />}
        title="Everything on your shelves is yours"
        description="Nothing is marked as consignment, customer-owned, or belonging to a warehouse partner. Set it on an item's stock screen when you start holding goods you have not bought."
      />
    );
  }
  return <StockOwnershipTable rows={rows} onOpen={onOpen} />;
}

function OwnershipPicker({
  ownership,
  onOwnership,
}: {
  ownership: string;
  onOwnership: (next: string) => void;
}) {
  return (
    <NativeSelect
      size="sm"
      className="max-w-52 shrink"
      aria-label="Which ownership"
      value={ownership}
      onChange={(event) => {
        onOwnership(event.target.value);
      }}
    >
      <option value="">Everything that is not yours</option>
      <option value="consignment">On consignment</option>
      <option value="customer_owned">A customer’s</option>
      <option value="3pl_owned">Your warehouse partner’s</option>
      <option value="owned">Yours</option>
    </NativeSelect>
  );
}

function OwnershipToolbar({
  list,
  ownership,
  onOwnership,
}: {
  list: OwnedList;
  ownership: string;
  onOwnership: (next: string) => void;
}) {
  const rows = list.data?.items ?? [];
  const totalValueCents = list.data?.totalValueCents ?? 0;
  return (
    <PaneToolbar
      label="Whose stock controls"
      status={
        <Text className="text-sm">
          {rows.length === 0
            ? 'Nothing to show'
            : `${formatCents(totalValueCents)} across ${plural(rows.length, 'line', 'lines')}`}
        </Text>
      }
      statusReady={!list.isLoading}
      statusFailed={list.isError}
      controls={<OwnershipPicker ownership={ownership} onOwnership={onOwnership} />}
      refresh={
        <RefreshButton
          isFetching={list.isFetching}
          updatedAt={list.data ? list.dataUpdatedAt : undefined}
          onRefresh={() => {
            void list.refetch();
          }}
        />
      }
    />
  );
}

function OwnershipAlerts({ rowCount, uncosted }: { rowCount: number; uncosted: number }) {
  return (
    <>
      {rowCount > 0 ? (
        <Alert color="info">
          <AlertContent>
            <AlertTitle>This stock is still on sale</AlertTitle>
            <AlertDescription>
              Marking goods as somebody else’s takes them OUT of your inventory value and leaves
              them fully sellable, which is the whole point of holding consignment. To stop
              something being sold, move it to a shelf that is not for sale instead.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {uncosted > 0 ? (
        <Alert color="warning">
          <AlertContent>
            <AlertTitle>{plural(uncosted, 'line has', 'lines have')} no cost recorded</AlertTitle>
            <AlertDescription>
              The value is shown as blank rather than as nothing, because a zero here would say the
              owner gave that stock to you. Settlement will refuse to close a period containing it.
              Put a cost on the items first.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}
    </>
  );
}

export function StockOwnershipSurface({ ctx }: { ctx: SurfaceContext }) {
  const [ownership, setOwnership] = useState('');
  const list = useNonOwnedStock(ownership ? { ownership } : {});

  const rows = list.data?.items ?? [];
  const uncosted = rows.filter((r) => r.valueCents === null).length;

  const open: OpenItem = (variantId, event) => {
    ctx.open('inventory.stock.item', { variantId }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <OwnershipToolbar list={list} ownership={ownership} onOwnership={setOwnership} />
      <OwnershipAlerts rowCount={rows.length} uncosted={uncosted} />
      <Card className="min-h-0 flex-1 overflow-auto">
        <OwnershipBody list={list} onOpen={open} />
      </Card>
    </div>
  );
}
