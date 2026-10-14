'use client';

// The booking rules table and its empty state, filling the card in policies-list.

import { Button } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faPlus, faShieldCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListEmptyState } from '../../components/list-empty-state';
import { policySummary, reminderSummary, type BookingPolicy } from './setup-data';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'scheduling';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

export function PoliciesEmpty({
  narrowed,
  openNew,
}: {
  narrowed: boolean;
  openNew: (event: OpenEvent) => void;
}) {
  return (
    <ListEmptyState
      module={MODULE}
      filtered={narrowed}
      noResults={{
        icon: <Icon glyph={faShieldCheck} className="size-6" aria-hidden />,
        title: 'Nothing matches that',
        description: 'Try part of a rule set’s name.',
      }}
      firstRun={{
        title: 'No booking rules yet',
        description:
          'Booking rules decide how much notice you need, what happens if someone cancels late or misses a booking, and whether a deposit is taken. Set up a rule set and you can apply it to any service.',
        actions: (
          <Button
            size="sm"
            color="module"
            onClick={() => {
              openNew({ shiftKey: false, altKey: false });
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            New rule set
          </Button>
        ),
      }}
    />
  );
}

function PolicyRow({
  policy,
  onOpen,
}: {
  policy: BookingPolicy;
  onOpen: (policy: BookingPolicy, event: OpenEvent) => void;
}) {
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(policy, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(policy, event);
      }}
    >
      <td className="w-full max-w-0 min-w-56">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{policy.name}</span>
          {/* Two lines, not one joined by a dot: at 390px the join cut off the
              reminders, the half hardest to find anywhere else. */}
          <span className="truncate text-sm @md:hidden">{policySummary(policy)}</span>
          <span className="truncate text-sm @md:hidden">{reminderSummary(policy)}</span>
        </span>
      </td>
      <td className="hidden whitespace-nowrap @md:table-cell">{policySummary(policy)}</td>
      <td className="hidden whitespace-nowrap @md:table-cell">{reminderSummary(policy)}</td>
    </tr>
  );
}

export function PoliciesTable({
  rows,
  onOpen,
}: {
  rows: BookingPolicy[];
  onOpen: (policy: BookingPolicy, event: OpenEvent) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Rule set</th>
          <th className="hidden whitespace-nowrap @md:table-cell">What it asks of a customer</th>
          {/* Reminders are what the product DOES, not a term a customer agrees to,
              and nobody thinks to look for them: so their own column. */}
          <th className="hidden whitespace-nowrap @md:table-cell">Before the booking</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((policy) => (
          <PolicyRow key={policy.id} policy={policy} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
