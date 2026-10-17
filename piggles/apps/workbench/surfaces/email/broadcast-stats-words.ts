// WHAT THE RESULT TILES SAY, as pure rules, split from React so a plain Node test can reach them.
// Each is a sentence to an owner about her own mail: issue 246 ("Delivered 0" before any confirmation),
// 251 (a zero in success green), and a "next few minutes" promise with no clock that never expired.

/** `plain` is the colorless case, for a number that carries no verdict. */
export type Tone = 'plain' | 'info' | 'success' | 'warning' | 'error';

/** Only the two counts the Delivered tile reads. Declared here, structurally, so
 *  this module imports nothing: `BroadcastStats` satisfies it. */
export interface DeliveryCounts {
  accepted: number;
  delivered: number;
}

export interface Tile {
  /** "Delivered" only once a receiving server has confirmed it (issue 270). */
  label: string;
  value: number;
  hint: string;
  tone: Tone;
}

/** How long a delivery confirmation is still plausibly on its way. An hour is generous on purpose:
 *  the point is that the promise EXPIRES, instead of telling her to wait for what is not coming. */
export const CONFIRMATION_WINDOW_MS = 60 * 60 * 1000;

/** Is a delivery confirmation still reasonably expected? A missing or unreadable send time keeps the
 *  gentler sentence: vague is survivable, "it failed" because a timestamp was missing is not. */
export function confirmationStillExpected(sentAt: string | null, now: Date = new Date()): boolean {
  if (!sentAt) return true;
  const at = Date.parse(sentAt);
  if (Number.isNaN(at)) return true;
  return now.getTime() - at < CONFIRMATION_WINDOW_MS;
}

/** The Delivered tile's number, sentence and color. Four states, because
 *  "handed over, not yet confirmed" is neither "delivered" nor "failed", and
 *  because it stops being "not YET" once enough time has gone by. */
export function deliveredTile(
  stats: DeliveryCounts,
  sentAt: string | null,
  now: Date = new Date()
): Tile {
  if (stats.delivered > 0) {
    return {
      label: 'Delivered',
      value: stats.delivered,
      hint: 'Confirmed by the receiving mail server',
      tone: 'success',
    };
  }
  if (stats.accepted > 0) {
    if (confirmationStillExpected(sentAt, now)) {
      return {
        label: 'Sent',
        value: stats.accepted,
        hint: 'On their way. Confirmations arrive over the next few minutes.',
        tone: 'info',
      };
    }
    // Past the window and still nothing back. Say only that: a service that never reports deliveries
    // and mail that did not land look the same from here, and guessing sends her to fix the wrong thing.
    return {
      label: 'Sent',
      value: stats.accepted,
      hint: 'These went out. Nothing has come back since to confirm they landed.',
      tone: 'plain',
    };
  }
  return { label: 'Sent', value: 0, hint: 'Nothing has gone out yet', tone: 'plain' };
}

/** Good news only once there is some. A zero in success green says the opposite
 *  of the sentence under it (issue 251). */
export function achievedTone(count: number): Tone {
  return count > 0 ? 'success' : 'plain';
}

/** "of delivered" is a lie while nothing is confirmed: the share is of what
 *  actually went out. */
export function shareOfLabel(delivered: number): string {
  return delivered > 0 ? 'of delivered' : 'of those sent';
}

/** Everything a mail service reports back AFTER a message is handed over. `accepted` is not in it:
 *  that is the send itself, written by us. If none of these ever arrives, nothing was measured. */
export interface ReturnedCounts {
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
}

/** Has ANYTHING come back about this send? */
export function anythingCameBack(stats: ReturnedCounts): boolean {
  return (
    stats.delivered > 0 ||
    stats.opened > 0 ||
    stats.clicked > 0 ||
    stats.bounced > 0 ||
    stats.complained > 0 ||
    stats.unsubscribed > 0
  );
}

// One opened/clicked LIST cell. A share needs two measured numbers, so with nothing back it is a dash,
// never `0%` (in 2026-09 every email_events row was `accepted`). Issue 531 fixed only the detail screen.
// Returns a `title` too, because the dash alone is half an answer and the column is too narrow.
export function engagementCell(
  part: number,
  stats: ReturnedCounts & { accepted: number },
  recipientCount: number
): { text: string; title: string } {
  const base = stats.delivered || stats.accepted || recipientCount;
  if (base <= 0) {
    return { text: '—', title: 'Nothing has gone out yet.' };
  }
  if (!anythingCameBack(stats)) {
    return {
      text: '—',
      title:
        'These went out, and nothing has come back about them since: no deliveries, opens, clicks or bounces. There is nothing to work a share out of, so this is not zero, it is unknown.',
    };
  }
  const pct = Math.round((part / base) * 100);
  return {
    text: `${String(pct)}%`,
    title: `${String(part)} of ${String(base)} ${stats.delivered > 0 ? 'delivered' : 'sent'}.`,
  };
}
