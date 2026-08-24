'use client';

// What fills the places card: the failure, the wait, the first-run state, or the
// table.

import { Button, EmptyState } from '@wizeworks/silicaui-react';
import { faLocationDot, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { ListEmptyState } from '../../components/list-empty-state';
import { LocationsTable } from './locations-table';
import type { BusinessLocation } from './setup-data';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'scheduling';

interface BodyProps {
  isError: boolean;
  isPending: boolean;
  rows: BusinessLocation[];
  activeOnly: boolean;
  businessZone: string | null;
  refetch: () => void;
  openNew: (event: { shiftKey: boolean; altKey: boolean }) => void;
  open: (location: BusinessLocation, event: { shiftKey: boolean; altKey: boolean }) => void;
}

/** Nothing to show, which is two different situations: a filter that matches
 *  nothing, and a business that has not named its premises yet. */
function LocationsEmpty({
  activeOnly,
  openNew,
}: {
  activeOnly: boolean;
  openNew: (event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  return (
    <ListEmptyState
      module={MODULE}
      filtered={activeOnly}
      noResults={{
        icon: <Icon glyph={faLocationDot} className="size-6" aria-hidden />,
        title: 'Nothing matches that',
        description: 'You are only seeing places that are switched on.',
      }}
      firstRun={{
        title: 'No places yet',
        description:
          'Add the premises you serve customers from — your shop, your clinic, your studio. Your people, your services and your bookings are each filed against one.',
        actions: (
          <Button
            size="sm"
            color="module"
            onClick={() => {
              openNew({ shiftKey: false, altKey: false });
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Add a place
          </Button>
        ),
      }}
    />
  );
}

export function LocationsBody({
  isError,
  isPending,
  rows,
  activeOnly,
  businessZone,
  refetch,
  openNew,
  open,
}: BodyProps) {
  if (isError) {
    return (
      <EmptyState
        icon={<Icon glyph={faLocationDot} className="size-6" aria-hidden />}
        title="Could not load your places"
        description="This is a problem reaching the server. Nothing is affected — the list just could not be read just now."
        actions={
          <Button size="sm" color="module" onClick={refetch}>
            Try again
          </Button>
        }
      />
    );
  }

  if (isPending) {
    return <PaneWaiting />;
  }

  if (rows.length === 0) {
    return <LocationsEmpty activeOnly={activeOnly} openNew={openNew} />;
  }

  return <LocationsTable rows={rows} businessZone={businessZone} onOpen={open} />;
}
