'use client';

// WHAT REACHES THE CUSTOMER — one booking's notification ledger, in plain words.
//
// The platform has always kept this record (`scheduling_booking_notifications`):
// the confirmation the moment a booking is taken, a notice when it moves or is
// cancelled, and a reminder at each offset the service's rule set asks for. None
// of it was ever shown, so a booking that will remind nobody read exactly like one
// with three reminders queued — and a service with no rule set lays no reminder
// rows at all, silently, which is how a salon's busiest service came to remind
// nobody for a fortnight.
//
// It states, it does not reassure: with nothing queued this says so, and says
// where reminders come from, rather than rendering an empty list.

import { useQuery } from '@wizeworks/query';
import { Badge, Text } from '@wizeworks/silicaui-react';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';
import { bookingKeys } from './bookings-data';

export interface BookingNotice {
  id: string;
  type: string;
  channel: string;
  status: string;
  scheduledFor: string;
  sentAt: string | null;
}

/** Nested under the booking's own key, so every lifecycle write refreshes it. */
export function useBookingNotices(id: string) {
  return useQuery({
    queryKey: [...bookingKeys.all, id, 'notices'] as const,
    queryFn: () => api.get<BookingNotice[]>(`/v1/scheduling/bookings/${id}/notices`),
    enabled: id !== '' && id !== 'new',
    retry: (failureCount: number, error: unknown) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

const WHAT: Record<string, string> = {
  confirmation: 'The booking confirmation',
  reminder: 'A reminder',
  change: 'A note that it moved',
  cancellation: 'A note that it was cancelled',
  followup: 'A follow-up',
  waitlist_offer: 'A waiting-list offer',
};

const HOW: Record<string, string> = {
  email: 'by email',
  sms: 'by text',
  push: 'as a notification',
};

/** A date and time somebody would say out loud, in the booking's own zone. */
function whenWords(iso: string, timezone: string | null | undefined): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      // `||` on purpose: an EMPTY zone must fall back too, and `??` would keep it.
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      timeZone: timezone || 'UTC',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'sent') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'cancelled') return 'warning';
  return 'info';
}

function statusWords(status: string): string {
  if (status === 'sent') return 'Sent';
  if (status === 'failed') return 'Did not send';
  if (status === 'cancelled') return 'Called off';
  return 'To go';
}

export function BookingNotices({
  bookingId,
  timezone,
  stillAhead,
  reachable,
}: {
  bookingId: string;
  timezone?: string | null;
  /** Whether anything COULD still reach them — false once the booking is past or
   *  finished, where "no reminder is due" is just the passage of time and blaming
   *  the rule set for it would be wrong. */
  stillAhead: boolean;
  /** Whether there is an ACCOUNT to reach. A name written on a walk-in is not
   *  one: the engine's `reachableChannels` answers nothing without a customer, so
   *  no notice is ever laid. Without this the pane blamed the service's rule set
   *  for silence the rule set had nothing to do with, and sent someone to fix a
   *  setting that was already right. */
  reachable: boolean;
}) {
  const { data, isPending, isError } = useBookingNotices(bookingId);

  if (isPending) {
    return (
      <Text className="text-sm" role="status">
        Checking what has gone out…
      </Text>
    );
  }
  if (isError) {
    return <Text className="text-sm">Could not read what has been sent about this booking.</Text>;
  }

  // A called-off notice is one the platform dropped when the booking moved or
  // ended — it is bookkeeping, not something that happened to the customer.
  const rows: BookingNotice[] = (data ?? []).filter((notice) => notice.status !== 'cancelled');
  const coming = rows.filter((notice) => notice.status === 'pending');
  const reminderComing = coming.some((notice) => notice.type === 'reminder');

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {rows.map((notice) => (
            <li key={notice.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Badge color={statusTone(notice.status)} variant="soft">
                {statusWords(notice.status)}
              </Badge>
              <span className="text-base">
                {WHAT[notice.type] ?? notice.type} {HOW[notice.channel] ?? notice.channel}
              </span>
              <span className="text-sm">
                {notice.sentAt
                  ? whenWords(notice.sentAt, timezone)
                  : whenWords(notice.scheduledFor, timezone)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!reachable ? (
        <Text className="text-sm">
          Nothing was sent and nothing will be. Confirmations and reminders go to the email or phone
          on a customer&apos;s record, and this booking has no account attached — a name written on
          it is not an address. Link a customer when you take the booking and both follow.
        </Text>
      ) : stillAhead && !reminderComing ? (
        <NoReminder anySent={rows.length > 0} />
      ) : !stillAhead && rows.length === 0 ? (
        <Text className="text-sm">Nothing was ever sent to this customer about this booking.</Text>
      ) : null}
    </div>
  );
}

/**
 * The line that says nobody is being reminded — and where reminders come from.
 *
 * Named rather than guessed: this screen cannot see the service's rule set, so it
 * says where the setting lives instead of asserting which of the two reasons
 * applies (no rule set on the service, or a rule set with every reminder unticked).
 */
function NoReminder({ anySent }: { anySent: boolean }) {
  return (
    <Text className="text-sm">
      {anySent
        ? 'No reminder is due before this one. '
        : 'Nothing has gone out about this booking, and nothing is due to. '}
      Reminders are part of the booking rules on the service, so a service with no rule set reminds
      nobody.
    </Text>
  );
}

export default BookingNotices;
