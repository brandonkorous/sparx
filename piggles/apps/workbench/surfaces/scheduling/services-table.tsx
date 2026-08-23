'use client';

// The services table, and the one action a row can carry: putting a removed
// service back. Split out of services-list.tsx (RULE #0.5).
//
// A service is an identity (its name and what kind of booking it is) plus two
// facts you scan down a column — how long it lasts, and its price. The columns
// disclose with @container: docked narrow you see the name and its state; given
// room the kind, the length and the price come back. The name cell is the one
// that GIVES, so the state badge is never shoved off the right edge.

import { Badge, Button, useToast } from '@wizeworks/silicaui-react';
import { faRotateLeft } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { Table } from '../../components/table';
import {
  bookingTypeLabel,
  formatDuration,
  formatMoney,
  schedulingErrorMessage,
  serviceState,
  useRestoreService,
  type SchedulingService,
} from './setup-data';

interface RowEvent {
  shiftKey: boolean;
  altKey: boolean;
}

export function ServicesTable({
  rows,
  onOpen,
}: {
  rows: SchedulingService[];
  onOpen: (service: SchedulingService, event: RowEvent) => void;
}) {
  const toast = useToast();
  const restore = useRestoreService();
  const anyRemoved = rows.some((service) => service.removedAt);

  const putBack = (service: SchedulingService) => {
    restore.mutate(service.id, {
      onSuccess: () => {
        toast.add({
          title: `${service.name} is back`,
          description: 'It is on your website again, and people can book it.',
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not put it back',
          description: schedulingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Service</th>
          <th className="hidden whitespace-nowrap @lg:table-cell">Kind</th>
          <th className="hidden whitespace-nowrap @xl:table-cell">Length</th>
          <th className="hidden whitespace-nowrap @xl:table-cell">Price</th>
          <th>State</th>
          {/* Only when there is something to put back, so the ordinary list is
              not carrying an empty column for a rare case. */}
          {anyRemoved ? <th className="text-right">Bring back</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((service) => {
          const state = serviceState(service);
          const removed = Boolean(service.removedAt);
          return (
            <tr
              key={service.id}
              // A removed service has no detail pane to open — every read but
              // this list filters it out — so the row is not a button.
              className={removed ? undefined : 'cursor-pointer'}
              {...(removed
                ? {}
                : {
                    tabIndex: 0,
                    role: 'button',
                    onClick: (event: React.MouseEvent) => {
                      onOpen(service, event);
                    },
                    onKeyDown: (event: React.KeyboardEvent) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      onOpen(service, event);
                    },
                  })}
            >
              <td className="w-full max-w-0">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{service.name}</span>
                  <span className="truncate text-sm @lg:hidden">
                    {bookingTypeLabel(service.bookingType)} ·{' '}
                    {formatDuration(service.durationMinutes)}
                    {service.priceCents > 0
                      ? ` · ${formatMoney(service.priceCents, service.currency)}`
                      : ''}
                  </span>
                </span>
              </td>
              <td className="hidden whitespace-nowrap @lg:table-cell">
                {bookingTypeLabel(service.bookingType)}
              </td>
              <td className="hidden whitespace-nowrap tabular-nums @xl:table-cell">
                {formatDuration(service.durationMinutes)}
              </td>
              <td className="hidden whitespace-nowrap tabular-nums @xl:table-cell">
                {service.priceCents > 0
                  ? formatMoney(service.priceCents, service.currency)
                  : 'Free'}
              </td>
              <td>
                <Badge color={state.tone} variant="soft" size="sm">
                  {state.label}
                </Badge>
              </td>
              {anyRemoved ? (
                <td className="text-right">
                  {removed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      color="module"
                      loading={restore.isPending && restore.variables === service.id}
                      disabled={restore.isPending}
                      onClick={() => {
                        putBack(service);
                      }}
                    >
                      <Icon glyph={faRotateLeft} className="size-4" aria-hidden />
                      Put it back
                    </Button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
