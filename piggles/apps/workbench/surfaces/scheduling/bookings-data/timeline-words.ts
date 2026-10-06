import type { BookingTimelineEntry } from './shapes';
import { joinWords } from './recurrence';
import { formatWhen, formatMoney } from './names-and-times';

/* ── Reading the change history in plain words ──────────────────────────── */

/** The fields a `booking.updated` entry can carry, in the words an owner uses. */
const UPDATED_FIELD_LABELS: Record<string, string> = {
  notes: 'the note the customer sees',
  staffNotes: 'the private team note',
  // A trade account's visit: its vehicle and account (sparx persona issue 086).
  assetRef: 'the vehicle',
  companyId: 'the trade account',
  partsLinked: 'the linked parts',
  locationId: 'the location',
  workOrderId: 'the linked job',
};

/** The human names of whatever an edit changed, read off its `changes` map. */
function changedFieldLabels(diff: Record<string, unknown>): string[] {
  const changes = diff.changes;
  if (!changes || typeof changes !== 'object') return [];
  return Object.keys(changes as Record<string, unknown>).map(
    (key) => UPDATED_FIELD_LABELS[key] ?? key
  );
}

/** One history entry in plain words: a headline plus an optional detail line. Every
 *  branch reads only what the entry recorded; an unknown action says "Updated". */
export function describeTimelineEntry(
  entry: BookingTimelineEntry,
  timezone?: string | null
): { label: string; detail: string | null } {
  const diff = entry.diff ?? {};
  switch (entry.action) {
    case 'booking.created':
      return { label: 'Booking taken', detail: null };
    case 'booking.confirmed':
      return { label: 'Confirmed', detail: null };
    case 'booking.checked_in':
      return { label: 'Customer checked in', detail: null };
    case 'booking.completed':
      return { label: 'Marked complete', detail: null };
    case 'booking.no_show':
      return { label: 'Marked as a no-show', detail: null };
    case 'booking.cancelled': {
      const reason = typeof diff.reason === 'string' && diff.reason.trim() ? diff.reason : null;
      return { label: 'Canceled', detail: reason };
    }
    case 'booking.rescheduled': {
      const from = typeof diff.fromStartAt === 'string' ? diff.fromStartAt : null;
      const to = typeof diff.toStartAt === 'string' ? diff.toStartAt : null;
      if (from && to) {
        return {
          label: 'Moved to a new time',
          detail: `From ${formatWhen(from, timezone)} to ${formatWhen(to, timezone)}`,
        };
      }
      return { label: 'Moved to a new time', detail: null };
    }
    case 'booking.updated': {
      const fields = changedFieldLabels(diff);
      const detail = fields.length ? `Changed ${joinWords(fields)}` : null;
      return { label: 'Details updated', detail };
    }
    case 'booking.payment_settled':
    case 'booking.payment_not_settled':
      return paymentTimelineWords(entry.action === 'booking.payment_settled', diff);
    default:
      return { label: 'Updated', detail: null };
  }
}

/** What the card did when the booking ended, as a history line (sparx persona
 *  issue 087), rather than an "Updated" that hid a fee the card refused. */
function paymentTimelineWords(
  done: boolean,
  diff: Record<string, unknown>
): { label: string; detail: string | null } {
  const move = typeof diff.move === 'string' ? diff.move : '';
  const fee = diff.ending === 'no_show' ? 'No-show fee' : 'Late-cancellation fee';
  const money =
    typeof diff.amountCents === 'number' && typeof diff.currency === 'string'
      ? formatMoney(diff.amountCents, diff.currency)
      : null;
  const reason =
    typeof diff.reason === 'string' && diff.reason.trim()
      ? diff.reason.replace(/[.\s]+$/, '').trim()
      : null;
  const labels: Record<string, [string, string]> = {
    capture_fee: [`${fee} charged`, `${fee} not charged`],
    release_hold: ['Card hold let go', 'Card hold not let go yet'],
    call_off: ['Deposit request called off', 'Deposit request not called off'],
    refund_deposit: ['Deposit refunded', 'Deposit not refunded'],
    keep_deposit: ['Deposit kept', 'Deposit not settled'],
  };
  const [doneLabel, notDoneLabel] = labels[move] ?? ['Card settled', 'Card not settled'];
  if (done) return { label: doneLabel, detail: money };
  const why = reason ? `It did not go through: ${reason}.` : 'It did not go through.';
  return { label: notDoneLabel, detail: money ? `${money}. ${why}` : why };
}

/** Who made a change, in the words we can honestly stand behind — the trail
 *  keeps an actor TYPE, not a resolved name. */
export function timelineActorLabel(entry: BookingTimelineEntry): string {
  return entry.actorType === 'system' ? 'Automatic' : 'A team member';
}
