'use client';

// The three kinds of nothing on the locations list: the server could not be
// reached, it is still loading, and there are genuinely none — which itself
// splits by whether a filter is doing the emptying.

import { Button, EmptyState } from '@wizeworks/silicaui-react';
import { faPlus, faWarehouse } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../components/pane-waiting';
import { ListEmptyState } from '../../components/list-empty-state';

/** The closed-locations hint only appears when closed ones are hidden — advice
 *  to switch on a toggle that is already on sends somebody hunting. */
function firstRunDescription(includeClosed: boolean): string {
  const base =
    'A location is any place you keep stock — a warehouse, a shop, a garage, a van. Set up your first and you can start counting what is in it.';
  return includeClosed
    ? base
    : `${base} If you have closed a location before, switch on “Show closed” to see it.`;
}

export function LocationsListEmpty({
  module,
  isError,
  isPending,
  narrowed,
  advice,
  includeClosed,
  onRetry,
  onNew,
}: {
  module: string;
  isError: boolean;
  isPending: boolean;
  narrowed: boolean;
  advice: string;
  includeClosed: boolean;
  onRetry: () => void;
  onNew: () => void;
}) {
  // A failed load REPLACES the grid — never an empty grid under live filters,
  // which invites someone to conclude they have no locations.
  if (isError) {
    return (
      <EmptyState
        icon={<Icon glyph={faWarehouse} className="size-6" aria-hidden />}
        title="Could not load your locations"
        description="This is a problem reaching the server. Your locations are unaffected — the list just could not be read just now."
        actions={
          <Button
            size="sm"
            color="module"
            onClick={() => {
              onRetry();
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }

  if (isPending) {
    return <PaneWaiting label="Loading locations…" />;
  }

  return (
    <ListEmptyState
      module={module}
      filtered={narrowed}
      noResults={{
        icon: <Icon glyph={faWarehouse} className="size-6" aria-hidden />,
        title: 'Nothing matches that',
        description: advice,
      }}
      firstRun={{
        title: 'No locations yet',
        description: firstRunDescription(includeClosed),
        actions: (
          <Button
            size="sm"
            color="module"
            onClick={() => {
              onNew();
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            New location
          </Button>
        ),
      }}
    />
  );
}
