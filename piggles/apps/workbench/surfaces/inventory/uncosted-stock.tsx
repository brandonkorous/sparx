'use client';

// WHAT YOUR STOCK COST YOU: the opening balance, filled in once. Cost is optional,
// so a business can run for months with every value-of-stock figure at $0.00,
// indistinguishable from owning nothing (issue 175).

// Not asked on the product form: a product is created at the moment of LEAST
// knowledge, and cost properly arrives WITH a delivery. What is left is the stock
// you already had on day one, and this is the list of exactly that.

// A typing job, built like one: one column ordered by units held, Enter moves down,
// nothing saves until Save, and the toolbar says what is about to change.

import { useState } from 'react';
import { Button, EmptyState, Text, useToast } from '@wizeworks/silicaui-react';
import { faCoins, faSackDollar } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { PaneWaiting } from '../../components/pane-waiting';
import { RefreshButton } from '../../components/refresh-button';
import { useDirtySource } from '../../lib/workbench/dirty';
import { formatCents, plural } from './data';
import { costsErrorMessage, useSetCosts, useUncostedStock } from './uncosted-data';
import { entriesFrom, extendedTotal } from './uncosted-entries';
import { UncostedTable } from './uncosted-table';

const COLUMN = 'mx-auto flex w-full max-w-4xl flex-col gap-4';

type Stock = ReturnType<typeof useUncostedStock>;
type Typed = Record<string, string>;

function AllCosted() {
  return (
    <EmptyState
      icon={<Icon glyph={faSackDollar} className="size-6" aria-hidden />}
      title="Everything you hold has a cost"
      description="Every value-of-stock figure in the business is a real number. New stock takes its cost from the delivery it arrives on, so this stays empty unless you count something in by hand."
    />
  );
}

function LoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <PaneLoadError
      icon={<Icon glyph={faCoins} className="size-6" aria-hidden />}
      title="Could not work out what is missing a cost"
      description="This is a problem reaching the server. Nothing about your stock or its costs has changed."
      error={error}
      onRetry={onRetry}
    />
  );
}

function UncostedBody({
  stock,
  typed,
  onTyped,
}: {
  stock: Stock;
  typed: Typed;
  onTyped: (variantId: string, next: string) => void;
}) {
  const items = stock.data?.items ?? [];
  if (stock.isError) {
    return (
      <LoadFailed
        error={stock.error}
        onRetry={() => {
          void stock.refetch();
        }}
      />
    );
  }
  if (stock.isPending) return <PaneWaiting label="Finding what has no cost…" />;
  if (items.length === 0) return <AllCosted />;

  return (
    <div className={COLUMN}>
      <Text>
        {plural(stock.data?.total ?? 0, 'thing', 'things')} on your shelves,{' '}
        {plural(stock.data?.uncostedUnits ?? 0, 'unit', 'units')} in all, have never had a cost
        recorded, so they count as nothing in every figure about what your stock is worth. Put in
        what one of each cost you and those figures become real. The biggest holdings are first, so
        filling in the top few fixes most of the number.
      </Text>
      <UncostedTable items={items} typed={typed} onTyped={onTyped} />
    </div>
  );
}

/** Saves the typed costs, then clears them and says what was recorded. */
function useSaveCosts(clearTyped: () => void) {
  const save = useSetCosts();
  const toast = useToast();
  const onSave = (entries: ReturnType<typeof entriesFrom>) => {
    if (entries.length === 0) return;
    save.mutate(entries, {
      onSuccess: (result) => {
        clearTyped();
        toast.add({
          title: `${plural(result.updated, 'cost', 'costs')} recorded`,
          description:
            result.skipped.length > 0
              ? `${plural(result.skipped.length, 'item', 'items')} already had a cost by the time this saved, so nothing there was overwritten.`
              : 'Your value-of-stock figures now count these.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not record those costs',
          description: costsErrorMessage(error, 'Nothing was saved. Try again in a moment.'),
          type: 'error',
        });
      },
    });
  };
  return { onSave, isPending: save.isPending };
}

function UncostedToolbar({
  stock,
  typed,
  saving,
  onSave,
}: {
  stock: Stock;
  typed: Typed;
  saving: boolean;
  onSave: () => void;
}) {
  const items = stock.data?.items ?? [];
  const count = entriesFrom(items, typed).length;
  return (
    <PaneToolbar
      label="Controls for what your stock cost you"
      status={
        count > 0 ? (
          <Text as="span" className="text-sm">
            {plural(count, 'cost', 'costs')} typed · adds {formatCents(extendedTotal(items, typed))}{' '}
            to what your stock is worth
          </Text>
        ) : null
      }
      primary={
        <Button
          color="module"
          size="sm"
          className="ml-auto shrink-0"
          disabled={count === 0 || saving}
          loading={saving}
          onClick={onSave}
        >
          <Icon glyph={faCoins} className="size-4" aria-hidden />
          Save {count > 0 ? plural(count, 'cost', 'costs') : 'costs'}
        </Button>
      }
      refresh={
        <RefreshButton
          isFetching={stock.isFetching}
          updatedAt={stock.data ? stock.dataUpdatedAt : undefined}
          onRefresh={() => {
            void stock.refetch();
          }}
        />
      }
    />
  );
}

export function UncostedStockSurface() {
  const [typed, setTyped] = useState<Typed>({});
  const stock = useUncostedStock();
  const save = useSaveCosts(() => {
    setTyped({});
  });

  const entries = entriesFrom(stock.data?.items ?? [], typed);
  useDirtySource(entries.length > 0, 'You have typed costs that are not saved yet. Close anyway?');

  return (
    <div className={PANE_SHELL}>
      <UncostedToolbar
        stock={stock}
        typed={typed}
        saving={save.isPending}
        onSave={() => {
          save.onSave(entries);
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <UncostedBody
          stock={stock}
          typed={typed}
          onTyped={(variantId, next) => {
            setTyped((current) => ({ ...current, [variantId]: next }));
          }}
        />
      </div>
    </div>
  );
}
