'use client';

// The places table, and the one column that needed thinking about.
//
// A place's TIME ZONE used to print whatever string was in the column, which was
// `UTC` on every business that had never opened this screen — a default nobody
// chose, rendered exactly like a decision somebody made (issue 178). It now says
// which of the three it is.

import { Badge } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { zoneCity } from '../../lib/timezones';
import { formatAddress, type BusinessLocation } from './setup-data';

/** "3 people & things · 2 services", or what to say when nothing is filed here
 *  at all — which is the answer that decides whether a place can be removed. */
function filedNote(location: BusinessLocation): string {
  const parts: string[] = [];
  const { resources, services, bookings } = location.counts;
  if (resources > 0)
    parts.push(`${String(resources)} ${resources === 1 ? 'person or thing' : 'people & things'}`);
  if (services > 0) parts.push(`${String(services)} ${services === 1 ? 'service' : 'services'}`);
  if (bookings > 0) parts.push(`${String(bookings)} ${bookings === 1 ? 'booking' : 'bookings'}`);
  return parts.length > 0 ? parts.join(' · ') : 'Nothing filed here yet';
}

/**
 * What clock this place runs on, and where that answer came from.
 *
 * Three states, because there are three: the place has its own zone, it follows
 * the business, or nobody anywhere has said. The third used to be
 * indistinguishable from the first.
 *
 * The city alone, not the IANA name. "America/Los_Angeles" is jargon, and this
 * column is only telling somebody which place is which.
 */
function ZoneCell({ zone, businessZone }: { zone: string | null; businessZone: string | null }) {
  if (zone !== null) return <>{zoneCity(zone)}</>;
  if (businessZone !== null) {
    return (
      <span className="flex min-w-0 flex-col">
        <span>{zoneCity(businessZone)}</span>
        <span className="text-sm">from your business</span>
      </span>
    );
  }
  // Nothing here and nothing on the business, so the times on this page are
  // being read off whatever computer is open. Worth saying, and worth saying
  // where the remedy is, because the remedy is not on this screen.
  return <span className="text-warning">Not set</span>;
}

function LocationRow({
  location,
  businessZone,
  onOpen,
}: {
  location: BusinessLocation;
  businessZone: string | null;
  onOpen: (location: BusinessLocation, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const address = formatAddress(location.address);
  const filed = filedNote(location);
  return (
    <tr
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
      <td className="w-full max-w-0">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{location.name}</span>
          {/* The address is only ever shown here, so it always shows. The "filed
              here" line is a NARROW-SCREEN STAND-IN for its own column — without
              the hide it printed the same sentence twice on one row. */}
          {address === '' ? (
            <span className="truncate text-sm @xl:hidden">{filed}</span>
          ) : (
            <span className="truncate text-sm">{address}</span>
          )}
        </span>
      </td>
      <td className="hidden whitespace-nowrap @xl:table-cell">{filed}</td>
      <td className="hidden whitespace-nowrap @lg:table-cell">
        <ZoneCell zone={location.timezone} businessZone={businessZone} />
      </td>
      <td>
        <Badge color={location.isActive ? 'success' : 'neutral'} variant="soft" size="sm">
          {location.isActive ? 'In use' : 'Off'}
        </Badge>
      </td>
    </tr>
  );
}

export function LocationsTable({
  rows,
  businessZone,
  onOpen,
}: {
  rows: BusinessLocation[];
  businessZone: string | null;
  onOpen: (location: BusinessLocation, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Name</th>
          <th className="hidden whitespace-nowrap @xl:table-cell">Filed here</th>
          <th className="hidden whitespace-nowrap @lg:table-cell">Time zone</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((location) => (
          <LocationRow
            key={location.id}
            location={location}
            businessZone={businessZone}
            onOpen={onOpen}
          />
        ))}
      </tbody>
    </Table>
  );
}
