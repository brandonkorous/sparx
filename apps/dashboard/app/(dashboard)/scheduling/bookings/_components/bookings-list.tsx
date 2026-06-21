import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@sparx/ui';

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
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Service</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Resource</TableHead>
          <TableHead>Deposit</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((b) => (
          <TableRow key={b.id}>
            <TableCell className="font-medium">{formatDateTime(b.startAt, b.timezone)}</TableCell>
            <TableCell>
              <span className="flex flex-col">
                <span>{b.service.name}</span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {BOOKING_TYPE_LABEL[b.bookingType]}
                  {b.partySize ? ` · party of ${b.partySize}` : ''}
                </span>
              </span>
            </TableCell>
            <TableCell>{customerLabel(b)}</TableCell>
            <TableCell className="text-[var(--color-muted-foreground)]">
              {b.resources.map((r) => r.resource.name).join(', ') || '—'}
            </TableCell>
            <TableCell>
              <DepositCell status={b.depositStatus} />
            </TableCell>
            <TableCell>
              <StatusBadge status={b.status} />
            </TableCell>
            <TableCell>
              <BookingActions id={b.id} status={b.status} bookingType={b.bookingType} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
