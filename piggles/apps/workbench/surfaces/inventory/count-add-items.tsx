'use client';

// The two ways to put an item on a count: scan it, or search for it.
//
// ── Why the two cards say different things ───────────────────────────────
//
// They do not have the same reach, and pretending otherwise is how an owner
// concludes her products are unreachable. Scanning resolves a code against the
// whole catalog and ADDS anything new. The search below it looks through what
// already has stock at this location, because that is the list you are working
// down when you count an established shelf.
//
// On a shop that has never counted anything, that second list is empty — so
// searching "Ash" on a shop with fifteen Ash Overshirts returned nothing, from a
// card headed "Add an item to count" (issue 173). The words now say which is
// which, and the empty result points at the box above rather than dead-ending.

import { useState } from 'react';
import { Button, Heading, SearchInput, Text, useToast } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { afterPaneChange } from '../../lib/defer';
import { useStockLevels } from './data';
import { countErrorMessage, useAddCountLine, type CountDetail } from './counts-data';
import { ScanInput, playScanFeedback } from './scan-input';
import { useScanQueue, useScanToCount, type ScanActionResult } from './scan-data';

/**
 * The scan path, sitting above the search box because it is the fast one.
 *
 * Two behaviours differ from typing a total, and both are stated on screen
 * rather than left to be discovered:
 *
 *   • Each pull ADDS one. Counting a shelf is one trigger pull per item, so ten
 *     pulls on the same thing is ten. Typing a number still replaces it.
 *   • An item that is not on the sheet gets ADDED to the sheet. Finding stock
 *     the system does not know about is the most valuable thing a count does,
 *     and a workflow that refuses it teaches people to leave it off.
 */
export function ScanIntoCount({ count }: { count: CountDetail }) {
  const scan = useScanToCount(count.id);
  const queue = useScanQueue();
  const [result, setResult] = useState<ScanActionResult | null>(null);

  const onScan = async (value: string) => {
    const outcome = await scan.mutateAsync({ value });
    setResult(outcome);
    playScanFeedback(outcome.outcome);
  };

  return (
    <section className="card bg-base-100 flex min-w-0 flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <Heading level={2} className="text-lg font-semibold">
          Scan what you find
        </Heading>
        <Text className="text-sm">
          One pull of the trigger adds one. Anything not already on the list gets added to it, even
          if it has never been counted here.
        </Text>
      </div>
      <ScanInput
        onScan={onScan}
        placeholder="Scan an item"
        result={result}
        busy={scan.isPending}
        queued={queue.size}
        focusOnMount={false}
      />
    </section>
  );
}

export function AddItems({
  countId,
  warehouseId,
  existing,
}: {
  countId: string;
  warehouseId: string;
  existing: Set<string>;
}) {
  const toast = useToast();
  const add = useAddCountLine(countId);
  const [search, setSearch] = useState('');

  const results = useStockLevels({
    q: search.trim(),
    warehouseId,
    lowStockOnly: false,
    sortBy: 'product',
    order: 'asc',
    take: 8,
    skip: 0,
  });

  const matches = (results.data?.items ?? []).filter((level) => !existing.has(level.variantId));

  const addOne = (variantId: string, label: string) => {
    add.mutate(variantId, {
      onSuccess: () => {
        setSearch('');
        afterPaneChange(() => {
          toast.add({ title: `Added ${label}`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not add that item',
          description: countErrorMessage(error, 'It may already be on the count.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <section className="card bg-base-100 flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <Heading level={2} className="text-lg font-semibold">
          Add something already counted here
        </Heading>
        <Text className="text-sm">
          Searches what already has stock at this location. For anything else, use the scanner box
          above — typing a code there works too.
        </Text>
      </div>

      <SearchInput
        size="sm"
        aria-label="Search items to add"
        placeholder="Product name or code…"
        value={search}
        onValueChange={setSearch}
      />

      {search.trim() === '' ? null : results.isFetching && matches.length === 0 ? (
        <Text className="text-sm" role="status">
          Searching…
        </Text>
      ) : matches.length === 0 ? (
        <Text className="text-sm">
          Nothing with stock here matches that, or it is already on the count. If it has never been
          counted here, type its code into the scanner box above and it goes straight on.
        </Text>
      ) : (
        <ul className="flex flex-col gap-1">
          {matches.map((level) => (
            <li key={level.variantId} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{level.productTitle ?? 'Untitled product'}</span>
                <span className="truncate font-mono text-sm">{level.sku ?? 'No code'}</span>
              </span>
              <Button
                size="sm"
                variant="soft"
                color="module"
                className="shrink-0"
                loading={add.isPending}
                onClick={() => {
                  addOne(level.variantId, level.sku ?? level.productTitle ?? 'item');
                }}
              >
                <Icon glyph={faPlus} className="size-4" aria-hidden />
                Add
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
