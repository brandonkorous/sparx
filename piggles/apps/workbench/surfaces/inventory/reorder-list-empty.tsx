'use client';

// Five kinds of nothing, four of which mean different things.
//
// Nothing matches the search or a filter · nothing is running low, which is GOOD
// news and says so warmly · no reorder rules exist yet, so nothing can ever warn
// you. The last two both look like an empty list and mean opposite things, which
// is why the summary read exists to tell them apart.
//
// The fifth is not an empty list at all, and is the one that actually reaches
// people: SOME lines have a level and most do not. The rows that do are shown,
// the rows that do not are not, and nothing on the screen distinguishes "there
// is one thing to buy" from "there is one thing being watched".

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
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { REORDER_RULES_ADVICE, emptyAdvice } from './reorder-shared';
import { unsuppliedNote } from './reorder-supplier-words';

/**
 * A failed load REPLACES the table — an empty grid under live filters invites
 * the reading that nothing needs reordering, which is the opposite of unknown.
 */
export function ReorderLoadFailed() {
  return (
    <EmptyState
      icon={<Icon glyph={faBoxOpen} className="size-6" aria-hidden />}
      title="Could not work out what needs reordering"
      description="This is a problem reaching the server. Your stock and orders are unaffected: the list just could not be read right now."
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

/**
 * How much of the catalogue this list is able to see.
 *
 * Shown whenever some lines have a reorder level and some do not — never on the
 * two ends, where an empty state already carries the message. A list that only
 * ever watches what somebody has told it to watch has to say how much that is,
 * or its silence about the rest reads as reassurance about the rest.
 */
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

/**
 * The lines on this list that cannot leave it.
 *
 * A worklist row with no supplier is running low like any other, but drafting
 * an order needs somebody to send it to — so `useReorderSelection` refuses to
 * choose it. Everything the screen said about that refusal was a tick box that
 * did nothing when clicked. MEASURED across every tenant on 2026-09-18: 71 of
 * the platform's 76 triggered lines, including all 65 of Threadline's and the
 * only one on Juniper Row's, so for most accounts opening this screen the
 * refusal IS the screen.
 *
 * Sits under the reorder-level note, not instead of it: they are two different
 * reasons this list cannot do its job, and an account can have both at once.
 */
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
