'use client';

// The locations table. One row per place you keep stock, with where it came from
// beside its name — a location a sample pack made outlives the rest of that pack,
// so the list has to be able to say so.

import { Badge } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import type { Location } from './locations-data';
import { locationPlace, locationState, locationTypeLabel } from './locations-vocabulary';

interface Modifiers {
  shiftKey: boolean;
  altKey: boolean;
}

function Row({
  location,
  onOpen,
}: {
  location: Location;
  onOpen: (location: Location, event: Modifiers) => void;
}) {
  const state = locationState(location);
  const place = locationPlace(location);
  return (
    <tr
      key={location.id}
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(location, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(location, event);
      }}
    >
      {/* `max-w-0 w-full` makes this the cell that GIVES: a table cell
            sizes to its content, so without it a long location name
            pushes the row wider and shoves the State badge off the right
            edge — the one column that must never be the one to go. */}
      <td className="w-full max-w-0">
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{location.name}</span>
            {/* Where it came FROM, beside the name, because the whole
                  problem is that a place nobody set up looks exactly
                  like one they did. `info` rather than `warning`: it is
                  not a fault, it is an origin. */}
            {location.isSample ? (
              <Badge color="info" variant="soft" size="sm" className="shrink-0">
                Sample
              </Badge>
            ) : null}
          </span>
          {/* The code is how the shelves are labelled — mono because it
                is a code, not prose. */}
          <span className="truncate font-mono text-sm">{location.code}</span>
          {/* Below @lg the Kind column is gone; below @xl the Where
                column is gone. Each folds back here so a narrow pane
                still says what the place is and where it is. */}
          <span className="truncate text-sm @lg:hidden">{locationTypeLabel(location.type)}</span>
          {place ? <span className="truncate text-sm @xl:hidden">{place}</span> : null}
        </span>
      </td>
      <td className="hidden whitespace-nowrap @lg:table-cell">
        {locationTypeLabel(location.type)}
      </td>
      <td className="hidden max-w-48 truncate @xl:table-cell">{place ?? '—'}</td>
      <td>
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </td>
    </tr>
  );
}

export function LocationsListTable({
  rows,
  onOpen,
}: {
  rows: Location[];
  onOpen: (location: Location, event: Modifiers) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Location</th>
          <th className="hidden whitespace-nowrap @lg:table-cell">Kind</th>
          <th className="hidden @xl:table-cell">Where</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((location) => (
          <Row key={location.id} location={location} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
