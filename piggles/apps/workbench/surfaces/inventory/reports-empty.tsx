'use client';

// The two states where there are no figures: the server could not be reached,
// and nothing has been counted yet.
//
// The second one used to say "Open a product and use its Stock panel to record
// how many you have". Product facets are dockable PANES, not tabs, so a product
// has no Stock tab to open — and the pane is listed as "How many you have", a
// phrase that sentence never put in the reader's head. It now offers the two
// actions instead of describing a journey to a place that does not exist.

import { Button, EmptyState } from '@wizeworks/silicaui-react';
import { faBoxes, faChartColumn } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { SurfaceContext } from '../../lib/surfaces/registry';

/**
 * A failed valuation is a failed report — it is the spine every other figure
 * hangs off, so its failure REPLACES the surface rather than leaving empty
 * cards implying you own nothing.
 */
export function ReportsLoadFailed() {
  return (
    <EmptyState
      icon={<Icon glyph={faChartColumn} className="size-6" aria-hidden />}
      title="Could not load your reports"
      description="This is a problem reaching the server. Your stock and its history are unaffected — the figures just could not be worked out just now."
    />
  );
}

export function NothingToReportOn({ ctx }: { ctx: SurfaceContext }) {
  return (
    <EmptyState
      icon={<Icon glyph={faBoxes} className="size-6" aria-hidden />}
      title="Nothing to report on yet"
      description="Every figure here is worked out from stock you have counted. Until something is counted there is nothing to value, nothing to age, and no pace to measure."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            color="module"
            onClick={() => {
              ctx.open('inventory.counts.list', {}, { target: 'tab' });
            }}
          >
            Count what you have
          </Button>
          <Button
            size="sm"
            variant="outline"
            color="module"
            onClick={() => {
              ctx.open('commerce.product.stock', {}, { target: 'beside' });
            }}
          >
            How many you have
          </Button>
        </div>
      }
    />
  );
}
