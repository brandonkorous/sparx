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
import { useLocation } from './setup-data';
import { useBusinessCountry } from '../../lib/business-country';
import { BLANK, draftFrom } from './location-draft';
import { LocationEditor } from './location-editor';

export function LocationDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';

  const businessCountry = useBusinessCountry();
  if (id !== 'new') return <LocationLoader ctx={ctx} id={id} />;
  // Opens on the business's own country, not an empty field (sparx issue 043).
  if (businessCountry === undefined) return <PaneWaiting />;

  // No wait for the business zone, and no stamping it either. A new place starts
  // on "same as your business", which stays true if the business zone later
  // changes — copying the value in would have frozen today's answer onto the row
  // and left it behind (issue 178).
  return (
    <LocationEditor
      ctx={ctx}
      id="new"
      initial={{ ...BLANK, country: businessCountry }}
      existing={null}
    />
  );
}

function LocationLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const { data, isPending, isError, error, refetch, isFetching, dataUpdatedAt } = useLocation(id);

  if (isError) {
    return (
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneLoadError
          error={error}
          title="Could not load this place"
          description="This is a problem reaching the server. The place itself is unaffected. Nothing has been lost."
          missingTitle="This place is gone"
          missingDescription="It was removed, or the link is out of date."
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
