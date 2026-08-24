'use client';

// ONE PLACE — create it, then everything about it.
//
// Create and manage are the same surface: `{ id: 'new' }` builds it, `{ id }`
// manages it, so the form is written once.
//
// The one thing this surface has to make obvious is the difference between
// SWITCHING OFF and REMOVING. Switching off retires a place while every past
// booking keeps its history, and it is always available. Removing is refused
// outright while bookings point here — the server answers LOCATION_IN_USE — so
// the form says so BEFORE the owner tries it rather than after.
//
// This file routes and loads; the form is location-editor.

import { Card } from '@wizeworks/silicaui-react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { isNotFound, useLocation } from './setup-data';
import { BLANK, draftFrom } from './location-draft';
import { LocationEditor } from './location-editor';

export function LocationDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';

  if (id !== 'new') return <LocationLoader ctx={ctx} id={id} />;

  // No wait for the business zone, and no stamping it either. A new place starts
  // on "same as your business", which stays true if the business zone later
  // changes — copying the value in would have frozen today's answer onto the row
  // and left it behind (issue 178).
  return <LocationEditor ctx={ctx} id="new" initial={BLANK} existing={null} />;
}

function LocationLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const { data, isPending, isError, error, refetch, isFetching, dataUpdatedAt } = useLocation(id);

  if (isError) {
    const missing = isNotFound(error);
    return (
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneLoadError
          reason={missing ? 'missing' : 'unreachable'}
          title={missing ? 'This place is gone' : 'Could not load this place'}
          description={
            missing
              ? 'It was removed, or the link is out of date.'
              : 'This is a problem reaching the server. The place itself is unaffected — nothing has been lost.'
          }
          onRetry={() => {
            void refetch();
          }}
        />
      </Card>
    );
  }

  if (isPending || !data) {
    return (
      <div className={PANE_SHELL}>
        <PaneWaiting />
      </div>
    );
  }

  return (
    <LocationEditor
      ctx={ctx}
      id={id}
      initial={draftFrom(data)}
      existing={data}
      isFetching={isFetching}
      updatedAt={dataUpdatedAt}
      onRefresh={() => {
        void refetch();
      }}
    />
  );
}
