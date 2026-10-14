'use client';

// Five kinds of nothing: no match, nothing running low (GOOD news, said warmly),
// no reorder rules yet (nothing can ever warn you), and a failed load. The summary
// read tells the two look-alike empty lists apart.

// The fifth is not an empty list: SOME lines have a level and most do not, and
// nothing else on screen distinguishes "one thing to buy" from "one thing watched".

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Button,
  EmptyState,
} from '@wizeworks/silicaui-react';
import {
  faBoxCheck,
  faBoxOpen,
  faMagnifyingGlass,
  faSliders,
  faTruck,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneLoadError } from '../../components/pane-load-error';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { REORDER_RULES_ADVICE, emptyAdvice } from './reorder-shared';
import { unsuppliedNote } from './reorder-supplier-words';

/** A failed load REPLACES the table: an empty grid under live filters reads as
 *  "nothing needs reordering", which is the opposite of unknown. */
export function ReorderLoadFailed({ error }: { error: unknown }) {
  return (
    <PaneLoadError
      icon={<Icon glyph={faBoxOpen} className="size-6" aria-hidden />}
      title="Could not work out what needs reordering"
      description="This is a problem reaching the server. Your stock and orders are unaffected: the list just could not be read right now."
      error={error}
    />
  );
}

export function NothingMatches({
  search,
  locationName,
  supplierName,
}: {
  search: string;
  locationName: string | null;
  supplierName: string | null;
}) {
  return (
    <EmptyState
      icon={<Icon glyph={faMagnifyingGlass} className="size-6" aria-hidden />}
      title="Nothing matches that"
      description={emptyAdvice(search, locationName, supplierName)}
    />
  );
}

export function NoReorderRules({ ctx }: { ctx: SurfaceContext }) {
  return (
    <EmptyState
      icon={<Icon glyph={faSliders} className="size-6" aria-hidden />}
      title="No reorder rules set up yet"
      description={REORDER_RULES_ADVICE}
      actions={
        <Button
          size="sm"
          color="module"
          onClick={() => {
            ctx.open('commerce.product.stock', {}, { target: 'beside' });
          }}
        >
          How many you have
        </Button>
      }
    />
  );
}

// How much of the catalog this list can see, shown only when some lines have a
// level and some do not. A list that watches only what it was told to watch must
// say how much that is, or its silence about the rest reads as reassurance.
export function PartialCoverNote({
  ctx,
  policyCount,
  levelCount,
}: {
  ctx: SurfaceContext;
  policyCount: number | undefined;
  levelCount: number | undefined;
}) {
  if (policyCount === undefined || levelCount === undefined) return null;
  const uncovered = levelCount - policyCount;
  if (policyCount === 0 || uncovered <= 0) return null;

  return (
    <Alert color="warning">
      <AlertContent>
        <AlertTitle>
          {uncovered} of your {levelCount} stock lines have no reorder level
        </AlertTitle>
        <AlertDescription>
          This list only watches the lines you have set a level for, so those{' '}
          {uncovered === 1 ? 'one is' : 'ones are'} not on it however low{' '}
          {uncovered === 1 ? 'it gets' : 'they get'}. Set a level and how many to buy on “How many
          you have”, and they start warning you here. “At risk” looks at everything meanwhile,
          whether a level is set or not.
        </AlertDescription>
      </AlertContent>
      <Button
        size="sm"
        color="module"
        onClick={() => {
          ctx.open('commerce.product.stock', {}, { target: 'beside' });
        }}
      >
        How many you have
      </Button>
    </Alert>
  );
}

// The lines that cannot leave this list: no supplier means no order can be drafted,
// so `useReorderSelection` refuses them. Measured 2026-09-18, that was 71 of 76
// triggered lines platform-wide, so for most accounts the refusal IS the screen.

// Sits under the reorder-level note, not instead of it: two different reasons this
// list cannot do its job, and an account can have both at once.
export function NoSupplierNote({
  ctx,
  unsupplied,
  total,
}: {
  ctx: SurfaceContext;
  unsupplied: number | undefined;
  total: number | undefined;
}) {
  const note = unsuppliedNote(unsupplied, total);
  if (!note) return null;

  return (
    <Alert color="warning">
      <AlertContent>
        <AlertTitle>{note.title}</AlertTitle>
        <AlertDescription>{note.body}</AlertDescription>
      </AlertContent>
      <Button
        size="sm"
        color="module"
        onClick={() => {
          ctx.open('inventory.suppliers.list', {}, { target: 'beside' });
        }}
      >
        <Icon glyph={faTruck} className="size-4" aria-hidden />
        Suppliers
      </Button>
    </Alert>
  );
}

export function NothingNeedsReordering() {
  return (
    <EmptyState
      icon={<Icon glyph={faBoxCheck} className="size-6" aria-hidden />}
      title="Nothing needs reordering"
      description="Every product with a reorder level is comfortably above it. As things run down they will appear here, most urgent first, ready to turn into orders."
    />
  );
}
