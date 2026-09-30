'use client';

import { useEffect } from 'react';

// A STOCK COUNT SESSION — start one, count each item, apply it to correct your
// real stock numbers in one go.
//
// ── One surface, two states, never a create modal ────────────────────────
//
// A new count IS this surface started empty ({id:'new'}); an open count is the
// same surface with a server row behind it ({id}). Starting a count is real work
// with a durable result you come back to, so it is a pane. On creation the pane
// REPLACES itself with the managed view of the count that now exists, rather than
// leaving a spent form beside a list that has moved on.
//
// This file is only the routing and the load. The empty form is count-start,
// the loaded session is count-session, and what its buttons do is count-actions.

import { Button, Card } from '@wizeworks/silicaui-react';
import { faClipboardList } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneWaiting } from '../../components/pane-waiting';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useCount } from './counts-data';
import { CountSession } from './count-session';
import { StartCount } from './count-start';
import { COUNT_MODULE } from './count-shared';

export function CountDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : '';

  if (id === 'new') return <StartCount ctx={ctx} />;
  return <LoadedCount ctx={ctx} id={id} />;
}

function LoadedCount({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const count = useCount(id);

  // The tab's name, once the record is here. Sixty-one of this console's
  // seventy-five detail panes do this; the ones that did not put identical
  // words on every tab they opened, which is the one thing the strip is for.
  // [[feedback_a_fix_leaves_its_neighbour_behind]]
  const countNumber = count.data?.number;
  useEffect(() => {
    if (countNumber) ctx.setTitle(countNumber);
  }, [countNumber, ctx]);

  if (id === '') {
    return (
      <div className={PANE_SHELL}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneEmpty
            module={COUNT_MODULE}
            icon={<Icon glyph={faClipboardList} className="size-6" aria-hidden />}
            title="No count was chosen"
            description="This pane shows one stock count. Open it from the Stock counts list, or start a new one."
            actions={
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  ctx.open('inventory.counts.list', undefined, { target: 'replace' });
                }}
              >
                Open stock counts
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  if (count.isError) {
    return (
      <div className={PANE_SHELL}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            error={count.error}
            title="Could not load this count"
            description="This is a problem reaching the server. The count is unaffected. It just could not be read just now."
            missingTitle="This count no longer exists"
            missingDescription="It may have been removed. Your stock and its movement history are unaffected."
            onRetry={() => {
              void count.refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (count.isPending) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting label="Loading count…" />
      </div>
    );
  }

  return (
    <CountSession
      ctx={ctx}
      count={count.data}
      isFetching={count.isFetching}
      updatedAt={count.dataUpdatedAt}
      onRefresh={() => {
        void count.refetch();
      }}
    />
  );
}
