'use client';

// One location — created or edited in the same pane, because the two differ by
// which fields are required rather than by what they are. This file loads the
// row and routes; the form is location-editor.

import { Card } from '@wizeworks/silicaui-react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { isNotFound, useLocation } from './locations-data';
import { BLANK, draftFrom } from './location-draft';
import { LocationEditor } from './location-editor';

/* ── The pane ───────────────────────────────────────────────────────────── */

export function LocationDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  const isNew = id === 'new';
  const location = useLocation(id);

  if (isNew) {
    return <LocationEditor ctx={ctx} id="new" initial={BLANK} existing={null} />;
  }

  // A failed load REPLACES the form — never an empty form beside a dead Save,
  // which invites editing a location you cannot see.
  if (location.isError) {
    const gone = isNotFound(location.error);
    return (
      <div className={PANE_SHELL}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            reason={gone ? 'missing' : 'unreachable'}
            title={gone ? 'This location no longer exists' : 'Could not load this location'}
            description={
              gone
                ? 'It has been archived or removed. Its past stock movements are unaffected.'
                : 'This is a problem reaching the server. Nothing about the location has changed.'
            }
            onRetry={() => {
              void location.refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (location.isPending || !location.data) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  // `key` on the id remounts the editor when the pane is pointed at a different
  // location, so the draft is re-seeded from the new row rather than kept from
  // the last one — the "replace" hop after create relies on this.
  return (
    <LocationEditor
      key={location.data.id}
      ctx={ctx}
      id={id}
      initial={draftFrom(location.data)}
      existing={location.data}
      isFetching={location.isFetching}
      updatedAt={location.data ? location.dataUpdatedAt : undefined}
      onRefresh={() => {
        void location.refetch();
      }}
    />
  );
}
