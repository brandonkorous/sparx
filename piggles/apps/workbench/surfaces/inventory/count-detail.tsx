'use client';

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
import { isCountNotFound, useCount } from './counts-data';
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
    const gone = isCountNotFound(count.error);
    return (
      <div className={PANE_SHELL}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            reason={gone ? 'missing' : 'unreachable'}
            title={gone ? 'This count no longer exists' : 'Could not load this count'}
            description={
              gone
                ? 'It may have been removed. Your stock and its movement history are unaffected.'
                : 'This is a problem reaching the server. The count is unaffected — it just could not be read just now.'
            }
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
