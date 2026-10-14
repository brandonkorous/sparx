'use client';

// The two states where there are no figures: the load failed, or nothing has been
// counted yet. The second offers the two actions rather than describing a journey
// to a product "Stock tab" that does not exist (product facets are panes).

import { Button, EmptyState } from '@wizeworks/silicaui-react';
import { faBoxes, faChartColumn } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneLoadError } from '../../components/pane-load-error';
import type { SurfaceContext } from '../../lib/surfaces/registry';

// A failed valuation is a failed report: every other figure hangs off it, so its
// failure REPLACES the surface rather than leaving empty cards implying you own nothing.
export function ReportsLoadFailed({ error }: { error: unknown }) {
  return (
    <PaneLoadError
      icon={<Icon glyph={faChartColumn} className="size-6" aria-hidden />}
      title="Could not load your reports"
      description="This is a problem reaching the server. Your stock and its history are unaffected: the figures just could not be worked out just now."
      error={error}
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
