'use client';

// The people & equipment table, and the two things a row has to say beyond its
// name: what kind of thing it is, and whether it is in use.

import { Badge } from '@wizeworks/silicaui-react';

import { Table } from '../../components/table';
import { resourceKindLabel, resourceState, type SchedulingResource } from './setup-data';

/** The capacity note that makes sense for this KIND — a pooled resource holds
 *  several bookings at once, a table seats a party, staff hold one at a time. */
export function capacityNote(resource: SchedulingResource): string | null {
  if (resource.kind === 'table') {
    if (resource.capacityMin && resource.capacityMax) {
      return `Seats ${String(resource.capacityMin)}–${String(resource.capacityMax)}`;
    }
    if (resource.capacityMax) return `Seats up to ${String(resource.capacityMax)}`;
  }
  if (!resource.exclusive && resource.capacity > 1) {
    return `${String(resource.capacity)} at once`;
  }
  return null;
}

type Open = (resource: SchedulingResource, event: { shiftKey: boolean; altKey: boolean }) => void;

function ResourceRow({ resource, onOpen }: { resource: SchedulingResource; onOpen: Open }) {
  const state = resourceState(resource);
  const holds = capacityNote(resource);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(resource, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(resource, event);
      }}
    >
      <td className="w-full max-w-0">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{resource.name}</span>
          <span className="truncate text-sm @lg:hidden">
            {resourceKindLabel(resource.kind)}
            {holds ? ` · ${holds}` : ''}
          </span>
        </span>
      </td>
      <td className="hidden whitespace-nowrap @lg:table-cell">
        {resourceKindLabel(resource.kind)}
      </td>
      <td className="hidden whitespace-nowrap @xl:table-cell">{holds ?? '—'}</td>
      <td>
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </td>
    </tr>
  );
}

export function ResourcesTable({ rows, onOpen }: { rows: SchedulingResource[]; onOpen: Open }) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Name</th>
          <th className="hidden whitespace-nowrap @lg:table-cell">Kind</th>
          <th className="hidden whitespace-nowrap @xl:table-cell">Holds</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((resource) => (
          <ResourceRow key={resource.id} resource={resource} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
