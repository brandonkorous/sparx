'use client';

// Four kinds of nothing, three of which mean different things.
//
// Nothing matches the search or a filter · nothing is running low, which is GOOD
// news and says so warmly · no reorder rules exist yet, so nothing can ever warn
// you. The last two both look like an empty list and mean opposite things, which
// is why the summary read exists to tell them apart.

import { Button, EmptyState } from '@wizeworks/silicaui-react';
import {
  faBoxCheck,
  faBoxOpen,
  faMagnifyingGlass,
  faSliders,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { REORDER_RULES_ADVICE, emptyAdvice } from './reorder-shared';

/**
 * A failed load REPLACES the table — an empty grid under live filters invites
 * the reading that nothing needs reordering, which is the opposite of unknown.
 */
export function ReorderLoadFailed() {
  return (
    <EmptyState
      icon={<Icon glyph={faBoxOpen} className="size-6" aria-hidden />}
      title="Could not work out what needs reordering"
      description="This is a problem reaching the server. Your stock and orders are unaffected — the list just could not be read right now."
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

export function NothingNeedsReordering() {
  return (
    <EmptyState
      icon={<Icon glyph={faBoxCheck} className="size-6" aria-hidden />}
      title="Nothing needs reordering"
      description="Every product with a reorder level is comfortably above it. As things run down they will appear here, most urgent first, ready to turn into orders."
    />
  );
}
