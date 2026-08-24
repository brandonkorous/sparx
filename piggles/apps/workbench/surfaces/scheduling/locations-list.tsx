'use client';

// PLACES — the premises a business serves customers from: the shop, the clinic,
// the studio, the yard. Every person, service and booking is filed against one.
//
// A table, like every other list. A place is its name and where it is, plus what
// is filed there — the count is the useful column, because it is what tells you
// whether a place is really in use before you switch it off.
//
// Most businesses have exactly one, so this list is usually a single row. That is
// fine: the row is where they name it and set its address and time zone, which
// until now nothing in the product let them do.

import { useState } from 'react';
import { Card, ToggleGroup, ToggleGroupItem } from '@wizeworks/silicaui-react';
import { faEyeSlash, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useLocations, type BusinessLocation } from './setup-data';
import { useBusinessZone } from '../../lib/business-timezone';
import { RowOpenHint } from '../../components/row-open-hint';
import { LocationsBody } from './locations-body';

const DETAIL_KEY = 'scheduling.locations.detail';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function InUseOnlyToggle({
  activeOnly,
  setActiveOnly,
}: {
  activeOnly: boolean;
  setActiveOnly: (next: boolean) => void;
}) {
  return (
    <ToggleGroup
      size="sm"
      color="module"
      className="shrink-0"
      value={activeOnly ? ['active'] : []}
      onValueChange={(next: unknown[]) => {
        setActiveOnly(next.includes('active'));
      }}
    >
      <ToggleGroupItem
        value="active"
        aria-label="Hide switched-off ones"
        title="Hide switched-off ones"
      >
        <Icon glyph={faEyeSlash} className="size-4" aria-hidden />
        <span>In use only</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

function LocationsToolbar({
  activeOnly,
  setActiveOnly,
  openNew,
  refresh,
}: {
  activeOnly: boolean;
  setActiveOnly: (next: boolean) => void;
  openNew: (event: { shiftKey: boolean; altKey: boolean }) => void;
  refresh: React.ReactNode;
}) {
  return (
    <PaneToolbar
      label="Places list controls"
      primaryAction={{
        label: 'Add a place',
        icon: faPlus,
        onClick: openNew,
        title: 'Add a place — hold Shift to open alongside, Alt for a new window',
      }}
      controls={<InUseOnlyToggle activeOnly={activeOnly} setActiveOnly={setActiveOnly} />}
      views={{
        // The surface's REGISTRY KEY as a path, not its URL — `/scheduling/places`
        // is the route and would be wrong here.
        target: '/scheduling/locations',
        params: { active: activeOnly ? '1' : '' },
        onApply: (next) => {
          setActiveOnly(next.active === '1');
        },
      }}
      refresh={refresh}
    />
  );
}

/** Opening a place, or the form for a new one. Shift opens alongside, Alt in its
 *  own window — the same three modifiers every list here honours. */
function useOpenPlace(ctx: SurfaceContext) {
  return {
    openNew: (event: { shiftKey: boolean; altKey: boolean }) => {
      ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
    },
    open: (location: BusinessLocation, event: { shiftKey: boolean; altKey: boolean }) => {
      ctx.open(DETAIL_KEY, { id: location.id }, { target: targetFor(event) });
    },
  };
}

export function LocationsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [activeOnly, setActiveOnly] = useState(false);
  const { data, isPending, isFetching, dataUpdatedAt, isError, refetch } = useLocations(activeOnly);
  // A cached read shared with Business details. `undefined` while it loads is
  // treated as "not set" for one frame, which shows "Not set" rather than a
  // wrong city — the safe way round for a value this column exists to be honest
  // about.
  const businessZone = useBusinessZone();
  const { openNew, open } = useOpenPlace(ctx);

  const rows = data?.items ?? [];
  const reload = () => {
    void refetch();
  };

  return (
    <div className={PANE_SHELL}>
      <LocationsToolbar
        activeOnly={activeOnly}
        setActiveOnly={setActiveOnly}
        openNew={openNew}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={reload}
          />
        }
      />

      <Card className="mx-auto min-h-0 w-full max-w-4xl flex-1 overflow-y-auto">
        <LocationsBody
          isError={isError}
          isPending={isPending}
          rows={rows}
          activeOnly={activeOnly}
          businessZone={businessZone ?? null}
          refetch={reload}
          openNew={openNew}
          open={open}
        />
      </Card>

      {rows.length > 0 ? <RowOpenHint /> : null}
    </div>
  );
}
