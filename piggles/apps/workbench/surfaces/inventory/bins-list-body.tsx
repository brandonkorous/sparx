'use client';

import { faGrid, faMagnifyingGlass } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { BinsTable, type OpenBin } from './bins-list-table';
import type { BinsList } from './use-bins-list';

/** Registry module for this pane, so the brand draws Stock's own picture rather
 *  than the generic one. */
const MODULE = 'inventory';

/** Telling someone with four hundred shelves to create their first one because
 *  they mistyped is the worst mistake here, and <ListEmptyState> owns that choice. */
function BinsListEmpty({
  narrowed,
  locationName,
}: {
  narrowed: boolean;
  locationName: string | null;
}) {
  return (
    <ListEmptyState
      module={MODULE}
      filtered={narrowed}
      noResults={{
        icon: <Icon glyph={faMagnifyingGlass} className="size-6" aria-hidden />,
        title: 'Nothing matches that',
        description: locationName
          ? `No shelves at ${locationName} match those filters. Try clearing the kind, or switch to every location.`
          : 'No shelves match those filters. Try part of a shelf label or a zone name.',
      }}
      firstRun={{
        icon: <Icon glyph={faGrid} className="size-6" aria-hidden />,
        title: 'No shelves set up yet',
        description:
          'Shelves let you record which part of a location something is in, so people can find it without walking the room. Turn them on for a location from its settings, then add the shelves you actually have.',
      }}
    />
  );
}

/** Loading, failure, empty or the table, all in the one content region. */
export function BinsListBody({ list, onOpen }: { list: BinsList; onOpen: OpenBin }) {
  if (list.isError) {
    return (
      <PaneLoadError
        module={MODULE}
        icon={<Icon glyph={faGrid} className="size-6" aria-hidden />}
        title="Could not load your shelves"
        description="This is a problem reaching the server. Your shelves and their stock are unaffected. They just could not be read just now."
        error={list.error}
        onRetry={() => {
          void list.refetch();
        }}
      />
    );
  }

  if (list.isLoading) {
    return <PaneWaiting module={MODULE} label="Loading shelves…" />;
  }

  if (list.rows.length === 0) {
    return <BinsListEmpty narrowed={list.narrowed} locationName={list.locationName} />;
  }

  return <BinsTable rows={list.rows} onOpen={onOpen} />;
}
