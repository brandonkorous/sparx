import { Badge, Table } from 'silicaui-react';

import { EntityRowLink } from '../../../_components/entity-row-link';
import type { Booking } from '../../_lib/types';
import { BOOKING_TYPE_LABEL, formatDateTime } from '../../_lib/format';
import { StatusBadge } from '../../_components/status-badge';
import { BookingActions } from './booking-actions';

function customerLabel(b: Booking): string {
  const guest = b.attendees.find((a) => a.guestName)?.guestName;
  if (guest) return guest;
  if (b.attendees.length > 1) return `${b.attendees.length} attendees`;
  if (b.customerId) return 'Customer';
  return '—';
}

// Deposit/hold status badge (docs/79 §9): held = a card hold or pending charge,
// captured = money taken (a charged deposit or a captured no-show fee), released =
// a hold voided / deposit refunded, forfeited = a charged deposit kept.
const DEPOSIT: Record<
  string,
  { label: string; color: 'module' | 'success' | 'neutral' | 'danger' }
> = {
  held: { label: 'Hold', color: 'module' },
  captured: { label: 'Paid', color: 'success' },
  refunded: { label: 'Released', color: 'neutral' },
  forfeited: { label: 'Forfeited', color: 'danger' },
};

function DepositCell({ status }: { status: string | null }) {
  const dep = status ? DEPOSIT[status] : undefined;
  if (!dep) return <span className="text-[var(--color-muted-foreground)]">—</span>;
  return (
    <Badge color={dep.color} variant="soft">
      {dep.label}
    </Badge>
  );
}

export function BookingsList({ bookings }: { bookings: Booking[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <th>When</th>
          <th>Service</th>
          <th>Customer</th>
          <th>Resource</th>
          <th>Deposit</th>
          <th>Status</th>
          <th className="w-10" />
        </tr>
      </thead>
      <tbody>
        {bookings.map((b) => (
          <tr key={b.id}>
            <td className="font-medium">
              <EntityRowLink
                href={`/scheduling/bookings/${b.id}`}
                entityType="booking"
                entityId={b.id}
                className="hover:text-[var(--module-active)] hover:underline"
              >
                {formatDateTime(b.startAt, b.timezone)}
              </EntityRowLink>
            </td>
            <td>
              <span className="flex flex-col">
                <span>{b.service.name}</span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {BOOKING_TYPE_LABEL[b.bookingType]}
                  {b.partySize ? ` · party of ${b.partySize}` : ''}
                </span>
              </span>
            </td>
            <td>{customerLabel(b)}</td>
            <td className="text-[var(--color-muted-foreground)]">
              {b.resources.map((r) => r.resource.name).join(', ') || '—'}
            </td>
            <td>
              <DepositCell status={b.depositStatus} />
            </td>
            <td>
              <StatusBadge status={b.status} />
            </td>
            <td>
              <BookingActions id={b.id} status={b.status} bookingType={b.bookingType} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
