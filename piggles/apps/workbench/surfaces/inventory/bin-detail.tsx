'use client';

// ONE SHELF: what it is, and what is on it. The label IS the editable field, not
// also a heading above it; archive sits in the pane chrome, not a "Status" card.

// The contents sit right under the form, not behind a tab: they are why people
// open a shelf, and each row opens that item's stock.

// Archiving is refused while it holds stock: those units would vanish from view
// while still counting toward the location total, so nobody could find the gap.

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card, EmptyState, Text } from '@wizeworks/silicaui-react';
import { faGrid } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { productCopy } from '../../lib/product';
import { useBinDetail, type BinDetailState } from './use-bin-detail';
import { BinToolbar } from './bin-toolbar';
import { BinWhatSection } from './bin-what-section';
import { BinWhereSection } from './bin-where-section';
import { BinWorkedSection } from './bin-worked-section';
import { BinContentsSection } from './bin-contents-section';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

function BinDetailPane({ ctx, state }: { ctx: SurfaceContext; state: BinDetailState }) {
  const { isNew, isSystem, draft, set, activeLocations, bin, contents } = state;
  const rows = contents.data ?? [];
  return (
    <div className={PANE_SHELL}>
      <BinToolbar ctx={ctx} state={state} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          {isSystem ? (
            <Text className="text-sm">
              {productCopy(
                'inventory.bin.systemShelf',
                'This shelf is provided by Piggles. You can rename it and set where it falls in the pick order; its label and kind are fixed because other parts of the system look for it.'
              )}
            </Text>
          ) : null}

          <BinWhatSection
            draft={draft}
            set={set}
            isNew={isNew}
            isSystem={isSystem}
            activeLocations={activeLocations}
          />
          <BinWhereSection draft={draft} set={set} />
          <BinWorkedSection draft={draft} set={set} />

          {!isNew ? <BinContentsSection ctx={ctx} bin={bin} rows={rows} /> : null}

          {/* Carded like its peer sections. A compact EmptyState, not <PaneEmpty>: this
              is a notice beside a form, and the full-size picture would outrank the form. */}
          {isNew && activeLocations.length === 0 ? (
            <Card className="p-4">
              <EmptyState
                size="sm"
                icon={<Icon glyph={faGrid} className="size-6" aria-hidden />}
                title="No locations yet"
                description="A shelf lives inside a location, so add the place first."
              />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function BinDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const state = useBinDetail(ctx);
  const { isNew, bin } = state;

  // A shelf that is not there (removed, or another business's id) says so, rather
  // than opening as a blank one that would save as something new (persona issue 226).
  if (!isNew && bin.isError) {
    return (
      <div className={PANE_SHELL}>
        <PaneLoadError
          error={bin.error}
          noun="shelf"
          title="Could not load this shelf"
          description="This is a problem reaching the server. The shelf itself is unaffected. Try again in a moment."
          onRetry={() => {
            void bin.refetch();
          }}
        />
      </div>
    );
  }
  if (!isNew && bin.isPending) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  return <BinDetailPane ctx={ctx} state={state} />;
}
